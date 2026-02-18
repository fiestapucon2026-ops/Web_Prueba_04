import { verifyAdminKey } from '@/lib/admin-auth';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { createAccessToken } from '@/lib/security/access-token';
import { generateTicketsPDF, type TicketItemForPDF } from '@/lib/pdf';
import type { OrderWithDetails } from '@/lib/types';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type GiftKind = 'entrada' | 'estacionamiento' | 'promo';

const BodySchema = z.object({
  date: z.string().regex(DATE_REGEX, 'date inválida'),
  kind: z.enum(['entrada', 'estacionamiento', 'promo']),
  quantity: z.number().int().min(1).max(100),
});

function classifyKind(name: string): GiftKind {
  const lower = name.toLowerCase();
  if (lower.includes('promo')) return 'promo';
  if (lower.includes('estacionamiento')) return 'estacionamiento';
  return 'entrada';
}

type DailyRow = {
  ticket_type_id: string;
  ticket_types: { name?: string } | Array<{ name?: string }>;
};

type InventoryRow = { id: string; ticket_type_id: string; total_capacity: number | string | null };
type OrderRow = { inventory_id: string; quantity?: number | null };

function getTicketTypeName(row: DailyRow): string {
  const t = row.ticket_types;
  if (Array.isArray(t)) return String(t[0]?.name || '');
  return String(t?.name || '');
}

