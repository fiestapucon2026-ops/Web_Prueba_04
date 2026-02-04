import { createAccessToken } from '@/lib/security/access-token';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

const QuerySchemaRef = z.object({
  external_reference: z.string().uuid(),
});
const QuerySchemaPaymentId = z.object({
  payment_id: z.string().min(1),
});

/**
 * Devuelve un token de acceso para "Mis entradas".
 * Acepta external_reference (UUID) o payment_id (collection_id de MP).
 * Si viene payment_id, busca la orden por mp_payment_id (el webhook ya debe haber corrido).
 */
export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = await checkRateLimit(ip, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);
    if (limited) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const url = new URL(request.url);
    const externalRefParam = url.searchParams.get('external_reference');
    const paymentIdParam = url.searchParams.get('payment_id') ?? url.searchParams.get('collection_id');

    console.log('[Access-Token] Búsqueda. external_reference:', externalRefParam ?? null, 'payment_id:', paymentIdParam ?? null);

    let external_reference: string;
    let orderStatus: string | undefined;

    if (externalRefParam) {
      const parsed = QuerySchemaRef.safeParse({ external_reference: externalRefParam });
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parámetro inválido' }, { status: 400 });
      }
      const supabase = requireSupabaseAdmin();
      const { data: orderByRef, error: refError } = await supabase
        .from('orders')
        .select('id, external_reference, status')
        .eq('external_reference', parsed.data.external_reference)
        .limit(1)
        .single();
      if (refError) {
        console.error('[Access-Token] Error Supabase (external_reference):', refError.code, refError.message);
        if (refError.code === 'PGRST116') {
          return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Error interno BD' }, { status: 500 });
      }
      if (!orderByRef?.external_reference) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      }
      external_reference = orderByRef.external_reference;
      orderStatus = (orderByRef as { status?: string }).status;
      console.log('[Access-Token] Orden encontrada por external_reference. id:', (orderByRef as { id?: string }).id, 'status:', orderStatus);
    } else if (paymentIdParam) {
      const parsed = QuerySchemaPaymentId.safeParse({ payment_id: paymentIdParam });
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parámetro inválido' }, { status: 400 });
      }
      const supabase = requireSupabaseAdmin();
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, external_reference, status')
        .eq('mp_payment_id', String(parsed.data.payment_id))
        .eq('status', 'paid')
        .limit(1)
        .single();
      if (error) {
        console.error('[Access-Token] Error Supabase (payment_id):', error.code, error.message);
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Error interno BD' }, { status: 500 });
      }
      if (!order?.external_reference) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      }
      external_reference = order.external_reference;
      orderStatus = (order as { status?: string }).status;
      console.log('[Access-Token] Orden encontrada por payment_id. id:', (order as { id?: string }).id);
    } else {
      return NextResponse.json({ error: 'Falta external_reference o payment_id' }, { status: 400 });
    }

    const token = createAccessToken(external_reference);
    console.log('[Access-Token] Token generado para external_reference:', external_reference.slice(0, 8), '…');
    return NextResponse.json({
      token,
      ...(orderStatus !== undefined && { status: orderStatus }),
      external_reference,
    });
  } catch (error) {
    console.error('GET /api/orders/access-token error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
