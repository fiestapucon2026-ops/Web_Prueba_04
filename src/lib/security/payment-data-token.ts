/**
 * Token de un solo uso para GET /api/orders/payment-data.
 * Payload: external_reference|exp_ts|nonce. Firma: HMAC-SHA256.
 * Consumo: insert en idempotency_keys key='pdata_'+nonce; 23505 = ya usado.
 */

import crypto from 'crypto';

const TTL_SECONDS = 600;
const NONCE_BYTES = 16;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer | null {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return Buffer.from(b64 + pad, 'base64');
  } catch {
    return null;
  }
}

function getSecret(): string {
  const s = process.env.MP_PAYMENT_DATA_SECRET;
  if (!s || typeof s !== 'string') throw new Error('MP_PAYMENT_DATA_SECRET no configurado');
  return s;
}

export function createPaymentDataToken(
  externalReference: string,
  transactionAmount: number,
  payerEmail: string
): { payment_data_token: string } {
  const secret = getSecret();
  const expTs = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const nonce = crypto.randomBytes(NONCE_BYTES).toString('hex');
  const payload = `${externalReference}|${expTs}|${nonce}|${transactionAmount}|${payerEmail}`;
  const sig = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
  const token = `${base64UrlEncode(Buffer.from(payload, 'utf8'))}.${base64UrlEncode(sig)}`;
  return { payment_data_token: token };
}

export type ConsumedPaymentData = {
  external_reference: string;
  transaction_amount: number;
  payer_email: string;
};

export type VerifiedToken = ConsumedPaymentData & { nonce: string };

export function parsePaymentDataToken(token: string): VerifiedToken | null {
  const secret = process.env.MP_PAYMENT_DATA_SECRET;
  if (!secret) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  const payloadBuf = base64UrlDecode(payloadB64);
  const sigBuf = base64UrlDecode(sigB64);
  if (!payloadBuf || !sigBuf) return null;
  const payload = payloadBuf.toString('utf8');
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
  if (!crypto.timingSafeEqual(sigBuf, expected)) return null;
  const parts = payload.split('|');
  if (parts.length !== 5) return null;
  const [, expTsStr, nonce, amountStr, payerEmail] = parts;
  const expTs = Number(expTsStr);
  if (!Number.isFinite(expTs) || expTs < Math.floor(Date.now() / 1000)) return null;
  const transactionAmount = Number(amountStr);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) return null;
  return {
    external_reference: parts[0],
    transaction_amount: transactionAmount,
    payer_email: payerEmail,
    nonce,
  };
}
