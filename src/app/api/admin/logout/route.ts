import { getClearCookieHeader } from '@/lib/admin-session';
import { NextResponse } from 'next/server';

/** POST: Cierra sesión admin (borra cookie HttpOnly). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', getClearCookieHeader());
  return res;
}
