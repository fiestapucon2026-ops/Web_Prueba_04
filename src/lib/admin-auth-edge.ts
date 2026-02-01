import { verifySessionCookie } from './admin-session-edge';

/**
 * Verificación timing-safe de x-admin-key o cookie de sesión (Edge Runtime).
 */
export async function verifyAdminKeyEdge(request: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const key = request.headers.get('x-admin-key');
  if (key !== null && key !== undefined) {
    const encoder = new TextEncoder();
    const aBuf = await crypto.subtle.digest('SHA-256', encoder.encode(key));
    const bBuf = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    const a = new Uint8Array(aBuf);
    const b = new Uint8Array(bBuf);
    if (a.length === b.length) {
      let out = 0;
      for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
      if (out === 0) return true;
    }
  }

  return verifySessionCookie(request);
}
