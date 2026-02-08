import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { getBaseUrlFromRequest } from '@/lib/base-url';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({
  external_reference: z.string().uuid(),
  token: z.string().min(1),
  payment_method_id: z.string().optional(),
  payer_email: z.string().email(),
});

/**
 * POST /api/orders/create-payment
 * Crea un pago en MP (Payments API) con el token del Brick.
 * No se debe loguear el body (contiene token).
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { external_reference, token, payment_method_id, payer_email } = parsed.data;
    const supabase = requireSupabaseAdmin();
    const baseUrl = getBaseUrlFromRequest(
      request,
      process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl'
    );
    const baseUrlTrimmed = baseUrl.trim().replace(/\/$/, '');
    const isLocalRequest =
      !baseUrlTrimmed.startsWith('https://') ||
      baseUrlTrimmed.includes('localhost') ||
      /127\.0\.0\.1/.test(baseUrlTrimmed);
    const mpBaseUrl = isLocalRequest
      ? (process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://www.festivalpucon.cl').replace(/\/$/, '')
      : baseUrlTrimmed;

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, status, amount')
      .eq('external_reference', external_reference);

    if (ordersErr || !orders?.length) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const allPending = orders.every((o) => (o as { status?: string }).status === 'pending');
    if (!allPending) {
      const paid = orders.find((o) => (o as { status?: string }).status === 'paid');
      if (paid) {
        return NextResponse.json({
          status: 'approved',
          redirect_url: `${mpBaseUrl}/success?external_reference=${external_reference}`,
        });
      }
      return NextResponse.json(
        { error: 'Orden no disponible para pago' },
        { status: 400 }
      );
    }

    const transactionAmount = orders.reduce(
      (sum, o) => sum + Number((o as { amount?: number }).amount ?? 0),
      0
    );
    if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
      return NextResponse.json(
        { error: 'Monto inválido' },
        { status: 400 }
      );
    }

    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('idempotency_keys')
        .select('response_body')
        .eq('key', `pay_${external_reference}_${idempotencyKey}`)
        .single();
      const stored = existing?.response_body as { status?: string; redirect_url?: string } | undefined;
      if (stored?.redirect_url) {
        return NextResponse.json({
          status: stored.status ?? 'approved',
          redirect_url: stored.redirect_url,
        });
      }
    }

    const { paymentClient } = requireMercadoPagoClient();

    const paymentBody = {
      transaction_amount: Math.round(transactionAmount),
      token,
      payment_method_id: payment_method_id ?? 'visa',
      payer: { email: payer_email },
      external_reference,
      notification_url: `${mpBaseUrl}/api/webhooks/mercadopago`,
      installments: 1,
      statement_descriptor: 'FESTIVAL PUCON',
    };

    const created = await paymentClient.create({ body: paymentBody });

    const status = (created as { status?: string }).status ?? 'unknown';
    const paymentId = (created as { id?: number }).id;

    let redirectUrl: string;
    if (status === 'approved') {
      redirectUrl = `${mpBaseUrl}/success?external_reference=${external_reference}`;
    } else if (status === 'pending' || status === 'in_process') {
      redirectUrl = `${mpBaseUrl}/pending?external_reference=${external_reference}`;
    } else {
      redirectUrl = `${mpBaseUrl}/failure?external_reference=${external_reference}`;
    }

    if (idempotencyKey) {
      await supabase.from('idempotency_keys').insert({
        key: `pay_${external_reference}_${idempotencyKey}`,
        response_body: { status, redirect_url: redirectUrl },
      });
    }

    return NextResponse.json({
      status,
      payment_id: paymentId,
      redirect_url: redirectUrl,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('POST /api/orders/create-payment error:', err.message);
    return NextResponse.json(
      { error: 'Error al procesar el pago. Reintentar más tarde.' },
      { status: 502 }
    );
  }
}
