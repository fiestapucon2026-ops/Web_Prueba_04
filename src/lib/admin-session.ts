import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Buffer {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return Buffer.from(b64, 'base64');
}

export function createSessionToken(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET no configurado');
  const iat = Date.now();
  const exp = iat + TTL_MS;
  const payload = JSON.stringify({ iat, exp });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest();
  return toBase64Url(Buffer.from(payload, 'utf8')) + '.' + toBase64Url(sig);
}

export function verifySessionToken(token: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const payloadBuf = fromBase64Url(parts[0]!);
    const payload = JSON.parse(payloadBuf.toString('utf8')) as { iat?: number; exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadBuf).digest();
    const sig = fromBase64Url(parts[1]!);
    if (expectedSig.length !== sig.length) return false;
    return crypto.timingSafeEqual(expectedSig, sig);
  } catch {
    return false;
  }
}

export function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!.trim()) : null;
}

export function getSetCookieHeader(value: string, maxAge: number = 86400): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function getClearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=0`;
}
