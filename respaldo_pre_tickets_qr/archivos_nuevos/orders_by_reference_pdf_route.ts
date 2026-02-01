import { requireSupabaseAdmin } from '@/lib/supabase';
import { verifyAccessToken } from '@/lib/security/access-token';
import { generateTicketsPDF, type TicketItemForPDF } from '@/lib/pdf';
import type { OrderWithDetails } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
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
      .eq('external_reference', externalReference)
      .eq('status', 'paid')
      .order('id', { ascending: true });

    if (ordersError || !orders?.length) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    const items: TicketItemForPDF[] = [];

    for (const order of orders) {
      const ord = order as {
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
        .select('id')
        .eq('order_id', ord.id)
        .order('created_at', { ascending: true });

      for (const t of ticketRows ?? []) {
        const ticket = t as { id: string };
        items.push({ order: orderWithDetails, ticketId: ticket.id });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No hay tickets' }, { status: 404 });
    }

    const pdfBuffer = await generateTicketsPDF(items);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="entradas-${externalReference.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('GET /api/orders/by-reference/pdf error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