export async function GET(request: Request) {
  const role = verifyAdminKey(request);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = (searchParams.get('date') || '').trim();
  if (!DATE_REGEX.test(date)) {
    return NextResponse.json({ error: 'Query "date" requerida (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = requireSupabaseAdmin();

  const { data: day, error: dayError } = await supabase
    .from('event_days')
    .select('id, event_id')
    .eq('event_date', date)
    .single();

  if (dayError || !day?.id || !day?.event_id) {
    return NextResponse.json({ error: 'No hay evento para esa fecha' }, { status: 404 });
  }

  const { data: dailyRows, error: dailyErr } = await supabase
    .from('daily_inventory')
    .select('ticket_type_id, ticket_types!inner(name)')
    .eq('event_day_id', day.id);
  if (dailyErr || !dailyRows?.length) {
    return NextResponse.json({ error: 'Sin inventario diario' }, { status: 404 });
  }

  const { data: invRows, error: invErr } = await supabase
    .from('inventory')
    .select('id, ticket_type_id, total_capacity')
    .eq('event_id', day.event_id);
  if (invErr || !invRows?.length) {
    return NextResponse.json({ error: 'Sin inventario base' }, { status: 404 });
  }

  const invByType = new Map<string, InventoryRow>();
  for (const inv of invRows as InventoryRow[]) {
    invByType.set(inv.ticket_type_id, inv);
  }

  const inventoryIds = (invRows as InventoryRow[]).map((r) => r.id);
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('inventory_id, quantity')
    .in('inventory_id', inventoryIds)
    .in('status', ['pending', 'paid']);
  if (ordersErr) {
    return NextResponse.json({ error: 'Error calculando stock disponible' }, { status: 500 });
  }

  const soldByInventory = new Map<string, number>();
  for (const o of (orders || []) as OrderRow[]) {
    const id = String(o.inventory_id);
    const qty = Math.max(1, Number(o.quantity) || 1);
    soldByInventory.set(id, (soldByInventory.get(id) || 0) + qty);
  }

  const options = (dailyRows as DailyRow[]).map((d) => {
    const inv = invByType.get(d.ticket_type_id);
    const name = getTicketTypeName(d);
    if (!inv) return null;
    const cap = Number(inv.total_capacity) || 0;
    const sold = soldByInventory.get(inv.id) || 0;
    return {
      kind: classifyKind(name),
      ticket_type_id: d.ticket_type_id,
      ticket_type_name: name,
      inventory_id: inv.id,
      available_stock: Math.max(0, cap - sold),
    };
  }).filter(Boolean);

  return NextResponse.json({ options });
}

export async function POST(request: Request) {
  const role = verifyAdminKey(request);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const { date, kind, quantity } = parsed.data;
  const supabase = requireSupabaseAdmin();

  const { data: day, error: dayError } = await supabase
    .from('event_days')
    .select('id, event_id')
    .eq('event_date', date)
    .single();

  if (dayError || !day?.id || !day?.event_id) {
    return NextResponse.json({ error: 'No hay evento para esa fecha' }, { status: 404 });
  }

  const { data: dailyRows, error: dailyErr } = await supabase
    .from('daily_inventory')
    .select('ticket_type_id, ticket_types!inner(name)')
    .eq('event_day_id', day.id);
  if (dailyErr || !dailyRows?.length) {
    return NextResponse.json({ error: 'No hay tipos de ticket para esa fecha' }, { status: 404 });
  }

  const { data: invRows, error: invErr } = await supabase
    .from('inventory')
    .select('id, ticket_type_id, total_capacity')
    .eq('event_id', day.event_id);
  if (invErr || !invRows?.length) {
    return NextResponse.json({ error: 'No hay inventario para esa fecha' }, { status: 404 });
  }

  const invByType = new Map<string, InventoryRow>();
  for (const inv of invRows as InventoryRow[]) {
    invByType.set(inv.ticket_type_id, inv);
  }

  const candidates = (dailyRows as DailyRow[])
    .map((d) => {
      const inv = invByType.get(d.ticket_type_id);
      if (!inv) return null;
      return {
        inventory_id: inv.id,
        ticket_type_name: getTicketTypeName(d),
      };
    })
    .filter((x): x is { inventory_id: string; ticket_type_name: string } => Boolean(x))
    .filter((x) => classifyKind(x.ticket_type_name) === kind);

  if (!candidates.length) {
    return NextResponse.json({ error: `No hay tipo de ticket para "${kind}" en esa fecha` }, { status: 404 });
  }

  const target = candidates[0];

  const { data: invData } = await supabase
    .from('inventory')
    .select('total_capacity')
    .eq('id', target.inventory_id)
    .single();

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('inventory_id, quantity')
    .eq('inventory_id', target.inventory_id)
    .in('status', ['pending', 'paid']);
  if (ordersErr) {
    return NextResponse.json({ error: 'No se pudo validar stock' }, { status: 500 });
  }

  const sold = ((orders || []) as OrderRow[]).reduce((acc, o) => acc + Math.max(1, Number(o.quantity) || 1), 0);
  const capacity = Number(invData?.total_capacity) || 0;
  const available = Math.max(0, capacity - sold);
  if (quantity > available) {
    return NextResponse.json(
      { error: `Stock insuficiente. Disponible actual: ${available}` },
      { status: 409 }
    );
  }

  const externalReference = randomUUID();
  const giftEmail = 'regalos@festivalpucon.cl';

  const { data: rpcResult, error: rpcError } = await supabase.rpc('create_orders_atomic', {
    p_external_reference: externalReference,
    p_user_email: giftEmail,
    p_items: [
      {
        inventory_id: target.inventory_id,
        quantity,
        amount: 0,
      },
    ],
  });

  if (rpcError) {
    return NextResponse.json({ error: 'No se pudo crear la orden de regalo' }, { status: 500 });
  }

  const result = rpcResult as { ok?: boolean; order_ids?: string[]; error?: string } | null;
  if (!result?.ok || !result.order_ids?.length) {
    return NextResponse.json({ error: result?.error || 'Error generando tickets regalo' }, { status: 500 });
  }

  const orderId = result.order_ids[0]!;

  const { error: orderPaidErr } = await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId);
  if (orderPaidErr) {
    return NextResponse.json({ error: 'Orden de regalo creada pero no pudo marcarse pagada' }, { status: 500 });
  }

  const ticketRows = Array.from({ length: quantity }, () => ({
    order_id: orderId,
    inventory_id: target.inventory_id,
    status: 'sold_unused' as const,
    discount_amount: 0,
  }));

  const { error: ticketsErr } = await supabase.from('tickets').insert(ticketRows);
  if (ticketsErr) {
    await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
    return NextResponse.json({ error: 'No se pudieron crear tickets regalo' }, { status: 500 });
  }

  const { error: jobErr } = await supabase.from('job_queue').insert({
    type: 'generate_ticket_pdf',
    payload: {
      external_reference: externalReference,
      order_ids: [orderId],
      email: giftEmail,
    },
    status: 'pending',
  });
  if (jobErr) {
    console.error('[gifts] Error al encolar PDF:', jobErr);
  }

  const accessToken = createAccessToken(externalReference);

  // Generar PDF de inmediato para que se pueda descargar sin depender del token/enlace
  let pdf_base64: string | null = null;
  try {
    const { data: orderRow, error: orderErr } = await supabase
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
      .eq('id', orderId)
      .single();

    if (!orderErr && orderRow?.inventory) {
      const ord = orderRow as unknown as {
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

      const { data: ticketList } = await supabase
        .from('tickets')
        .select('id, qr_uuid')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      const items: TicketItemForPDF[] = (ticketList ?? []).map((t) => {
        const ticket = t as { id: string; qr_uuid?: string | null };
        return {
          order: orderWithDetails,
          ticketId: ticket.id,
          qr_uuid: ticket.qr_uuid ?? undefined,
        };
      });

      if (items.length > 0) {
        const pdfBuffer = await generateTicketsPDF(items);
        pdf_base64 = Buffer.from(pdfBuffer).toString('base64');
      }
    }
  } catch (pdfError) {
    console.error('[gifts] Error generando PDF inmediato:', pdfError);
  }

  return NextResponse.json({
    ok: true,
    message: 'Tickets regalo creados. Puedes verlos o descargar PDF abajo.',
    created: quantity,
    kind,
    date,
    ticket_type_name: target.ticket_type_name,
    external_reference: externalReference,
    access_token: accessToken,
    pdf_base64: pdf_base64 ?? undefined,
  });
}
