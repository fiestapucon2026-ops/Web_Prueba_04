import crypto from 'crypto';

/**
 * QR Signing utility — SERVER-SIDE ONLY.
 * QR_SIGNING_SECRET must never be exposed to the client bundle.
 * Uses HMAC-SHA256; output is Base64URL(payload + '.' + signature_hex).
 */

const ALGORITHM = 'sha256';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(Buffer.from(str, 'utf8'));
}

/**
 * Signs a ticket payload and returns a single Base64URL string.
 * Payload format: ${uuid}|${type}|${issued_at}
 * Output: Base64URL(utf8(payload) + '.' + hex(hmac))
 */
export function signTicket(uuid: string, type: string): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret || typeof secret !== 'string') {
    throw new Error('QR_SIGNING_SECRET is not configured');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${uuid}|${type}|${issuedAt}`;
  const hmac = crypto.createHmac(ALGORITHM, secret);
  hmac.update(payload, 'utf8');
  const signatureHex = hmac.digest('hex');
  const combined = `${payload}.${signatureHex}`;
  return base64UrlEncodeString(combined);
}
