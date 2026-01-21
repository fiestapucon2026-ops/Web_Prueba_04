import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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