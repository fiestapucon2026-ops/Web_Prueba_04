import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

const WebhookBodySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

function parseXSignature(xSignature: string | null): { ts?: string; v1?: string } {
  if (!xSignature) return {};
  const parts = xSignature.split(',');
  const out: { ts?: string; v1?: string } = {};
  for (const p of parts) {
    const [k, v] = p.split('=').map((s) => s?.trim());
    if (k === 'ts') out.ts = v;
    if (k === 'v1') out.v1 = v;
  }
  return out;
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isTsWithinTolerance(tsRaw: string, toleranceSeconds = 300): boolean {
  // Docs show ts=1704908010 (seconds). Support seconds and ms.
  const tsNum = Number(tsRaw);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return false;
  const tsMs = tsRaw.length >= 13 ? tsNum : tsNum * 1000;
  const nowMs = Date.now();
  return Math.abs(nowMs - tsMs) <= toleranceSeconds * 1000;
}

function verifyMercadoPagoSignature(request: Request): { ok: boolean; reason?: string } {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, reason: 'MP_WEBHOOK_SECRET no configurado (obligatorio en producción)' };
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const { ts, v1 } = parseXSignature(xSignature);

  if (!xSignature || !xRequestId || !ts || !v1) {
    return { ok: false, reason: 'Headers de firma incompletos (x-signature/x-request-id)' };
  }

  if (!isTsWithinTolerance(ts)) {
    return { ok: false, reason: 'Timestamp fuera de tolerancia' };
  }

  // Mercado Pago: manifest template = id:[data.id_url];request-id:[x-request-id];ts:[ts];
  // data.id_url viene desde query param "data.id". Si no existe, se omite según docs.
  const url = new URL(request.url);
  const dataId = (url.searchParams.get('data.id') || '').toLowerCase();

  let manifest = '';
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  if (ts) manifest += `ts:${ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const ok = timingSafeEqualHex(expected, v1);
  return ok ? { ok: true } : { ok: false, reason: 'Firma inválida' };
}

export async function POST(request: Request) {
  try {
    // En producción la firma es obligatoria; sin secret no procesar
    if (!process.env.MP_WEBHOOK_SECRET) {
      console.error('❌ Webhook Mercado Pago: MP_WEBHOOK_SECRET no configurado');
      return NextResponse.json(
        { error: 'Webhook no configurado' },
        { status: 503 }
      );
    }
    const sig = verifyMercadoPagoSignature(request);
    if (!sig.ok) {
      console.error('❌ Webhook Mercado Pago: verificación de firma fallida:', sig.reason);
      return NextResponse.json({ status: 'invalid_signature' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = WebhookBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.warn('⚠️ Webhook Mercado Pago: body inválido');
      return NextResponse.json({ status: 'OK' }, { status: 200 });
    }
    const body = parsed.data;
    
    // Extraer ID y tipo del webhook
    const paymentId = body.data?.id || body.id;
    const eventType = body.type;

    if (!paymentId) {
      console.warn('⚠️ Webhook recibido sin ID de pago');
      return NextResponse.json({ status: 'OK' }, { status: 200 });
    }

    // VALIDACIÓN CRUZADA: Consultar payment directamente a Mercado Pago
    if (eventType === 'payment') {
      try {
        const { paymentClient } = requireMercadoPagoClient();
        const paymentIdNum = Number(paymentId);
        if (!Number.isFinite(paymentIdNum)) {
          console.warn('⚠️ paymentId inválido:', paymentId);
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }
        const payment = await paymentClient.get({ id: paymentIdNum });

        if (!payment.external_reference) {
          console.warn('⚠️ Payment sin external_reference');
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        const supabase = requireSupabaseClient();

        // IDEMPOTENCIA: Verificar si ya procesamos este payment_id
        const { data: existingOrders, error: existingOrderErr } = await supabase
          .from('orders')
          .select('id, status')
          .eq('mp_payment_id', String(paymentId))
          .limit(1);

        if (existingOrderErr) {
          console.error('Error al verificar idempotencia mp_payment_id:', existingOrderErr);
        }

        const existingOrder = existingOrders?.[0];
        if (existingOrder && existingOrder.status === 'paid') {
          console.log('✅ Pago ya procesado anteriormente:', paymentId);
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        // Buscar TODAS las órdenes con este external_reference (entradas puede tener main + parking + promo)
        const { data: orders, error: orderError } = await supabase
          .from('orders')
          .select('id, status, external_reference, quantity, inventory_id, user_email')
          .eq('external_reference', payment.external_reference)
          .order('id', { ascending: true });

        if (orderError || !orders?.length) {
          console.error('❌ Órdenes no encontradas:', payment.external_reference);
          return NextResponse.json({ status: 'OK' }, { status: 200 });
        }

        // Switch según estado del pago
        switch (payment.status) {
          case 'approved': {
            // Verificar si ya todas están pagadas
            const allPaid = orders.every((o) => o.status === 'paid');
            if (allPaid) {
              console.log('✅ Órdenes ya marcadas como pagadas:', payment.external_reference);
              return NextResponse.json({ status: 'OK' }, { status: 200 });
            }

            // Actualizar todas las órdenes de este pago a paid
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'paid',
                mp_payment_id: String(paymentId),
              })
              .eq('external_reference', payment.external_reference)
              .eq('status', 'pending');

            if (updateError) {
              console.error('❌ Error al actualizar órdenes:', updateError);
              return NextResponse.json({ status: 'OK' }, { status: 200 });
            }

            console.log(
              '✅ PAGO CONFIRMADO. external_reference:',
              payment.external_reference,
              'Órdenes:',
              orders.length,
              'Email:',
              payment.payer?.email || 'N/A'
            );

            // Crear filas en tickets (una por unidad): idempotente por order_id
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
              if (ticketsErr) console.error('❌ Error al crear tickets para orden:', orderId, ticketsErr);
            }

            // Encolar generación de PDF + email (worker procesa job_queue)
            const orderIds = orders.map((o) => o.id);
            const toEmail = payment.payer?.email ?? orders[0].user_email ?? '';
            if (!toEmail) {
              console.error('❌ Sin email para enviar (payer ni orders[0].user_email)');
              break;
            }
            const { error: jobErr } = await supabase.from('job_queue').insert({
              type: 'generate_ticket_pdf',
              payload: {
                external_reference: payment.external_reference,
                order_ids: orderIds,
                email: toEmail,
              },
              status: 'pending',
            });
            if (jobErr) {
              console.error('❌ Error al encolar job PDF+email:', jobErr);
            } else {
              console.log('✅ Job encolado para PDF+email:', payment.external_reference);
            }
            break;
          }

          case 'rejected': {
            await supabase
              .from('orders')
              .update({
                status: 'rejected',
                mp_payment_id: String(paymentId),
              })
              .eq('external_reference', payment.external_reference);

            console.log(
              '❌ PAGO RECHAZADO. Razón:',
              payment.status_detail,
              'external_reference:',
              payment.external_reference
            );
            break;
          }

          case 'pending': {
            await supabase
              .from('orders')
              .update({
                mp_payment_id: String(paymentId),
              })
              .eq('external_reference', payment.external_reference);

            console.log(
              '⏳ PAGO PENDIENTE. external_reference:',
              payment.external_reference,
              'Email:',
              payment.payer?.email || 'N/A'
            );
            break;
          }

          case 'cancelled': {
            await supabase
              .from('orders')
              .update({
                status: 'rejected',
                mp_payment_id: String(paymentId),
              })
              .eq('external_reference', payment.external_reference);

            console.log(
              '🚫 PAGO CANCELADO. external_reference:',
              payment.external_reference
            );
            break;
          }

          default: {
            console.log(
              'ℹ️ PAGO CON ESTADO:',
              payment.status,
              'Orden:',
              payment.external_reference
            );
            break;
          }
        }
      } catch (paymentError) {
        console.error('Error al consultar pago en Mercado Pago:', paymentError);
        // Retornamos OK igual para que Mercado Pago no reintente
        return NextResponse.json({ status: 'OK' }, { status: 200 });
      }
    }

    // Siempre retornar 200 para evitar reintentos de Mercado Pago
    return NextResponse.json({ status: 'OK' }, { status: 200 });

  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error);
    // Retornar 200 para evitar reintentos infinitos
    return NextResponse.json({ status: 'OK' }, { status: 200 });
  }
}
