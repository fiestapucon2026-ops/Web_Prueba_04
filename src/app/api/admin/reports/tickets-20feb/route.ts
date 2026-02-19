import { verifyAdminKey } from '@/lib/admin-auth';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const EVENT_DATE = '2026-02-20';

type Category = 'Entrada' | 'Estacionamiento' | 'PROMO';

function categoryFromTypeName(name: string): Category {
  const n = name.toLowerCase();
  if (n.includes('estac') || n.includes('estacionamiento')) return 'Estacionamiento';
  if (n.includes('promo')) return 'PROMO';
  return 'Entrada';
}

/** GET: Informe de tickets vendidos y regalados para el 20 de febrero. Solo lectura, solo admin. */
export async function GET(request: Request) {
  const role = verifyAdminKey(request);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = requireSupabaseAdmin();

    const { data: day, error: dayErr } = await supabase
      .from('event_days')
      .select('id, event_id')
      .eq('event_date', EVENT_DATE)
      .single();

    if (dayErr || !day?.event_id) {
      return NextResponse.json(
        { error: 'No hay evento para la fecha 2026-02-20' },
        { status: 404 }
      );
    }

    const eventId = (day as { event_id: string }).event_id;

    const { data: invRows, error: invErr } = await supabase
      .from('inventory')
      .select('id, ticket_type_id, ticket_type:ticket_types(name)')
      .eq('event_id', eventId);

    if (invErr || !invRows?.length) {
      return NextResponse.json(
        { error: 'Sin inventario para esa fecha' },
        { status: 404 }
      );
    }

    const invIds = (invRows as { id: string }[]).map((r) => r.id);
    const invToTypeName = new Map<string, string>();
    for (const r of invRows as { id: string; ticket_type_id: string; ticket_type: { name?: string } | Array<{ name?: string }> }[]) {
      const tt = r.ticket_type;
      const name = Array.isArray(tt) ? tt[0]?.name : tt?.name;
      invToTypeName.set(r.id, name ?? 'Entrada');
    }

    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('id, inventory_id, amount, quantity')
      .in('inventory_id', invIds)
      .eq('status', 'paid');

    if (ordErr) {
      return NextResponse.json({ error: 'Error al cargar órdenes' }, { status: 500 });
    }

    const { data: ticketRows, error: tickErr } = await supabase
      .from('tickets')
      .select('id, order_id, inventory_id')
      .in('order_id', (orders ?? []).map((o) => (o as { id: string }).id));

    if (tickErr) {
      return NextResponse.json({ error: 'Error al cargar tickets' }, { status: 500 });
    }

    const orderById = new Map((orders ?? []).map((o) => [(o as { id: string }).id, o as { inventory_id: string; amount: number; quantity: number }]));
    const byCategory = new Map<Category, { vendidos: number; regalados: number; valorizado: number }>();
    byCategory.set('Entrada', { vendidos: 0, regalados: 0, valorizado: 0 });
    byCategory.set('Estacionamiento', { vendidos: 0, regalados: 0, valorizado: 0 });
    byCategory.set('PROMO', { vendidos: 0, regalados: 0, valorizado: 0 });

    for (const t of ticketRows ?? []) {
      const ticket = t as { order_id: string; inventory_id: string };
      const order = orderById.get(ticket.order_id);
      if (!order) continue;
      const typeName = invToTypeName.get(ticket.inventory_id) ?? 'Entrada';
      const cat = categoryFromTypeName(typeName);
      const rec = byCategory.get(cat)!;
      const isRegalo = Number(order.amount) === 0;
      if (isRegalo) {
        rec.regalados += 1;
      } else {
        rec.vendidos += 1;
        rec.valorizado += Number(order.amount) / Math.max(1, order.quantity);
      }
    }

    const rows: Array<{ tipo: Category; vendidos: number; regalados: number; valorizado: number }> = [
      { tipo: 'Entrada', ...byCategory.get('Entrada')! },
      { tipo: 'Estacionamiento', ...byCategory.get('Estacionamiento')! },
      { tipo: 'PROMO', ...byCategory.get('PROMO')! },
    ];

    const totalVendidos = rows.reduce((a, r) => a + r.vendidos, 0);
    const totalRegalados = rows.reduce((a, r) => a + r.regalados, 0);
    const totalValorizado = rows.reduce((a, r) => a + r.valorizado, 0);

    return NextResponse.json({
      event_date: EVENT_DATE,
      event_label: '20 de febrero de 2026',
      generated_at: new Date().toISOString(),
      by_type: rows,
      total_vendidos: totalVendidos,
      total_regalados: totalRegalados,
      total_valorizado: Math.round(totalValorizado),
    });
  } catch (e) {
    console.error('GET /api/admin/reports/tickets-20feb error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
