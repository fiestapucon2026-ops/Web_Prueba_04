import { requireSupabaseAdmin } from '@/lib/supabase';
import { parsePaymentDataToken } from '@/lib/security/payment-data-token';
import { NextResponse } from 'next/server';

/**
 * GET /api/orders/payment-data?token=<payment_data_token>
 * Devuelve transaction_amount y payer_email para inicializar el Brick.
 * Token de un solo uso: tras consumir, devuelve 403 en reintentos.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Falta token' }, { status: 400 });
    }

    const verified = parsePaymentDataToken(token);
    if (!verified) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
    }

    const supabase = requireSupabaseAdmin();
    const nonceKey = `pdata_${verified.nonce}`;

    const { error: insertErr } = await supabase
      .from('idempotency_keys')
      .insert({ key: nonceKey });

    if (insertErr?.code === '23505') {
      return NextResponse.json({ error: 'Token ya utilizado' }, { status: 403 });
    }
    if (insertErr) {
      console.error('payment-data consume nonce error:', insertErr);
      return NextResponse.json({ error: 'Error al validar token' }, { status: 500 });
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, status')
      .eq('external_reference', verified.external_reference)
      .limit(1);

    const order = orders?.[0] as { status?: string } | undefined;
    if (!order || order.status !== 'pending') {
      return NextResponse.json({ error: 'Orden no encontrada o ya pagada' }, { status: 404 });
    }

    return NextResponse.json({
      external_reference: verified.external_reference,
      transaction_amount: verified.transaction_amount,
      payer_email: verified.payer_email,
    });
  } catch (error) {
    console.error('GET /api/orders/payment-data error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
