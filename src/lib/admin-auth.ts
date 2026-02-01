import crypto from 'crypto';

import { getSessionCookie, verifySessionToken } from './admin-session';

function timingSafeCompare(a: string, b: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const ah = crypto.createHash('sha256').update(a).digest('hex');
  const bh = crypto.createHash('sha256').update(b).digest('hex');
  const aBuf = Buffer.from(ah, 'hex');
  const bBuf = Buffer.from(bh, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/** Verifica clave enviada en body (para login). */
export function verifyAdminKeyFromBody(key: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  if (!key || typeof key !== 'string') return false;
  return timingSafeCompare(key, secret);
}

/**
 * Verifica x-admin-key o cookie de sesión contra ADMIN_SECRET (timing-safe).
 */
export function verifyAdminKey(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const headerKey = request.headers.get('x-admin-key');
  if (headerKey !== null && headerKey !== undefined && timingSafeCompare(headerKey, secret)) {
    return true;
  }

  const cookieToken = getSessionCookie(request);
  if (cookieToken && verifySessionToken(cookieToken)) {
    return true;
  }

  return false;
}
