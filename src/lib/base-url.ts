/**
 * Obtiene la URL base (origen) desde el request para back_urls y notification_url.
 * Resuelve multi-dominio en Vercel: mismo deployment sirve varios dominios;
 * el dominio usado es el del request (x-forwarded-host/host).
 *
 * Referencia MP Chile: https://www.mercadopago.cl/developers/es/docs/checkout-pro/configure-back-urls
 */

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/**
 * Devuelve la base URL (sin barra final) para el request actual.
 * Usa x-forwarded-host + x-forwarded-proto (Vercel) o host; si no hay host, devuelve fallback normalizado.
 */
export function getBaseUrlFromRequest(request: Request, fallback: string): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const scheme = proto === 'https' ? 'https' : 'http';
  if (!host || host.includes(',')) {
    return normalizeBaseUrl(fallback);
  }
  const base = `${scheme}://${host.split(',')[0].trim()}`;
  return normalizeBaseUrl(base);
}
