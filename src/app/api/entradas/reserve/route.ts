import { requireSupabaseAdmin } from '@/lib/supabase';
import { getBaseUrlFromRequest } from '@/lib/base-url';
import { createPaymentDataToken } from '@/lib/security/payment-data-token';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

const ItemSchema = z.object({
  ticket_type_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(8),
});

const EntradasReserveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date YYYY-MM-DD'),
  items: z.array(ItemSchema).min(1, 'Al menos un ítem'),
  customer: z.object({
    email: z.string().email(),
  }),
});

type LineItem = {
  inventory_id: string;
  ticket_type_id: string;
  title: string;
  unit_price: number;
  quantity: number;
  amount: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = EntradasReserveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { date, items: requestedItems, customer } = validation.data;
    const supabase = requireSupabaseAdmin();

    const { data: eventDay, error: dayError } = await supabase
      .from('event_days')
      .select('id, event_id')
      .eq('event_date', date)
      .single();

    if (dayError || !eventDay) {
      return NextResponse.json(
        { error: 'No hay evento para esa fecha' },
        { status: 404 }
      );
    }

    const eventId = (eventDay as { event_id: string | null }).event_id;
    if (!eventId) {
      return NextResponse.json(
        { error: 'event_day sin event_id; ejecutar seed' },
        { status: 503 }
      );
    }

    if (requestedItems.length === 1) {
      const baseUrl = getBaseUrlFromRequest(
        request,
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      );
      const slot = Math.floor(Date.now() / 60000);
      const raw = `${date}|${requestedItems[0].ticket_type_id}|${customer.email}|${slot}`;
      const idempotencyKey = crypto.createHash('sha256').update(raw).digest('base64url').slice(0, 64);
      const res = await fetch(`${baseUrl}/api/tickets/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type_id: requestedItems[0].ticket_type_id,
          quantity: requestedItems[0].quantity,
          payer_email: customer.email,
          event_date: date,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: typeof data?.error === 'string' ? data.error : 'Error al reservar' },
          { status: res.status >= 400 ? res.status : 502 }
        );
      }
      return NextResponse.json(data);
    }

    const lineItems: LineItem[] = [];
    for (const reqItem of requestedItems) {
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('id, total_capacity, ticket_types!inner(id, name), events!inner(id, name)')
        .eq('event_id', eventId)
        .eq('ticket_type_id', reqItem.ticket_type_id)
        .single();

      if (invError || !inventory) {
        return NextResponse.json(
          { error: `No se encontró inventario para tipo ${reqItem.ticket_type_id}` },
          { status: 404 }
        );
      }

      const { data: dailyRow, error: dailyErr } = await supabase
        .from('daily_inventory')
        .select('price')
        .eq('event_day_id', eventDay.id)
        .eq('ticket_type_id', reqItem.ticket_type_id)
        .single();

      const dailyPrice = dailyErr ? NaN : Number((dailyRow as { price?: number })?.price ?? 0);
      if (!Number.isFinite(dailyPrice) || dailyPrice < 0) {
        return NextResponse.json(
          { error: 'Precio no configurado para esa fecha' },
          { status: 400 }
        );
      }
      const unitPrice = Math.round(dailyPrice);
      const amount = unitPrice * reqItem.quantity;

      const ticketTypesData = inventory.ticket_types;
      const ticketType = Array.isArray(ticketTypesData) ? ticketTypesData[0] : ticketTypesData;
      const eventsData = inventory.events;
      const event = Array.isArray(eventsData) ? eventsData[0] : eventsData;
      const name =
        ticketType && typeof ticketType === 'object' && 'name' in ticketType
          ? String(ticketType.name)
          : 'Entrada';

      lineItems.push({
        inventory_id: inventory.id,
        ticket_type_id: reqItem.ticket_type_id,
        title: `${name} (x${reqItem.quantity})`,
        unit_price: unitPrice,
        quantity: reqItem.quantity,
        amount,
      });
    }

    const externalReference = crypto.randomUUID();
    const totalAmount = lineItems.reduce((sum, li) => sum + li.amount, 0);

    const pItems = lineItems.map((li) => ({
      inventory_id: li.inventory_id,
      quantity: li.quantity,
      amount: li.amount,
    }));
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_orders_atomic', {
      p_external_reference: externalReference,
      p_user_email: customer.email,
      p_items: pItems,
    });

    if (rpcError) {
      console.error('create_orders_atomic error:', rpcError);
      return NextResponse.json(
        { error: 'Error al reservar stock. Reintentar más tarde.' },
        { status: 500 }
      );
    }

    const result = rpcResult as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      if (result?.error === 'stock_insufficient') {
        return NextResponse.json(
          { error: 'Stock insuficiente para uno o más ítems' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: result?.error || 'Error al reservar stock' },
        { status: 409 }
      );
    }

    const { payment_data_token } = createPaymentDataToken(
      externalReference,
      totalAmount,
      customer.email
    );

    return NextResponse.json({
      external_reference: externalReference,
      transaction_amount: totalAmount,
      payer_email: customer.email,
      payment_data_token,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('POST /api/entradas/reserve error:', err.message);
    if (err.message.includes('MP_PAYMENT_DATA_SECRET')) {
      return NextResponse.json(
        { error: 'Configuración de pago on-site incompleta.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Error al procesar la reserva' },
      { status: 500 }
    );
  }
}
