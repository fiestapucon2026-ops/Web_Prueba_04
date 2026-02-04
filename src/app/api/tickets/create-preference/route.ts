import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { CreatePreferenceSchema } from '@/lib/schemas';
import { getBaseUrlFromRequest } from '@/lib/base-url';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const IDEMPOTENCY_TTL_HOURS = 24;

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || null;
    const body = await request.json();

    // Validación con Zod
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

    // Precio: si viene event_date, usar daily_inventory (precio del día); si no, ticket_types (fallback). Siempre servidor, nunca cliente.
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
      const dailyPrice = dailyErr ? 0 : Number((dailyRow as { price?: number })?.price ?? 0);
      if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) {
        if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
        return NextResponse.json(
          { error: 'Precio no configurado para esa fecha' },
          { status: 400 }
        );
      }
      unitPrice = Math.round(dailyPrice);
    } else {
      // Sin fecha: precio desde ticket_types (flujo /tickets u otros)
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

    // inventory (id, name, events) para RPC y título MP
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, total_capacity, ticket_types!inner(id, name), events!inner(id, name)')
      .eq('event_id', event_id)
      .eq('ticket_type_id', ticket_type_id)
      .single();

    if (inventoryError || !inventory) {
      if (idempotencyKey) {
        await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
      }
      return NextResponse.json(
        { error: 'No se encontró el tipo de ticket para este evento' },
        { status: 404 }
      );
    }

    const ticketTypesData = inventory.ticket_types;
    const ticketType = Array.isArray(ticketTypesData) ? ticketTypesData[0] : ticketTypesData;
    const ticketTypeName =
      ticketType && typeof ticketType === 'object' && 'name' in ticketType
        ? String(ticketType.name)
        : 'Ticket';

    const totalAmount = unitPrice * normalizedQuantity;
    const externalReference = randomUUID();

    // Idempotencia: si hay clave y ya existe resultado válido, devolverlo
    if (idempotencyKey) {
      const { data: existing, error: selectErr } = await supabase
        .from('idempotency_keys')
        .select('init_point, created_at')
        .eq('key', idempotencyKey)
        .single();

      if (!selectErr && existing) {
        const createdAt = new Date(existing.created_at).getTime();
        const ttlMs = IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000;
        if (existing.init_point && Date.now() - createdAt < ttlMs) {
          return NextResponse.json({ init_point: existing.init_point });
        }
        if (!existing.init_point) {
          return NextResponse.json(
            { error: 'Solicitud en curso. Reintentar más tarde.' },
            { status: 409 }
          );
        }
        if (Date.now() - createdAt >= ttlMs) {
          return NextResponse.json(
            { error: 'Clave de idempotencia expirada. Usar una nueva.' },
            { status: 410 }
          );
        }
      }

      // Reservar clave: insertar fila (falla si ya existe por otro request concurrente)
      const { error: insertKeyErr } = await supabase
        .from('idempotency_keys')
        .insert({ key: idempotencyKey });

      if (insertKeyErr?.code === '23505') {
        // Conflicto: otro request ya tiene la clave; esperar y devolver 409 o reintentar lógica no trivial
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

    const baseUrl = getBaseUrlFromRequest(
      request,
      process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl'
    );

    const eventsData = inventory.events;
    const event = Array.isArray(eventsData) ? eventsData[0] : eventsData;
    const eventName =
      event && typeof event === 'object' && 'name' in event
        ? String(event.name)
        : 'Festival Pucón 2026';

    let initPoint: string;
    try {
      const { preferenceClient } = requireMercadoPagoClient();
      const created = await preferenceClient.create({
        body: {
          items: [
            {
              id: ticket_type_id,
              title: `${ticketTypeName} - ${eventName} (x${normalizedQuantity})`,
              quantity: normalizedQuantity,
              unit_price: unitPrice,
              currency_id: 'CLP',
            },
          ],
          payer: { email: payer_email },
          payment_methods: {
            excluded_payment_types: [{ id: 'account_money' }],
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
      // Sandbox: con token TEST- usar sandbox_init_point; si no, init_point
      const accessToken = process.env.MP_ACCESS_TOKEN ?? '';
      const sandboxUrl =
        typeof (created as { sandbox_init_point?: string }).sandbox_init_point === 'string'
          ? (created as { sandbox_init_point: string }).sandbox_init_point.trim()
          : '';
      if (accessToken.startsWith('TEST-') && sandboxUrl.length > 0) {
        initPoint = sandboxUrl;
      } else if (typeof created.init_point === 'string' && created.init_point.trim().length > 0) {
        initPoint = created.init_point.trim();
      } else {
        throw new Error('Mercado Pago no devolvió init_point ni sandbox_init_point válido');
      }
    } catch (mpError) {
      console.error('Error al crear preferencia en Mercado Pago:', mpError);
      await supabase.from('orders').delete().eq('external_reference', externalReference);
      if (idempotencyKey) await supabase.from('idempotency_keys').delete().eq('key', idempotencyKey);
      return NextResponse.json(
        { error: 'Error al crear la sesión de pago. Reintentar más tarde.' },
        { status: 502 }
      );
    }

    if (idempotencyKey) {
      await supabase
        .from('idempotency_keys')
        .update({
          init_point: initPoint,
          external_reference: externalReference,
          created_at: new Date().toISOString(),
        })
        .eq('key', idempotencyKey);
    }

    return NextResponse.json({ init_point: initPoint });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error al crear preferencia de pago:', err.message, err.stack);
    // Pistas para errores de configuración en Vercel (Preview)
    if (err.message.includes('MP_ACCESS_TOKEN')) {
      return NextResponse.json(
        { error: 'MP_ACCESS_TOKEN no configurado. En Vercel → Settings → Environment Variables, añade MP_ACCESS_TOKEN (TEST-...) y aplica a Preview. Luego Redeploy.' },
        { status: 503 }
      );
    }
    if (err.message.includes('Supabase no está configurado')) {
      return NextResponse.json(
        { error: 'Supabase no configurado en este deployment. En Vercel → Environment Variables configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para Preview. Luego Redeploy.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Error al procesar la solicitud de pago' },
      { status: 500 }
    );
  }
}
