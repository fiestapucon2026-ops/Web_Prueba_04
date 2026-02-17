import { verifySessionCookie, type AdminRole } from './admin-session-edge';

/** Rutas /api/admin que aceptan rol access_control (solo control de acceso). */
const ACCESS_CONTROL_PATHS = ['/api/admin/tickets/validate', '/api/admin/check'];

function pathAllowsAccessControl(path: string): boolean {
  return ACCESS_CONTROL_PATHS.some((p) => path === p || path.startsWith(p + '/'));
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
 * Devuelve rol (admin | access_control) o false. Si el rol es access_control,
 * solo se acepta en rutas de control de acceso (validate, check).
 */
export async function verifyAdminKeyEdge(request: Request, path: string): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  const accessKey = process.env.ACCESS_CONTROL_KEY;
  if (!secret) return false;

  const headerKey = request.headers.get('x-admin-key');
  if (headerKey !== null && headerKey !== undefined) {
    if (await timingSafeEqualHash(headerKey, secret)) return true;
    if (accessKey && (await timingSafeEqualHash(headerKey, accessKey))) {
      return pathAllowsAccessControl(path);
    }
  }

  const role = await verifySessionCookie(request);
  if (role === 'admin') return true;
  if (role === 'access_control') return pathAllowsAccessControl(path);
  return false;
}
