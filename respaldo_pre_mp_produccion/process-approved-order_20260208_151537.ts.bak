import { requireSupabaseAdmin } from '@/lib/supabase';

/**
 * Crea tickets (idempotente por order_id) y encola job de PDF+email para órdenes ya marcadas como paid.
 * Usado por el webhook de MP y por el fallback en by-reference.
 * No hace UPDATE de órdenes ni llama a la API de MP.
 */
export async function processApprovedOrder(
  externalReference: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = requireSupabaseAdmin();

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, quantity, inventory_id, user_email')
    .eq('external_reference', externalReference)
    .eq('status', 'paid')
    .order('id', { ascending: true });

  if (orderError) {
    console.error('[processApprovedOrder] Error al leer órdenes:', orderError);
    return { ok: false, error: orderError.message };
  }

  if (!orders?.length) {
    console.warn('[processApprovedOrder] No hay órdenes paid para:', externalReference);
    return { ok: true };
  }

  const toEmail = email || (orders[0] as { user_email?: string | null }).user_email || '';
  if (!toEmail) {
    console.error('[processApprovedOrder] Sin email para external_reference:', externalReference);
    return { ok: false, error: 'Sin email' };
  }

  for (const order of orders) {
    const orderId = order.id;
    const inventoryId = order.inventory_id;
    const qty = Math.max(1, Number(order.quantity) || 1);
    if (!inventoryId) continue;

    const { count: existingTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    if (existingTickets && existingTickets > 0) continue;

    const ticketRows = Array.from({ length: qty }, () => ({
      order_id: orderId,
      inventory_id: inventoryId,
      status: 'sold_unused' as const,
      discount_amount: 0,
    }));

    const { error: ticketsErr } = await supabase.from('tickets').insert(ticketRows);
    if (ticketsErr) {
      console.error('[processApprovedOrder] Error al crear tickets para orden:', orderId, ticketsErr);
      return { ok: false, error: ticketsErr.message };
    }
  }

  const orderIds = orders.map((o) => o.id);
  const { error: jobErr } = await supabase.from('job_queue').insert({
    type: 'generate_ticket_pdf',
    payload: {
      external_reference: externalReference,
      order_ids: orderIds,
      email: toEmail,
    },
    status: 'pending',
  });

  if (jobErr) {
    console.error('[processApprovedOrder] Error al encolar job:', jobErr);
    return { ok: false, error: jobErr.message };
  }

  console.log('[processApprovedOrder] OK:', externalReference, 'orders:', orderIds.length);
  return { ok: true };
}
