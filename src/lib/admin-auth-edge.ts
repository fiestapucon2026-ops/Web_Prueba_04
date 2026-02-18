import { verifySessionCookie } from './admin-session-edge';

/** Rutas /api/admin que aceptan roles restringidos (control de acceso y caja). */
const RESTRICTED_ROLE_PATHS = ['/api/admin/tickets/validate', '/api/admin/check'];

function pathAllowsRestrictedRole(path: string): boolean {
  return RESTRICTED_ROLE_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

function normalizeKeyEdge(value: string | undefined | null): string {
  if (value == null) return '';
  let s = String(value).trim();
  s = s.replace(/^["']|["']$/g, '');
  return s.trim();
}

/** Lista de claves: KEYS (comma-separated) o KEY (única). */
function getAccessControlKeysEdge(): string[] {
  const multi = process.env.ACCESS_CONTROL_KEYS;
  if (multi && typeof multi === 'string') {
    return multi.split(',').map((k) => normalizeKeyEdge(k)).filter(Boolean);
  }
  const single = normalizeKeyEdge(process.env.ACCESS_CONTROL_KEY);
  return single ? [single] : [];
}

function getCajaKeysEdge(): string[] {
  const multi = process.env.CAJA_KEYS;
  if (multi && typeof multi === 'string') {
    return multi.split(',').map((k) => normalizeKeyEdge(k)).filter(Boolean);
  }
  const single = normalizeKeyEdge(process.env.CAJA_KEY);
  return single ? [single] : [];
}

async function timingSafeEqualHash(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBuf = await crypto.subtle.digest('SHA-256', encoder.encode(a));
  const bBuf = await crypto.subtle.digest('SHA-256', encoder.encode(b));
  const x = new Uint8Array(aBuf);
  const y = new Uint8Array(bBuf);
  if (x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i++) out |= x[i]! ^ y[i]!;
  return out === 0;
}

/**
 * Verificación timing-safe de x-admin-key o cookie (Edge Runtime).
 * Devuelve rol (admin | access_control | caja) o false. Si el rol es
 * restringido (access_control o caja), solo se acepta en rutas permitidas.
 */
export async function verifyAdminKeyEdge(request: Request, path: string): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const headerKey = request.headers.get('x-admin-key');
  if (headerKey !== null && headerKey !== undefined) {
    const provided = normalizeKeyEdge(headerKey);
    if (await timingSafeEqualHash(provided, normalizeKeyEdge(secret))) return true;
    for (const k of getAccessControlKeysEdge()) {
      if (await timingSafeEqualHash(provided, k)) return pathAllowsRestrictedRole(path);
    }
    for (const k of getCajaKeysEdge()) {
      if (await timingSafeEqualHash(provided, k)) return pathAllowsRestrictedRole(path);
    }
  }

  const role = await verifySessionCookie(request);
  if (role === 'admin') return true;
  if (role === 'access_control' || role === 'caja') return pathAllowsRestrictedRole(path);
  return false;
}
