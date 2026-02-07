import { requireSupabaseAdmin } from '@/lib/supabase';
import { CreatePreferenceSchema } from '@/lib/schemas';
import { createPaymentDataToken } from '@/lib/security/payment-data-token';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const IDEMPOTENCY_TTL_HOURS = 24;

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || null;
    const body = await request.json();

    const validationResult = CreatePreferenceSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { event_id, ticket_type_id, quantity, payer_email, event_date } = validationResult.data;
    const normalizedQuantity = Math.max(1, Math.min(8, quantity));

    const supabase = requireSupabaseAdmin();

    let unitPrice: number;
    if (event_date) {
      const { data: eventDay, error: dayErr } = await supabase
        .from('event_days')
        .select('id')
        .eq('event_id', event_id)
        .eq('event_date', event_date)
        .single();
      if (dayErr || !eventDay) {
        if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
        return NextResponse.json(
          { error: 'No se encontró evento para esa fecha' },
          { status: 404 }
        );
      }
      const { data: dailyRow, error: dailyErr } = await supabase
        .from('daily_inventory')
        .select('price')
        .eq('event_day_id', eventDay.id)
        .eq('ticket_type_id', ticket_type_id)
        .single();
      const dailyPrice = dailyErr ? NaN : Number((dailyRow as { price?: number })?.price ?? 0);
      if (!Number.isFinite(dailyPrice) || dailyPrice < 0) {
        if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
        return NextResponse.json(
          { error: 'Precio no configurado para esa fecha' },
          { status: 400 }
        );
      }
      unitPrice = Math.round(dailyPrice);
    } else {
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('id, total_capacity, ticket_types!inner(id, name, price), events!inner(id, name)')
        .eq('event_id', event_id)
        .eq('ticket_type_id', ticket_type_id)
        .single();
      if (inventoryError || !inventory) {
        if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
        return NextResponse.json(
          { error: 'No se encontró el tipo de ticket para este evento' },
          { status: 404 }
        );
      }
      const ticketTypesData = inventory.ticket_types;
      const ticketType = Array.isArray(ticketTypesData) ? ticketTypesData[0] : ticketTypesData;
      const priceRaw = Number((ticketType as { price?: number })?.price ?? 0);
      if (!Number.isFinite(priceRaw) || priceRaw <= 0) {
        if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
        return NextResponse.json(
          { error: 'Precio inválido en base de datos' },
          { status: 500 }
        );
      }
      unitPrice = Math.round(priceRaw);
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, total_capacity, ticket_types!inner(id, name), events!inner(id, name)')
      .eq('event_id', event_id)
      .eq('ticket_type_id', ticket_type_id)
      .single();

    if (inventoryError || !inventory) {
      if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
      return NextResponse.json(
        { error: 'No se encontró el tipo de ticket para este evento' },
        { status: 404 }
      );
    }

    const totalAmount = unitPrice * normalizedQuantity;
    const externalReference = randomUUID();

    if (idempotencyKey) {
      const { data: existing, error: selectErr } = await supabase
        .from('idempotency_keys')
        .select('response_body, created_at')
        .eq('key', idempotencyKey)
        .single();

      if (!selectErr && existing?.response_body) {
        const stored = existing.response_body as { external_reference?: string; transaction_amount?: number; payer_email?: string };
        const createdAt = new Date(existing.created_at).getTime();
        const ttlMs = IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
        if (stored.external_reference && Date.now() - createdAt < ttlMs) {
          const { payment_data_token } = createPaymentDataToken(
            stored.external_reference,
            stored.transaction_amount ?? 0,
            stored.payer_email ?? payer_email
          );
          return NextResponse.json({
            external_reference: stored.external_reference,
            transaction_amount: stored.transaction_amount,
            payer_email: stored.payer_email,
            payment_data_token,
          });
        }
      }
      if (!selectErr && existing && !(existing.response_body as { external_reference?: string } | null)?.external_reference) {
        return NextResponse.json(
          { error: 'Solicitud en curso. Reintentar más tarde.' },
          { status: 409 }
        );
      }

      const { error: insertKeyErr } = await supabase
        .from('idempotency_keys')
        .insert({ key: idempotencyKey });

      if (insertKeyErr?.code === '23505') {
        return NextResponse.json(
          { error: 'Solicitud duplicada en curso. Reintentar más tarde.' },
          { status: 409 }
        );
      }
      if (insertKeyErr) {
        console.error('Error al insertar idempotency_keys:', insertKeyErr);
        return NextResponse.json(
          { error: 'Error al procesar la solicitud de pago' },
          { status: 500 }
        );
      }
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_orders_atomic', {
      p_external_reference: externalReference,
      p_user_email: payer_email,
      p_items: [{ inventory_id: inventory.id, quantity: normalizedQuantity, amount: totalAmount }],
    });

    if (rpcError) {
      if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
      console.error('create_orders_atomic error:', rpcError);
      return NextResponse.json(
        { error: 'Error al reservar stock. Reintentar más tarde.' },
        { status: 500 }
      );
    }

    const result = rpcResult as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
      if (result?.error === 'stock_insufficient') {
        return NextResponse.json(
          { error: 'Stock insuficiente. Reintentar más tarde.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: result?.error || 'Error al reservar stock' },
        { status: 409 }
      );
    }

    const reservePayload = {
      external_reference: externalReference,
      transaction_amount: totalAmount,
      payer_email,
    };

    if (idempotencyKey) {
      await supabase
        .from('idempotency_keys')
        .update({
          external_reference: externalReference,
          response_body: reservePayload,
          created_at: new Date().toISOString(),
        })
        .eq('key', idempotencyKey);
    }

    const { payment_data_token } = createPaymentDataToken(
      externalReference,
      totalAmount,
      payer_email
    );

    return NextResponse.json({
      ...reservePayload,
      payment_data_token,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('POST /api/tickets/reserve error:', err.message);
    if (err.message.includes('MP_PAYMENT_DATA_SECRET')) {
      return NextResponse.json(
        { error: 'Configuración de pago on-site incompleta (MP_PAYMENT_DATA_SECRET).' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Error al procesar la reserva' },
      { status: 500 }
    );
  }
}
