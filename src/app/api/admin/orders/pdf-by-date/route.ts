import { requireSupabaseAdmin } from '@/lib/supabase';
import { verifyAdminKey } from '@/lib/admin-auth';
import { generateTicketsPDF, type TicketItemForPDF } from '@/lib/pdf';
import type { OrderWithDetails } from '@/lib/types';
import { NextResponse } from 'next/server';

/** Máximo de tickets por solicitud para no superar ~4.5 MB de respuesta en Vercel. */
const MAX_TICKETS_PER_REQUEST = 50;

/**
 * Parsea date en formato YYYY-MM-DD y devuelve inicio y fin del día en America/Santiago (UTC-3).
 * Sin dependencias externas: asume offset -3 para Chile (horario de verano típico).
 */
function getDayBoundsSantiago(dateStr: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const y = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10) - 1;
  const d = parseInt(match[3]!, 10);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  // Medianoche inicio del día en Santiago (UTC-3) = 03:00 UTC
  const start = new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
  if (start.getUTCFullYear() !== y || start.getUTCMonth() !== m || start.getUTCDate() !== d) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const role = verifyAdminKey(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    if (!dateParam || typeof dateParam !== 'string') {
      return NextResponse.json({ error: 'Parámetro date requerido (YYYY-MM-DD)' }, { status: 400 });
    }

    const bounds = getDayBoundsSantiago(dateParam.trim());
    if (!bounds) {
      return NextResponse.json(
        { error: 'Fecha inválida. Use formato YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const todayStart = getDayBoundsSantiago(new Date().toISOString().slice(0, 10));
    if (todayStart && bounds.start > todayStart.end) {
      return NextResponse.json(
        { error: 'No se puede exportar un día futuro.' },
        { status: 400 }
      );
    }

    const supabase = requireSupabaseAdmin();

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(
        `
        id,
        external_reference,
        inventory_id,
        user_email,
        amount,
        status,
        created_at,
        inventory:inventory_id (
          id,
          event_id,
          ticket_type_id,
          total_capacity,
          event:event_id ( id, name, date, venue ),
          ticket_type:ticket_type_id ( id, name, price )
        )
      `
      )
      .eq('status', 'paid')
      .gte('created_at', bounds.start.toISOString())
      .lt('created_at', bounds.end.toISOString())
      .order('id', { ascending: true });

    if (ordersError) {
      console.error('GET /api/admin/orders/pdf-by-date orders error:', ordersError);
      return NextResponse.json({ error: 'Error al consultar órdenes' }, { status: 500 });
    }

    if (!orders?.length) {
      return NextResponse.json(
        { error: 'No hay órdenes pagadas para esa fecha.' },
        { status: 404 }
      );
    }

    const orderIds = orders.map((o) => (o as { id: string }).id);
    const { count: totalTickets, error: countError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .in('order_id', orderIds);

    if (countError) {
      console.error('GET /api/admin/orders/pdf-by-date count error:', countError);
      return NextResponse.json({ error: 'Error al contar tickets' }, { status: 500 });
    }

    if ((totalTickets ?? 0) > MAX_TICKETS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Demasiados tickets para ese día (${totalTickets}). Máximo permitido: ${MAX_TICKETS_PER_REQUEST}. Use un rango de fechas más corto o exporte por tramos.`,
        },
        { status: 413 }
      );
    }

    const items: TicketItemForPDF[] = [];
    type OrderRow = {
      id: string;
      external_reference: string;
      inventory_id: string;
      user_email: string;
      amount: number;
      status: string;
      created_at: string;
      inventory: {
        id: string;
        event_id: string;
        ticket_type_id: string;
        total_capacity: number;
        event: { id: string; name: string; date: string; venue: string };
        ticket_type: { id: string; name: string; price: number };
      };
    };

    for (const order of orders) {
      const ord = order as unknown as OrderRow;

      const orderWithDetails: OrderWithDetails = {
        id: ord.id,
        external_reference: ord.external_reference,
        inventory_id: ord.inventory_id,
        user_email: ord.user_email,
        amount: ord.amount,
        status: ord.status as 'pending' | 'paid' | 'rejected',
        mp_payment_id: null,
        created_at: new Date(ord.created_at),
        inventory: {
          id: ord.inventory.id,
          event_id: ord.inventory.event_id,
          ticket_type_id: ord.inventory.ticket_type_id,
          total_capacity: ord.inventory.total_capacity,
          event: {
            id: ord.inventory.event.id,
            name: ord.inventory.event.name,
            date: new Date(ord.inventory.event.date),
            venue: ord.inventory.event.venue,
          },
          ticket_type: {
            id: ord.inventory.ticket_type.id,
            name: ord.inventory.ticket_type.name,
            price: ord.inventory.ticket_type.price,
          },
        },
      };

      const { data: ticketRows } = await supabase
        .from('tickets')
        .select('id, qr_uuid')
        .eq('order_id', ord.id)
        .order('created_at', { ascending: true });

      for (const t of ticketRows ?? []) {
        const ticket = t as { id: string; qr_uuid?: string | null };
        items.push({
          order: orderWithDetails,
          ticketId: ticket.id,
          qr_uuid: ticket.qr_uuid ?? undefined,
        });
      }
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No hay tickets para esa fecha.' },
        { status: 404 }
      );
    }

    const pdfBuffer = await generateTicketsPDF(items);

    const filename = `tickets-${dateParam}.pdf`;
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/orders/pdf-by-date error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
