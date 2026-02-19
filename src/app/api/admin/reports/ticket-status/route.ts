import { verifyAdminKey } from '@/lib/admin-auth';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** GET: Listado de tickets con estado (sold_unused | used). Filtro opcional por fecha de evento (YYYY-MM-DD). Solo admin. */
export async function GET(request: Request) {
  const role = verifyAdminKey(request);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date')?.trim();

    const supabase = requireSupabaseAdmin();

    let query = supabase
      .from('tickets')
      .select(
        `
        id,
        order_id,
        inventory_id,
        status,
        scanned_at,
        created_at,
        inventory:inventory_id (
          event:event_id ( id, name, date ),
          ticket_type:ticket_type_id ( id, name )
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(500);

    const { data: tickets, error } = await query;

    if (error) {
      console.error('GET /api/admin/reports/ticket-status error:', error);
      return NextResponse.json({ error: 'Error al cargar tickets' }, { status: 500 });
    }

    const invIds = [...new Set((tickets ?? []).map((t) => (t as { inventory_id: string }).inventory_id))];
    const { data: eventsByInv } = await supabase
      .from('inventory')
      .select('id, event_id')
      .in('id', invIds);
    const invToEventId = new Map((eventsByInv ?? []).map((e) => [(e as { id: string }).id, (e as { event_id: string }).event_id]));
    const eventIds = [...new Set(invToEventId.values())];
    const { data: eventRows } = await supabase
      .from('events')
      .select('id, date')
      .in('id', eventIds);
    const eventDateById = new Map((eventRows ?? []).map((e) => [(e as { id: string }).id, (e as { date: string }).date]));

    type Row = {
      id: string;
      order_id: string;
      inventory_id: string;
      status: string;
      scanned_at: string | null;
      created_at: string;
      inventory: { event: { id: string; name: string; date: string }; ticket_type: { id: string; name: string } } | { event: Array<{ id: string; name: string; date: string }>; ticket_type: Array<{ id: string; name: string }> };
    };

    const eventDateStr = (invId: string) => {
      const eid = invToEventId.get(invId);
      if (!eid) return null;
      const d = eventDateById.get(eid);
      return d ? (d as string).slice(0, 10) : null;
    };

    let rows = (tickets ?? []).map((t) => {
      const r = t as unknown as Row;
      const inv = r.inventory;
      const event = Array.isArray(inv?.event) ? inv?.event?.[0] : inv?.event;
      const ticketType = Array.isArray(inv?.ticket_type) ? inv?.ticket_type?.[0] : inv?.ticket_type;
      const eventDate = event?.date ? (event.date as string).slice(0, 10) : eventDateStr(r.inventory_id);
      return {
        id: r.id,
        order_id: r.order_id,
        status: r.status,
        scanned_at: r.scanned_at,
        created_at: r.created_at,
        event_date: eventDate,
        event_name: event?.name ?? '',
        ticket_type_name: ticketType?.name ?? '',
      };
    });

    if (dateParam && DATE_REGEX.test(dateParam)) {
      rows = rows.filter((r) => r.event_date === dateParam);
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      total: rows.length,
      tickets: rows,
    });
  } catch (e) {
    console.error('GET /api/admin/reports/ticket-status error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
