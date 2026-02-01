import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/** Verifica x-admin-key contra ADMIN_SECRET */
function verifyAdminKey(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const key = request.headers.get('x-admin-key');
  return key === secret;
}

/** GET: Lista event_days con daily_inventory, valores y ocupación % */
export async function GET(request: Request) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = requireSupabaseAdmin();

    const { data: eventDays, error: daysError } = await supabase
      .from('event_days')
      .select('id, event_date, event_id')
      .order('event_date', { ascending: true });

    if (daysError || !eventDays?.length) {
      return NextResponse.json(
        { error: daysError?.message ?? 'Sin fechas configuradas' },
        { status: daysError ? 500 : 200 }
      );
    }

    const { data: dailyRows, error: dailyError } = await supabase
      .from('daily_inventory')
      .select(`
        id,
        event_day_id,
        ticket_type_id,
        nominal_stock,
        price,
        fomo_threshold,
        overbooking_tolerance,
        ticket_types!inner(id, name)
      `);

    if (dailyError) {
      return NextResponse.json(
        { error: 'Error al cargar daily_inventory' },
        { status: 500 }
      );
    }

    const eventIds = [...new Set(eventDays.map((d) => d.event_id).filter(Boolean))] as string[];
    const { data: invRows } = await supabase
      .from('inventory')
      .select('id, event_id, ticket_type_id, total_capacity')
      .in('event_id', eventIds);

    const invByEventAndType = new Map<string, { id: string; total_capacity: number }>();
    for (const r of invRows || []) {
      invByEventAndType.set(`${r.event_id}|${r.ticket_type_id}`, {
        id: r.id,
        total_capacity: Number(r.total_capacity) || 0,
      });
    }

    const invIds = (invRows || []).map((r) => r.id);
    const { data: orders } = await supabase
      .from('orders')
      .select('inventory_id, quantity')
      .in('inventory_id', invIds)
      .in('status', ['pending', 'paid']);

    const soldByInvId = new Map<string, number>();
    for (const o of orders || []) {
      const id = String(o.inventory_id);
      const qty = Math.max(1, Number((o as { quantity?: number }).quantity) || 1);
      soldByInvId.set(id, (soldByInvId.get(id) || 0) + qty);
    }

    const dayById = new Map(eventDays.map((d) => [d.id, d]));

    type Row = (typeof dailyRows)[0];
    const items: Array<{
      id: string;
      event_date: string;
      ticket_type_name: string;
      ticket_type_id: string;
      nominal_stock: number;
      price: number;
      fomo_threshold: number;
      overbooking_tolerance: number;
      total_capacity: number;
      sold: number;
      available: number;
      occupied_pct: number;
    }> = [];

    for (const row of dailyRows || []) {
      const day = dayById.get(row.event_day_id);
      if (!day?.event_id) continue;

      const inv = invByEventAndType.get(`${day.event_id}|${row.ticket_type_id}`);
      if (!inv) continue;

      const ticketType = row.ticket_types;
      const name = Array.isArray(ticketType)
        ? (ticketType[0] as { name?: string })?.name
        : (ticketType as { name?: string })?.name;

      const sold = soldByInvId.get(inv.id) || 0;
      const totalCap = inv.total_capacity;
      const nominal = Number((row as Row).nominal_stock) || 0;
      const occupied_pct = nominal > 0 ? Math.min(100, Math.round((sold / nominal) * 100)) : 0;

      items.push({
        id: (row as Row).id,
        event_date: (day as { event_date: string }).event_date,
        ticket_type_name: name ?? 'Entrada',
        ticket_type_id: row.ticket_type_id,
        nominal_stock: nominal,
        price: Number((row as Row).price) || 0,
        fomo_threshold: Number((row as Row).fomo_threshold) || 0,
        overbooking_tolerance: Number((row as Row).overbooking_tolerance) || 0,
        total_capacity: totalCap,
        sold,
        available: Math.max(0, totalCap - sold),
        occupied_pct,
      });
    }

    return NextResponse.json({
      event_days: eventDays.map((d) => ({
        id: d.id,
        event_date: (d as { event_date: string }).event_date,
        event_id: d.event_id,
      })),
      items,
    });
  } catch (err) {
    console.error('GET /api/admin/inventory error:', err);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
