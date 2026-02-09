import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { processApprovedOrder } from '@/lib/orders/process-approved-order';
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

function isTsWithinTolerance(tsRaw: string, toleranceSeconds = 600): boolean {
  // MP docs: ts puede ser segundos (ej. 1704908010) o ms. Tolerancia 10 min para latencia/reintentos.
  const tsNum = Number(tsRaw);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return false;
  const tsMs = tsRaw.length >= 13 ? tsNum : tsNum * 1000;
  const nowMs = Date.now();
  return Math.abs(nowMs - tsMs) <= toleranceSeconds * 1000;
}

function buildManifest(dataId: string, xRequestId: string, ts: string): string {
  let manifest = '';
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  if (ts) manifest += `ts:${ts};`;
  return manifest;
}

function verifyMercadoPagoSignature(
  request: Request,
  dataIdFromBody?: string | number | null
): { ok: boolean; reason?: string } {
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

  const url = new URL(request.url);
  const dataIdQuery = (url.searchParams.get('data.id') ?? '').trim();
  const dataIdBodyRaw =
    dataIdFromBody !== undefined && dataIdFromBody !== null ? String(dataIdFromBody).trim() : '';
  const dataIdRaw = dataIdQuery || dataIdBodyRaw;
  const dataIdLower = dataIdRaw.toLowerCase();

  // MP: "if data.id is alphanumeric, it must be sent in lowercase". Probar ambas variantes.
  const candidates = dataIdRaw ? [dataIdRaw, dataIdLower] : [''];
  for (const dataId of candidates) {
    const manifest = buildManifest(dataId, xRequestId, ts);
    if (!manifest) continue;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    if (timingSafeEqualHex(expected, v1)) return { ok: true };
  }

  return { ok: false, reason: 'Firma inválida' };
}

export async function POST(request: Request) {
  try {
    // Log de diagnóstico: confirmar si llegan notificaciones (ver en Vercel Logs)
    const url = new URL(request.url);
    const queryDataId = url.searchParams.get('data.id');
    console.log(
      '[webhook-mp] POST recibido',
      'url_query_data.id=',
      queryDataId ?? '(vacío)',
      'x-signature=',
      request.headers.get('x-signature') ? 'presente' : 'ausente',
      'x-request-id=',
      request.headers.get('x-request-id') ? 'presente' : 'ausente'
    );

    // En producción la firma es obligatoria; sin secret no procesar
    if (!process.env.MP_WEBHOOK_SECRET) {
      console.error('❌ Webhook Mercado Pago: MP_WEBHOOK_SECRET no configurado');
      return NextResponse.json(
        { error: 'Webhook no configurado' },
        { status: 503 }
      );
    }

    const rawBody = await request.json();
    const parsed = WebhookBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.warn('⚠️ Webhook Mercado Pago: body inválido');
      return NextResponse.json({ status: 'OK' }, { status: 200 });
    }
    const body = parsed.data;

    // Extraer ID y tipo del webhook (para firma: query o body; MP puede enviar en cualquiera)
    const paymentId = body.data?.id ?? body.id;
    const eventType = body.type;

    // Payload oficial de "prueba" del panel MP: no envía headers de firma válidos; aceptar y devolver 200.
    const isMpTestPayload =
      (String(body.data?.id ?? body.id ?? '') === '123456' &&
        (body as { date_created?: string }).date_created?.includes?.('2021-11-01')) ||
      (body.type === 'payment' && String(body.data?.id ?? body.id ?? '') === '123456');
    if (isMpTestPayload) {
      console.log('[webhook-mp] Prueba oficial del panel MP recibida; respondiendo 200 sin procesar.');
      return NextResponse.json({ status: 'OK' }, { status: 200 });
    }

    // Debug: log para comparar con documentación MP (no loguear secret ni HMAC)
    const xSignatureHeader = request.headers.get('x-signature');
    const xRequestIdHeader = request.headers.get('x-request-id');
    const dataIdFromUrl = url.searchParams.get('data.id') ?? '';
    const dataIdFromBodyVal =
      paymentId !== undefined && paymentId !== null ? String(paymentId).toLowerCase() : '';
    const { ts: tsParsed } = parseXSignature(xSignatureHeader);
    const dataIdUsed = (dataIdFromUrl || dataIdFromBodyVal).toLowerCase();
    let manifestForLog = '';
    if (dataIdUsed) manifestForLog += `id:${dataIdUsed};`;
    if (xRequestIdHeader) manifestForLog += `request-id:${xRequestIdHeader};`;
    if (tsParsed) manifestForLog += `ts:${tsParsed};`;
    console.log('[webhook-mp] data.id usado desde:', dataIdFromUrl ? 'query' : dataIdFromBodyVal ? 'body' : 'ninguno');
    console.log('[Manifest Debug] |' + (manifestForLog || '(vacío)') + '|');

    const sig = verifyMercadoPagoSignature(request, paymentId);
    if (!sig.ok) {
      console.error('❌ Webhook Mercado Pago: verificación de firma fallida:', sig.reason);
      try {
        const supabase = requireSupabaseAdmin();
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? request.headers.get('x-real-ip') ?? null;
        await supabase.from('audit_log').insert({
          event_type: 'webhook_mp_signature_failed',
          payload: { reason: sig.reason, has_payment_id: Boolean(paymentId) },
          ip_or_origin: ip,
        });
      } catch (auditErr) {
        console.error('Error al escribir audit_log:', auditErr);
      }
      return NextResponse.json({ status: 'invalid_signature' }, { status: 401 });
    }

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

        const supabase = requireSupabaseAdmin();

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

            const toEmail = payment.payer?.email ?? (orders[0] as { user_email?: string | null }).user_email ?? '';
            const result = await processApprovedOrder(payment.external_reference, toEmail);
            if (!result.ok) {
              console.error('❌ processApprovedOrder falló:', result.error);
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
              '⏳ PAGO PENDIENTE (webhook recibido; MP puede reenviar cuando pase a approved). external_reference:',
              payment.external_reference,
              'payment_id:',
              paymentId
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
