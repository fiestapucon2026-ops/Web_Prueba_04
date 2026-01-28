import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseClient } from '@/lib/supabase';
import { generateTicketPDF } from '@/lib/pdf';
import { sendTicketEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

const WebhookBodySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

function parseXSignature(xSignature: string | null): { ts?: string; v1?: string } {
  if (!xSignature) return {};
  const parts = xSignature.split(',');
  const out: { ts?: string; v1?: string } = {};
  for (const p of parts) {
    const [k, v] = p.split('=').map((s) => s?.trim());
    if (k === 'ts') out.ts = v;
    if (k === 'v1') out.v1 = v;
  }
  return out;
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isTsWithinTolerance(tsRaw: string, toleranceSeconds = 300): boolean {
  // Docs show ts=1704908010 (seconds). Support seconds and ms.
  const tsNum = Number(tsRaw);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return false;
  const tsMs = tsRaw.length >= 13 ? tsNum : tsNum * 1000;
  const nowMs = Date.now();
  return Math.abs(nowMs - tsMs) <= toleranceSeconds * 1000;
}

function verifyMercadoPagoSignature(request: Request): { ok: boolean; reason?: string } {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: true, reason: 'MP_WEBHOOK_SECRET no configurado (verificación deshabilitada)' };
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const { ts, v1 } = parseXSignature(xSignature);

  if (!xSignature || !xRequestId || !ts || !v1) {
    return { ok: false, reason: 'Headers de firma incompletos (x-signature/x-request-id)' };
  }

  if (!isTsWithinTolerance(ts)) {
    return { ok: false, reason: 'Timestamp fuera de tolerancia' };
  }

  // Mercado Pago: manifest template = id:[data.id_url];request-id:[x-request-id];ts:[ts];
  // data.id_url viene desde query param "data.id". Si no existe, se omite según docs.
  const url = new URL(request.url);
  const dataId = (url.searchParams.get('data.id') || '').toLowerCase();

  let manifest = '';
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  if (ts) manifest += `ts:${ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const ok = timingSafeEqualHex(expected, v1);
  return ok ? { ok: true } : { ok: false, reason: 'Firma inválida' };
}

export async function POST(request: Request) {
  try {
    const sig = verifyMercadoPagoSignature(request);
    if (!sig.ok) {
      console.error('❌ Webhook Mercado Pago: verificación de firma fallida:', sig.reason);
      return NextResponse.json({ status: 'invalid_signature' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = WebhookBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.warn('⚠️ Webhook Mercado Pago: body inválido');
      return NextResponse.json({ status: 'OK' }, { status: 200 });
    }
    const body = parsed.data;
    
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
        const paymentIdNum = Number(paymentId);
        if (!Number.isFinite(paymentIdNum)) {
          console.warn('⚠️ paymentId inválido:', paymentId);
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }
        const payment = await paymentClient.get({ id: paymentIdNum });

        if (!payment.external_reference) {
          console.warn('⚠️ Payment sin external_reference');
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        const supabase = requireSupabaseClient();

        // IDEMPOTENCIA: Verificar si ya procesamos este payment_id
        const { data: existingOrders, error: existingOrderErr } = await supabase
          .from('orders')
          .select('id, status')
          .eq('mp_payment_id', String(paymentId))
          .limit(1);

        if (existingOrderErr) {
          console.error('Error al verificar idempotencia mp_payment_id:', existingOrderErr);
        }

        const existingOrder = existingOrders?.[0];
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
