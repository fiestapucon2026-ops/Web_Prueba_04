import { requireSupabaseAdmin } from '@/lib/supabase';
import { signTicket } from '@/lib/security/qr-signer';
import { verifyAccessToken } from '@/lib/security/access-token';
import { NextResponse } from 'next/server';

const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_REQUESTS;
}

/** Response: órdenes y tickets por external_reference; qr_token por ticket.id */
export interface ByReferenceResponse {
  external_reference: string;
  orders: Array<{
    order_id: string;
    status: string;
    tickets: Array<{
      uuid: string;
      category: string;
      access_window: string;
      qr_token: string;
    }>;
  }>;
}

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const verified = verifyAccessToken(token);
    if (!verified.ok || !verified.external_reference) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const externalReference = verified.external_reference;
    const supabase = requireSupabaseAdmin();

    const { data: orders, error: ordersError } = await supabase
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
      .eq('external_reference', externalReference)
      .eq('status', 'paid')
      .order('id', { ascending: true });

    if (ordersError) {
      console.error('GET /api/orders/by-reference orders error:', ordersError);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    if (!orders?.length) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const byReferenceResponse: ByReferenceResponse = {
      external_reference: externalReference,
      orders: [],
    };

    for (const order of orders) {
      const row = order as {
        id: string;
        status: string;
        inventory: {
          event: { date: string; venue: string };
          ticket_type: { id: string; name: string };
        };
      };

      const { data: ticketRows, error: ticketsError } = await supabase
        .from('tickets')
        .select('id')
        .eq('order_id', row.id)
        .order('created_at', { ascending: true });

      if (ticketsError) {
        console.error('GET /api/orders/by-reference tickets error:', ticketsError);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
      }

      const event = row.inventory?.event;
      const ticketType = row.inventory?.ticket_type;
      const accessWindow =
        event && ticketType && typeof event.date === 'string' && event.venue
          ? `${new Date(event.date).toISOString().slice(0, 10)} ${event.venue}`
          : '';

      const tickets: ByReferenceResponse['orders'][0]['tickets'] = [];
      for (const t of ticketRows ?? []) {
        const ticket = t as { id: string };
        try {
          const qrToken = signTicket(ticket.id, ticketType.name);
          tickets.push({
            uuid: ticket.id,
            category: ticketType.name,
            access_window: accessWindow,
            qr_token: qrToken,
          });
        } catch (signError) {
          console.error('QR signing failed for ticket:', ticket.id, signError);
          return NextResponse.json({ error: 'Error interno' }, { status: 500 });
        }
      }

      byReferenceResponse.orders.push({
        order_id: row.id,
        status: row.status,
        tickets,
      });
    }

    return NextResponse.json(byReferenceResponse);
  } catch (error) {
    console.error('GET /api/orders/by-reference error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
