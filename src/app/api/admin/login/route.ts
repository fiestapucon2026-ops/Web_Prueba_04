import { getKeyLengthsForDiagnostic, verifyAdminKeyFromBody } from '@/lib/admin-auth';
import { createSessionToken, getSetCookieHeader } from '@/lib/admin-session';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({ key: z.string().min(1) });

function loginErrorMessage(adminSecretLen: number, providedLen: number): string {
  if (adminSecretLen === 0) {
    return 'Servidor sin ADMIN_SECRET. Configurar variable en Vercel (Production) y redeploy.';
  }
  // No revelar longitud del admin a quien usa clave de Control de Acceso o Caja (Acceso1, Caja1, etc.)
  if (adminSecretLen !== providedLen) {
    return 'Clave incorrecta. Usa Control de Acceso (Acceso1–Acceso10) o Caja (Caja1–Caja4).';
  }
  return 'Clave inválida (longitud correcta; revisar caracteres o copiar de nuevo).';
}

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
      const msg = loginErrorMessage(lengths.adminSecretLen, lengths.providedLen);
      const res = NextResponse.json({ error: msg }, { status: 401 });
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
