import { getKeyLengthsForDiagnostic, verifyAdminKeyFromBody } from '@/lib/admin-auth';
import { createSessionToken, getSetCookieHeader } from '@/lib/admin-session';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({ key: z.string().min(1) });

/** POST: Login admin. Valida clave, establece cookie HttpOnly. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Clave requerida' }, { status: 400 });
    }

    const role = verifyAdminKeyFromBody(parsed.data.key);
    if (!role) {
      const lengths = getKeyLengthsForDiagnostic(parsed.data.key);
      const res = NextResponse.json({ error: 'Clave inválida' }, { status: 401 });
      res.headers.set('X-Admin-Secret-Len', String(lengths.adminSecretLen));
      res.headers.set('X-Admin-Provided-Len', String(lengths.providedLen));
      return res;
    }

    const token = createSessionToken(role);
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', getSetCookieHeader(token));
    return res;
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
