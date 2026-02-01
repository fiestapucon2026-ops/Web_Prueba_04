/**
 * Verificación de cookie de sesión admin en Edge Runtime.
 * Complementa admin-session.ts (Node).
 */

const COOKIE_NAME = 'admin_session';

function fromBase64Url(s: string): Uint8Array {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}

function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!.trim()) : null;
}

export async function verifySessionCookie(request: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = getSessionCookie(request);
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const payloadBuf = fromBase64Url(parts[0]!);
    const payload = JSON.parse(new TextDecoder().decode(payloadBuf)) as { exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new Uint8Array(payloadBuf).buffer as ArrayBuffer);
    const receivedSig = fromBase64Url(parts[1]!);
    return timingSafeEqual(new Uint8Array(sig), receivedSig);
  } catch {
    return false;
  }
}
