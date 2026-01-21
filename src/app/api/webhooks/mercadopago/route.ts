import { requireMercadoPagoClient } from '@/lib/mercadopago';
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

        // Switch según estado del pago
        switch (payment.status) {
          case 'approved':
            console.log(
              '✅ PAGO CONFIRMADO. Orden:',
              payment.external_reference,
              'Email:',
              payment.payer?.email || 'N/A'
            );
            // Aquí se puede agregar lógica adicional: actualizar BD, enviar email, etc.
            break;

          case 'rejected':
            console.log(
              '❌ PAGO RECHAZADO. Razón:',
              payment.status_detail,
              'Orden:',
              payment.external_reference
            );
            break;

          case 'pending':
            console.log(
              '⏳ PAGO PENDIENTE. Orden:',
              payment.external_reference,
              'Email:',
              payment.payer?.email || 'N/A'
            );
            break;

          case 'cancelled':
            console.log(
              '🚫 PAGO CANCELADO. Orden:',
              payment.external_reference
            );
            break;

          default:
            console.log(
              'ℹ️ PAGO CON ESTADO:',
              payment.status,
              'Orden:',
              payment.external_reference
            );
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
