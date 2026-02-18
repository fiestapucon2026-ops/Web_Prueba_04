import crypto from 'crypto';

import { getSessionCookie, verifySessionToken, type AdminRole } from './admin-session';

/**
 * Comparación de claves (solo uso servidor):
 * 1. Se normaliza lo ingresado y cada clave de entorno (trim, BOM, zero-width, comillas).
 * 2. Se compara con timing-safe: hash SHA-256 de cada string y comparación de los 32 bytes.
 * Si las cadenas son idénticas, los hashes coinciden. No se compara carácter a carácter en claro.
 *
 * Causas típicas de "Clave incorrecta":
 * - ADMIN_SECRET no definido o vacío en el entorno que atiende la request (Vercel: revisar env y redeploy).
 * - Lo que se escribe no coincide byte a byte con el valor en Vercel (typo, carácter similar, encoding).
 */

function timingSafeCompare(a: string, b: string): boolean {
  const ah = crypto.createHash('sha256').update(a, 'utf8').digest('hex');
  const bh = crypto.createHash('sha256').update(b, 'utf8').digest('hex');
  const aBuf = Buffer.from(ah, 'hex');
  const bBuf = Buffer.from(bh, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/** Normaliza valor para comparación: quita BOM, zero-width, espacios/cortes de línea al borde, comillas. */
export function normalizeKey(value: string | undefined | null): string {
  if (value == null) return '';
  let s = String(value);
  s = s.replace(/\uFEFF|\u200B|\u200C|\u200D|\u2060/g, '');
  s = s.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
  }
  return s;
}

/** Devuelve lista de claves normalizadas desde env: KEYS (comma-separated) o KEY (única). */
function getAccessControlKeys(): string[] {
  const multi = process.env.ACCESS_CONTROL_KEYS;
  if (multi && typeof multi === 'string') {
    return multi.split(',').map((k) => normalizeKey(k)).filter(Boolean);
  }
  const single = normalizeKey(process.env.ACCESS_CONTROL_KEY);
  return single ? [single] : [];
}

function getCajaKeys(): string[] {
  const multi = process.env.CAJA_KEYS;
  if (multi && typeof multi === 'string') {
    return multi.split(',').map((k) => normalizeKey(k)).filter(Boolean);
  }
  const single = normalizeKey(process.env.CAJA_KEY);
  return single ? [single] : [];
}

/** Para diagnóstico 401: longitudes normalizadas (no expone el secreto). */
export function getKeyLengthsForDiagnostic(providedRaw: string): { providedLen: number; adminSecretLen: number } {
  return {
    providedLen: normalizeKey(providedRaw).length,
    adminSecretLen: normalizeKey(process.env.ADMIN_SECRET).length,
  };
}

/** Verifica clave enviada en body (para login). Devuelve rol o false. */
export function verifyAdminKeyFromBody(key: string): AdminRole | false {
  if (!key || typeof key !== 'string') return false;
  const provided = normalizeKey(key);
  if (!provided) return false;
  const secret = normalizeKey(process.env.ADMIN_SECRET);
  if (secret && timingSafeCompare(provided, secret)) return 'admin';
  for (const k of getAccessControlKeys()) {
    if (timingSafeCompare(provided, k)) return 'access_control';
  }
  for (const k of getCajaKeys()) {
    if (timingSafeCompare(provided, k)) return 'caja';
  }
  return false;
}

/**
 * Verifica x-admin-key o cookie de sesión. Devuelve rol o false.
 */
export function verifyAdminKey(request: Request): AdminRole | false {
  const secret = normalizeKey(process.env.ADMIN_SECRET);
  if (!secret) return false;

  const headerKey = request.headers.get('x-admin-key');
  if (headerKey !== null && headerKey !== undefined) {
    const provided = normalizeKey(headerKey);
    if (timingSafeCompare(provided, secret)) return 'admin';
    for (const k of getAccessControlKeys()) {
      if (timingSafeCompare(provided, k)) return 'access_control';
    }
    for (const k of getCajaKeys()) {
      if (timingSafeCompare(provided, k)) return 'caja';
    }
  }

  const cookieToken = getSessionCookie(request);
  if (cookieToken) return verifySessionToken(cookieToken);

  return false;
}
