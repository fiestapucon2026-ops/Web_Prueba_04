import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { NextResponse } from 'next/server';

/**
 * @deprecated Este endpoint está deprecado y será eliminado en una versión futura.
 * Por favor, usa /api/tickets/create-preference en su lugar.
 * 
 * Razones de deprecación:
 * - No valida precios desde BD (riesgo de seguridad)
 * - No valida stock disponible
 * - No persiste órdenes en BD
 * - No soporta múltiples eventos
 * 
 * Migración:
 * Cambiar de: POST /api/checkout
 * A: POST /api/tickets/create-preference
 * 
 * Payload nuevo:
 * {
 *   event_id: string (UUID),
 *   ticket_type_id: string (UUID),
 *   quantity: number,
 *   payer_email: string
 * }
 */
export async function POST(request: Request) {
  // Log de deprecación
  console.warn('⚠️ DEPRECATED: /api/checkout está siendo usado. Migrar a /api/tickets/create-preference');
  
  try {
    // 1. Recibimos los datos del producto desde el Frontend
    // Se espera: { title: "Ticket General", quantity: 1, price: 10000 }
    const body = await request.json();

    // 2. Definimos la URL base
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl';

    // 3. Validar y obtener cliente de Mercado Pago
    const { preferenceClient } = requireMercadoPagoClient();

    // 4. Creamos la "Preferencia" (La orden de compra)
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: 'ticket-01',
            title: body.title,
            quantity: Number(body.quantity),
            unit_price: Number(body.price),
            currency_id: 'CLP',
          },
        ],
        back_urls: {
          success: `${baseUrl}/success`, // Página de éxito
          failure: `${baseUrl}/failure`, // Página de error
          pending: `${baseUrl}/pending`, // Página de pendiente (ej: pago en efectivo)
        },
        auto_return: 'approved', // Redirige automático si el pago es exitoso
      },
    });

    // 4. Respondemos al Frontend con la URL de pago (init_point)
    return NextResponse.json({ url: preference.init_point });

  } catch (error) {
    console.error('Error al crear preferencia:', error);
    return NextResponse.json(
      { error: 'Error al procesar el pago' },
      { status: 500 }
    );
  }
}