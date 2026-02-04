import crypto from 'crypto';

/**
 * Token de acceso "Mis entradas" — SERVER-SIDE ONLY.
 * Formato: base64url(external_reference|timestamp) + '.' + base64url(signature)
 * Firma: HMAC-SHA256(external_reference|timestamp, QR_SIGNING_SECRET)
 * TTL: 7 días desde timestamp.
 */

const ALGORITHM = 'sha256';
const TTL_SECONDS = 7 * 24 * 60 * 60;

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer | null {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

function getSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || typeof secret !== 'string') {
    throw new Error('QR_SIGNING_SECRET is not configured');
  }
  return secret;
}

/**
 * Crea un token para acceder a "Mis entradas" por external_reference.
 * El token incluye ref + timestamp y firma HMAC; válido 7 días.
 */
export function createAccessToken(external_reference: string): string {
  const secret = getSecret();
  const ts = Math.floor(Date.now() / 1000);
  const payload = `${external_reference}|${ts}`;
  const hmac = crypto.createHmac(ALGORITHM, secret);
  hmac.update(payload, 'utf8');
  const signature = hmac.digest();
  const payloadB64 = base64UrlEncode(Buffer.from(payload, 'utf8'));
  const sigB64 = base64UrlEncode(signature);
  return `${payloadB64}.${sigB64}`;
}

export interface VerifyAccessTokenResult {
  ok: boolean;
  external_reference?: string;
}

/**
 * Verifica el token y devuelve external_reference si es válido y no expirado.
 * Comparación timing-safe para la firma.
 */
export function verifyAccessToken(token: string): VerifyAccessTokenResult {
  try {
    const secret = getSecret();
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) return { ok: false };

    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const payloadBuf = base64UrlDecode(payloadB64);
    const sigBuf = base64UrlDecode(sigB64);
    if (!payloadBuf || !sigBuf) return { ok: false };

    const payload = payloadBuf.toString('utf8');
    const parts = payload.split('|');
    if (parts.length !== 2) return { ok: false };

    const [external_reference, tsStr] = parts;
    const ts = parseInt(tsStr, 10);
    if (!Number.isFinite(ts) || !external_reference) return { ok: false };

    const now = Math.floor(Date.now() / 1000);
    if (now - ts > TTL_SECONDS || ts > now + 60) return { ok: false };

    const expectedPayload = `${external_reference}|${tsStr}`;
    if (payload !== expectedPayload) return { ok: false };

    const hmac = crypto.createHmac(ALGORITHM, secret);
    hmac.update(payload, 'utf8');
    const expectedSig = hmac.digest();
    if (expectedSig.length !== sigBuf.length || !crypto.timingSafeEqual(expectedSig, sigBuf)) {
      return { ok: false };
    }

    return { ok: true, external_reference };
  } catch {
    return { ok: false };
  }
}
