import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseClient } from '@/lib/supabase';
import { generateTicketPDF } from '@/lib/pdf';
import { sendTicketEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

interface MercadoPagoWebhookData {
  id?: string;
  type?: string;
  data?: {
    id?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body: MercadoPagoWebhookData = await request.json();
    
    // Extraer ID y tipo del webhook
    const paymentId = body.data?.id || body.id;
    const eventType = body.type;

    if (!paymentId) {
      console.warn('⚠️ Webhook recibido sin ID de pago');
      return NextResponse.json({ status: 'OK' }, { status: 200 });
    }

    // VALIDACIÓN CRUZADA: Consultar payment directamente a Mercado Pago
    if (eventType === 'payment') {
      try {
        const { paymentClient } = requireMercadoPagoClient();
        const payment = await paymentClient.get({ id: Number(paymentId) });

        if (!payment.external_reference) {
          console.warn('⚠️ Payment sin external_reference');
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        const supabase = requireSupabaseClient();

        // IDEMPOTENCIA: Verificar si ya procesamos este payment_id
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, status')
          .eq('mp_payment_id', String(paymentId))
          .single();

        if (existingOrder && existingOrder.status === 'paid') {
          console.log('✅ Pago ya procesado anteriormente:', paymentId);
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        // Buscar orden por external_reference
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, status, external_reference')
          .eq('external_reference', payment.external_reference)
          .single();

        if (orderError || !order) {
          console.error('❌ Orden no encontrada:', payment.external_reference);
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        // Switch según estado del pago
        switch (payment.status) {
          case 'approved': {
            // Verificar idempotencia nuevamente antes de procesar
            if (order.status === 'paid') {
              console.log('✅ Orden ya marcada como pagada:', order.id);
              return NextResponse.json({ status: 'OK' }, { status: 200 });
            }

            // Actualizar orden a 'paid' y guardar mp_payment_id
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'paid',
                mp_payment_id: String(paymentId),
              })
              .eq('id', order.id);

            if (updateError) {
              console.error('❌ Error al actualizar orden:', updateError);
              return NextResponse.json({ status: 'OK' }, { status: 200 });
            }

            console.log(
              '✅ PAGO CONFIRMADO. Orden:',
              payment.external_reference,
              'Email:',
              payment.payer?.email || 'N/A'
            );

            // Obtener orden completa con detalles para PDF y email
            const { data: orderWithDetails, error: detailsError } = await supabase
              .from('orders')
              .select(`
                *,
                inventory:inventory_id (
                  *,
                  event:event_id (
                    *
                  ),
                  ticket_type:ticket_type_id (
                    *
                  )
                )
              `)
              .eq('id', order.id)
              .single();

            if (detailsError || !orderWithDetails) {
              console.error('❌ Error al obtener detalles de orden:', detailsError);
              return NextResponse.json({ status: 'OK' }, { status: 200 });
            }

            // Transformar datos para el tipo OrderWithDetails
            const orderData = {
              id: orderWithDetails.id,
              external_reference: orderWithDetails.external_reference,
              inventory_id: orderWithDetails.inventory_id,
              user_email: orderWithDetails.user_email,
              amount: Number(orderWithDetails.amount),
              status: orderWithDetails.status as 'pending' | 'paid' | 'rejected',
              mp_payment_id: orderWithDetails.mp_payment_id,
              created_at: new Date(orderWithDetails.created_at),
              inventory: {
                id: orderWithDetails.inventory.id,
                event_id: orderWithDetails.inventory.event_id,
                ticket_type_id: orderWithDetails.inventory.ticket_type_id,
                total_capacity: orderWithDetails.inventory.total_capacity,
                event: {
                  id: orderWithDetails.inventory.event.id,
                  name: orderWithDetails.inventory.event.name,
                  date: new Date(orderWithDetails.inventory.event.date),
                  venue: orderWithDetails.inventory.event.venue,
                },
                ticket_type: {
                  id: orderWithDetails.inventory.ticket_type.id,
                  name: orderWithDetails.inventory.ticket_type.name,
                  price: Number(orderWithDetails.inventory.ticket_type.price),
                },
              },
            };

            try {
              // Generar PDF
              const pdfBuffer = await generateTicketPDF(orderData);

              // Enviar email con PDF adjunto
              await sendTicketEmail(orderData, pdfBuffer);

              console.log('✅ PDF generado y email enviado para orden:', order.id);
            } catch (pdfEmailError) {
              // Log error pero no fallar el webhook
              console.error('❌ Error al generar PDF o enviar email:', pdfEmailError);
              // La orden ya está marcada como paid, el email se puede reenviar manualmente
            }

            break;
          }

          case 'rejected': {
            // Actualizar orden a 'rejected'
            await supabase
              .from('orders')
              .update({
                status: 'rejected',
                mp_payment_id: String(paymentId),
              })
              .eq('id', order.id);

            console.log(
              '❌ PAGO RECHAZADO. Razón:',
              payment.status_detail,
              'Orden:',
              payment.external_reference
            );
            break;
          }

          case 'pending': {
            // Mantener status 'pending' pero guardar mp_payment_id
            await supabase
              .from('orders')
              .update({
                mp_payment_id: String(paymentId),
              })
              .eq('id', order.id);

            console.log(
              '⏳ PAGO PENDIENTE. Orden:',
              payment.external_reference,
              'Email:',
              payment.payer?.email || 'N/A'
            );
            break;
          }

          case 'cancelled': {
            // Actualizar orden a 'rejected' (o crear status 'cancelled' si existe)
            await supabase
              .from('orders')
              .update({
                status: 'rejected',
                mp_payment_id: String(paymentId),
              })
              .eq('id', order.id);

            console.log(
              '🚫 PAGO CANCELADO. Orden:',
              payment.external_reference
            );
            break;
          }

          default: {
            console.log(
              'ℹ️ PAGO CON ESTADO:',
              payment.status,
              'Orden:',
              payment.external_reference
            );
            break;
          }
        }
      } catch (paymentError) {
        console.error('Error al consultar pago en Mercado Pago:', paymentError);
        // Retornamos OK igual para que Mercado Pago no reintente
        return NextResponse.json({ status: 'OK' }, { status: 200 });
      }
    }

    // Siempre retornar 200 para evitar reintentos de Mercado Pago
    return NextResponse.json({ status: 'OK' }, { status: 200 });

  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error);
    // Retornar 200 para evitar reintentos infinitos
    return NextResponse.json({ status: 'OK' }, { status: 200 });
  }
}
