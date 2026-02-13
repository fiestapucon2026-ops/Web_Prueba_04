import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const ROCK_DATE = '2026-02-20';
const ROCK_TICKET_TYPE_NAMES = new Set(['Tickets', 'Estacionamiento', 'Promo']);

export interface RockLegendsInventoryItem {
  ticket_type_id: string;
  name: string;
  price: number;
  nominal_stock: number;
  available_stock: number;
  total_capacity: number;
}

export async function GET() {
  try {
    const supabase = requireSupabaseAdmin();

    const { data: eventDay, error: dayError } = await supabase
      .from('event_days')
      .select('id, event_id')
      .eq('event_date', ROCK_DATE)
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
        { error: 'event_day sin event_id' },
        { status: 503 }
      );
    }

    const { data: dailyRows, error: dailyError } = await supabase
      .from('daily_inventory')
      .select(`
        ticket_type_id,
        nominal_stock,
        price,
        ticket_types!inner(id, name)
      `)
      .eq('event_day_id', eventDay.id);

    if (dailyError || !dailyRows?.length) {
      return NextResponse.json(
        dailyError ? { error: 'Error al cargar inventario' } : { inventory: [] },
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

    const { data: orders } = await supabase
      .from('orders')
      .select('inventory_id')
      .in('inventory_id', inventoryRows.map((r) => r.id))
      .in('status', ['pending', 'paid']);

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

    const result: RockLegendsInventoryItem[] = [];

    for (const row of dailyRows) {
      const inv = invByTicketType.get(row.ticket_type_id);
      if (!inv) continue;

      const ticketType = row.ticket_types;
      const name = Array.isArray(ticketType) ? ticketType[0]?.name : (ticketType as { name?: string })?.name;
      if (!name || !ROCK_TICKET_TYPE_NAMES.has(name)) continue;

      const sold = soldByInventoryId.get(inv.id) || 0;
      const totalCap = inv.total_capacity;
      const available_stock = Math.max(0, totalCap - sold);

      result.push({
        ticket_type_id: row.ticket_type_id,
        name,
        price: Number(row.price) || 0,
        nominal_stock: Number(row.nominal_stock) || 0,
        available_stock,
        total_capacity: totalCap,
      });
    }

    return NextResponse.json({ inventory: result, date: ROCK_DATE });
  } catch (err) {
    console.error('GET /api/entradas-rock/inventory error:', err);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
