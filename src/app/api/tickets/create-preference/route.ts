import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Mapa de precios definido en backend (SEGURIDAD: No confiar en frontend)
const PRICES: Record<string, number> = {
  general: 10000,
  vip: 25000,
};

interface CreatePreferenceRequest {
  ticketTypeId: string;
  quantity: number;
  payerEmail: string;
}

export async function POST(request: Request) {
  try {
    const body: CreatePreferenceRequest = await request.json();
    const { ticketTypeId, quantity, payerEmail } = body;

    // Validaciones estrictas
    if (!ticketTypeId || typeof ticketTypeId !== 'string') {
      return NextResponse.json(
        { error: 'ticketTypeId es requerido y debe ser string' },
        { status: 400 }
      );
    }

    if (!PRICES[ticketTypeId]) {
      return NextResponse.json(
        { error: `Tipo de ticket inválido: ${ticketTypeId}` },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity debe ser un entero positivo' },
        { status: 400 }
      );
    }

    if (!payerEmail || typeof payerEmail !== 'string' || !payerEmail.includes('@')) {
      return NextResponse.json(
        { error: 'payerEmail es requerido y debe ser un email válido' },
        { status: 400 }
      );
    }

    // Generar UUID para trazabilidad
    const externalReference = randomUUID();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl';
    const unitPrice = PRICES[ticketTypeId];

    // Validar y obtener cliente de Mercado Pago
    const { preferenceClient } = requireMercadoPagoClient();

    // Crear preferencia en Mercado Pago
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: ticketTypeId,
            title: `Ticket ${ticketTypeId.toUpperCase()} - Festival Pucón 2026`,
            quantity: quantity,
            unit_price: unitPrice,
            currency_id: 'CLP',
          },
        ],
        payer: {
          email: payerEmail,
        },
        back_urls: {
          success: `${baseUrl}/success`,
          failure: `${baseUrl}/failure`,
          pending: `${baseUrl}/pending`,
        },
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        auto_return: 'approved',
        external_reference: externalReference,
      },
    });

    return NextResponse.json({ init_point: preference.init_point });

  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud de pago' },
      { status: 500 }
    );
  }
}
