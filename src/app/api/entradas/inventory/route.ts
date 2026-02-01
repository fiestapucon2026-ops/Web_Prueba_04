import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface EntradasInventoryItem {
  ticket_type_id: string;
  name: string;
  price: number;
  nominal_stock: number;
  fomo_threshold: number;
  overbooking_tolerance: number;
  available_stock: number;
  total_capacity: number;
  occupied_pct: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date')?.trim();

    if (!date || !DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: 'Query "date" required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

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

    const { data: dailyRows, error: dailyError } = await supabase
      .from('daily_inventory')
      .select(`
        ticket_type_id,
        nominal_stock,
        price,
        fomo_threshold,
        overbooking_tolerance,
        ticket_types!inner(id, name)
      `)
      .eq('event_day_id', eventDay.id);

    if (dailyError || !dailyRows?.length) {
      return NextResponse.json(
        dailyError ? { error: 'Error al cargar inventario del día' } : { inventory: [] },
        { status: dailyError ? 500 : 200 }
      );
    }

    const { data: inventoryRows, error: invError } = await supabase
      .from('inventory')
      .select('id, ticket_type_id, total_capacity')
      .eq('event_id', eventId);

    if (invError || !inventoryRows?.length) {
      return NextResponse.json(
        { error: 'Error al cargar inventario del evento' },
        { status: 500 }
      );
    }

    const inventoryIds = inventoryRows.map((r) => r.id);
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('inventory_id')
      .in('inventory_id', inventoryIds)
      .in('status', ['pending', 'paid']);

    if (ordersError) {
      return NextResponse.json(
        { error: 'Error al calcular stock' },
        { status: 500 }
      );
    }

    const soldByInventoryId = new Map<string, number>();
    for (const o of orders || []) {
      const id = String(o.inventory_id);
      soldByInventoryId.set(id, (soldByInventoryId.get(id) || 0) + 1);
    }

    const invByTicketType = new Map(
      inventoryRows.map((r) => [
        r.ticket_type_id,
        { id: r.id, total_capacity: Number(r.total_capacity) || 0 },
      ])
    );

    const result: EntradasInventoryItem[] = [];

    for (const row of dailyRows) {
      const inv = invByTicketType.get(row.ticket_type_id);
      if (!inv) continue;

      const ticketType = row.ticket_types;
      const name = Array.isArray(ticketType) ? ticketType[0]?.name : (ticketType as { name?: string })?.name;
      const sold = soldByInventoryId.get(inv.id) || 0;
      const totalCap = inv.total_capacity;
      const available_stock = Math.max(0, totalCap - sold);
      const nominal_stock = Number(row.nominal_stock) || 0;
      const occupied_pct =
        nominal_stock > 0
          ? Math.min(100, Math.round((sold / nominal_stock) * 100))
          : 0;

      result.push({
        ticket_type_id: row.ticket_type_id,
        name: name ?? 'Entrada',
        price: Number(row.price) || 0,
        nominal_stock,
        fomo_threshold: Number(row.fomo_threshold) || 0,
        overbooking_tolerance: Number(row.overbooking_tolerance) || 0,
        available_stock,
        total_capacity: totalCap,
        occupied_pct,
      });
    }

    return NextResponse.json({ inventory: result });
  } catch (err) {
    console.error('GET /api/entradas/inventory error:', err);
    const message =
      process.env.NODE_ENV !== 'production' && err instanceof Error
        ? err.message
        : 'Error interno';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
