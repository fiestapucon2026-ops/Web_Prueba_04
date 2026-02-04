import { createAccessToken } from '@/lib/security/access-token';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RATE_LIMIT_REQUESTS = 20;
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

const QuerySchema = z.object({
  external_reference: z.string().uuid('external_reference debe ser UUID v4'),
});

/**
 * Devuelve un token de acceso para "Mis entradas" dado external_reference.
 * Usado por la página /success tras pago MP (back_urls con external_reference).
 */
export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      external_reference: url.searchParams.get('external_reference'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Parámetro inválido' }, { status: 400 });
    }

    const { external_reference } = parsed.data;
    const token = createAccessToken(external_reference);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('GET /api/orders/access-token error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
