import { requireSupabaseAdmin } from '@/lib/supabase';
import { signTicket } from '@/lib/security/qr-signer';
import { verifyAccessToken } from '@/lib/security/access-token';
import { processApprovedOrder } from '@/lib/orders/process-approved-order';
import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MP_CACHE_TTL_MS = 15_000;
/** Caché en memoria para debounce de consultas a MP. Limitación: en Vercel (serverless) no persiste entre peticiones/instancias; solo "best effort" en warm starts. */
const mpStatusCache = new Map<string, { status: 'pending' | 'approved'; timestamp: number }>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Response: órdenes y tickets por external_reference; qr_token por ticket.id; buyer_email del comprador. pending=true si token válido pero órdenes aún no paid. */
export interface ByReferenceResponse {
  external_reference: string;
  buyer_email: string | null;
  /** true cuando no hay órdenes paid pero sí existe al menos una orden (pending) con ese external_reference */
  pending?: boolean;
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
    const limited = await checkRateLimit(ip, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);
    if (limited) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const paymentIdFromQuery = url.searchParams.get('payment_id')?.trim() || null;
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const verified = verifyAccessToken(token);
    if (!verified.ok || !verified.external_reference) {
      return NextResponse.json({ error: 'Token no válido o expirado' }, { status: 401 });
    }

    const externalReference = verified.external_reference;
    const supabase = requireSupabaseAdmin();

    const ordersQuery = () =>
      supabase
        .from('orders')
        .select(
          `
        id,
        status,
        user_email,
        inventory:inventory_id (
          event:event_id ( date, venue ),
          ticket_type:ticket_type_id ( id, name )
        )
      `
        )
        .eq('external_reference', externalReference)
        .eq('status', 'paid')
        .order('id', { ascending: true });

    const firstResult = await ordersQuery();
    const ordersError = firstResult.error;
    let orders = firstResult.data ?? [];

    if (ordersError) {
      console.error('GET /api/orders/by-reference orders error:', ordersError);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    if (!orders?.length) {
      const { data: anyOrder } = await supabase
        .from('orders')
        .select('id, user_email')
        .eq('external_reference', externalReference)
        .limit(1)
        .maybeSingle();

      if (!anyOrder) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      }

      const now = Date.now();
      const cached = mpStatusCache.get(externalReference);
      if (cached && now - cached.timestamp < MP_CACHE_TTL_MS && cached.status === 'pending') {
        return NextResponse.json({
          external_reference: externalReference,
          buyer_email: null,
          orders: [],
          pending: true,
        } satisfies ByReferenceResponse);
      }

      try {
        const { paymentClient } = requireMercadoPagoClient();
        type MpPayment = { id?: number | string; status?: string; external_reference?: string; payer?: { email?: string } };
        let first: MpPayment | null = null;

        const paymentIdNum = paymentIdFromQuery ? Number(paymentIdFromQuery) : NaN;
        if (Number.isFinite(paymentIdNum)) {
          try {
            const single = await paymentClient.get({ id: paymentIdNum });
            const p = single as MpPayment;
            if (p?.external_reference === externalReference && p?.status === 'approved') first = p;
          } catch {
            /* ignorar; seguir con búsqueda */
          }
        }

        if (!first) {
          const searchResult = await paymentClient.search({
            options: {
              external_reference: externalReference,
              sort: 'date_created',
              criteria: 'desc',
            },
          });
          const results = (searchResult as { results?: MpPayment[] })?.results ?? [];
          first = results.find((r) => r.status === 'approved') ?? null;
        }

        if (!first || first.status !== 'approved') {
          mpStatusCache.set(externalReference, { status: 'pending', timestamp: now });
          return NextResponse.json({
            external_reference: externalReference,
            buyer_email: null,
            orders: [],
            pending: true,
          } satisfies ByReferenceResponse);
        }

        const paymentId = String(first.id ?? '');
        let updatedRows: { id: string }[] | null = null;
        let updateErr: { code?: string } | null = null;

        const bulkResult = await supabase
          .from('orders')
          .update({ status: 'paid', mp_payment_id: paymentId })
          .eq('external_reference', externalReference)
          .eq('status', 'pending')
          .select('id');

        updateErr = bulkResult.error;
        updatedRows = bulkResult.data;

        // Si falla por UNIQUE(mp_payment_id) con varias órdenes, actualizar en dos pasos: todas a paid, luego una con mp_payment_id.
        if (updateErr?.code === '23505') {
          const { data: pendingOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('external_reference', externalReference)
            .eq('status', 'pending')
            .order('id', { ascending: true });

          if (pendingOrders?.length) {
            const ids = pendingOrders.map((o) => (o as { id: string }).id);
            await supabase
              .from('orders')
              .update({ status: 'paid' })
              .eq('external_reference', externalReference)
              .eq('status', 'pending');
            await supabase
              .from('orders')
              .update({ mp_payment_id: paymentId })
              .eq('id', ids[0]);
            updatedRows = pendingOrders as { id: string }[];
            updateErr = null;
          }
        }

        if (updateErr) {
          console.error('[by-reference] Fallback UPDATE error:', updateErr);
          mpStatusCache.set(externalReference, { status: 'pending', timestamp: now });
          return NextResponse.json({
            external_reference: externalReference,
            buyer_email: null,
            orders: [],
            pending: true,
          } satisfies ByReferenceResponse);
        }

        // Concurrency: solo si nosotros actualizamos al menos 1 fila (evita duplicar tickets si el webhook ganó la carrera).
        if (updatedRows?.length && updatedRows.length >= 1) {
          const email =
            first.payer?.email ??
            (anyOrder as { user_email?: string | null }).user_email ??
            '';
          await processApprovedOrder(externalReference, email);
        }

        const { data: ordersAfter } = await ordersQuery();
        orders = ordersAfter ?? [];
      } catch (e) {
        console.error('[by-reference] Fallback MP search error:', e);
        mpStatusCache.set(externalReference, { status: 'pending', timestamp: Date.now() });
        return NextResponse.json({
          external_reference: externalReference,
          buyer_email: null,
          orders: [],
          pending: true,
        } satisfies ByReferenceResponse);
      }
    }

    if (!orders?.length) {
      return NextResponse.json({
        external_reference: externalReference,
        buyer_email: null,
        orders: [],
        pending: true,
      } satisfies ByReferenceResponse);
    }

    const firstOrder = orders[0] as unknown as { user_email?: string | null };
    const byReferenceResponse: ByReferenceResponse = {
      external_reference: externalReference,
      buyer_email: firstOrder?.user_email ?? null,
      orders: [],
    };

    for (const order of orders) {
      const row = order as unknown as {
        id: string;
        status: string;
        inventory: {
          event: { date: string; venue: string };
          ticket_type: { id: string; name: string };
        };
      };

      const { data: ticketRows, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, qr_uuid')
        .eq('order_id', row.id)
        .order('created_at', { ascending: true });

      if (ticketsError) {
        console.error('GET /api/orders/by-reference tickets error:', ticketsError);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
      }

      const event = row.inventory?.event;
      const ticketType = row.inventory?.ticket_type;
      const venueDisplay =
        event?.venue?.replace(/Camping Pucón/g, 'Club de Rodeo Pucón') ?? event?.venue ?? '';
      const accessWindow =
        event && ticketType && typeof event.date === 'string' && venueDisplay
          ? `${new Date(event.date).toISOString().slice(0, 10)} ${venueDisplay}`
          : '';

      const tickets: ByReferenceResponse['orders'][0]['tickets'] = [];
      for (const t of ticketRows ?? []) {
        const ticket = t as { id: string; qr_uuid?: string | null };
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
