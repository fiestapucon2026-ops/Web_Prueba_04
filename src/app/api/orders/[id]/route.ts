import { requireSupabaseAdmin } from '@/lib/supabase';
import { signTicket } from '@/lib/security/qr-signer';
import { NextResponse } from 'next/server';

/** Response type for GET /api/orders/[id]. QR token is generated at runtime per ticket.id. */
export interface OrderResponse {
  order_id: string;
  status: string;
  tickets: Array<{
    uuid: string;
    category: string;
    access_window: string;
    qr_token: string;
  }>;
}

interface OrderRow {
  id: string;
  status: string;
  inventory: {
    event: { date: string; venue: string };
    ticket_type: { id: string; name: string };
  };
}

interface TicketRow {
  id: string;
  qr_uuid?: string | null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    }

    const supabase = requireSupabaseAdmin();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
        id,
        status,
        inventory:inventory_id (
          event:event_id ( date, venue ),
          ticket_type:ticket_type_id ( id, name )
        )
      `
      )
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const row = order as unknown as OrderRow;
    const event = row.inventory?.event;
    const ticketType = row.inventory?.ticket_type;
    if (!event || !ticketType) {
      return NextResponse.json(
        { error: 'Order data incomplete (inventory/event/type)' },
        { status: 404 }
      );
    }

    const { data: ticketRows, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, qr_uuid')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (ticketsError) {
      console.error('GET /api/orders/[id] tickets error:', ticketsError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    const venueDisplay =
      event.venue?.replace(/Camping Pucón/g, 'Club de Rodeo Pucón') ?? event.venue ?? '';
    const accessWindow =
      typeof event.date === 'string' && venueDisplay
        ? `${new Date(event.date).toISOString().slice(0, 10)} ${venueDisplay}`
        : '';

    const tickets: OrderResponse['tickets'] = [];
    for (const t of ticketRows ?? []) {
      const ticket = t as unknown as TicketRow;
      try {
        const qrToken =
          ticket.qr_uuid != null && ticket.qr_uuid !== ''
            ? String(ticket.qr_uuid)
            : signTicket(ticket.id, ticketType.name);
        tickets.push({
          uuid: ticket.id,
          category: ticketType.name,
          access_window: accessWindow,
          qr_token: qrToken,
        });
      } catch (signError) {
        console.error('QR signing failed for ticket:', ticket.id, signError);
        return NextResponse.json(
          { error: 'Signing failed' },
          { status: 500 }
        );
      }
    }

    const response: OrderResponse = {
      order_id: row.id,
      status: row.status,
      tickets,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
