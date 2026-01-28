import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseClient } from '@/lib/supabase';
import { CreatePreferenceSchema } from '@/lib/schemas';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validación con Zod
    const validationResult = CreatePreferenceSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { event_id, ticket_type_id, quantity, payer_email } = validationResult.data;

    // Conectar a Supabase
    const supabase = requireSupabaseClient();

    // 1. Obtener inventory_id desde (event_id, ticket_type_id)
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, total_capacity, ticket_types!inner(id, name, price), events!inner(id, name)')
      .eq('event_id', event_id)
      .eq('ticket_type_id', ticket_type_id)
      .single();

    if (inventoryError || !inventory) {
      console.error('Error al obtener inventory:', inventoryError);
      return NextResponse.json(
        { error: 'No se encontró el tipo de ticket para este evento' },
        { status: 404 }
      );
    }

    // 2. Validar stock disponible
    // Nota: Asumiendo que necesitamos agregar un campo 'quantity' a orders en el futuro
    // Por ahora, contamos órdenes (asumiendo 1 ticket por orden temporalmente)
    // TODO: Agregar campo 'quantity' a tabla orders para soportar múltiples tickets por orden
    const { count: ordersCount, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('inventory_id', inventory.id)
      .in('status', ['pending', 'paid']);

    if (ordersError) {
      console.error('Error al consultar órdenes:', ordersError);
      return NextResponse.json(
        { error: 'Error al validar stock disponible' },
        { status: 500 }
      );
    }

    // Calcular stock disponible (temporal: asumiendo 1 ticket por orden)
    const soldQuantity = ordersCount || 0;
    const availableStock = inventory.total_capacity - soldQuantity;

    if (availableStock < quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${availableStock}, Solicitado: ${quantity}` },
        { status: 409 }
      );
    }

    // 3. Obtener precio desde ticket_types
    // Supabase puede devolver un array o un objeto en JOINs, manejamos ambos casos
    const ticketTypesData = inventory.ticket_types;
    const ticketType = Array.isArray(ticketTypesData) 
      ? ticketTypesData[0] 
      : ticketTypesData;
    
    if (!ticketType || typeof ticketType !== 'object' || !('price' in ticketType)) {
      return NextResponse.json(
        { error: 'Error al obtener información del tipo de ticket' },
        { status: 500 }
      );
    }

    const unitPrice = Number(ticketType.price);

    if (isNaN(unitPrice) || unitPrice <= 0) {
      return NextResponse.json(
        { error: 'Precio inválido en base de datos' },
        { status: 500 }
      );
    }

    const totalAmount = unitPrice * quantity;

    // 4. Generar UUID para trazabilidad
    const externalReference = randomUUID();

    // 5. Insertar orden en BD (status: 'pending')
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        external_reference: externalReference,
        inventory_id: inventory.id,
        user_email: payer_email,
        amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      console.error('Error al crear orden:', orderError);
      return NextResponse.json(
        { error: 'Error al crear la orden en base de datos' },
        { status: 500 }
      );
    }

    // 6. Crear preferencia en Mercado Pago
    const { preferenceClient } = requireMercadoPagoClient();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl';
    
    // Obtener nombre del evento (manejar array u objeto)
    const eventsData = inventory.events;
    const event = Array.isArray(eventsData) ? eventsData[0] : eventsData;
    const eventName = (event && typeof event === 'object' && 'name' in event) 
      ? String(event.name) 
      : 'Festival Pucón 2026';
    
    const ticketTypeName = (ticketType && typeof ticketType === 'object' && 'name' in ticketType)
      ? String(ticketType.name)
      : 'Ticket';

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: ticket_type_id,
            title: `${ticketTypeName} - ${eventName}`,
            quantity: quantity,
            unit_price: unitPrice,
            currency_id: 'CLP',
          },
        ],
        payer: {
          email: payer_email,
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
