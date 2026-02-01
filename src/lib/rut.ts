/**
 * RUT (Chilean ID) helpers: clean input, Modulo 11 validation, display format.
 */

const RUT_FACTORS = [2, 3, 4, 5, 6, 7];

/** Strip to digits only; allows trailing 'k' or 'K' as dígito verificador. Body máx 9 dígitos. */
export function cleanRutInput(value: string): string {
  const upper = value.trim().toUpperCase();
  let digits = '';
  for (let i = 0; i < upper.length; i++) {
    const c = upper[i];
    if (c >= '0' && c <= '9') digits += c;
    else if (c === 'K' && i === upper.length - 1) {
      digits += 'K';
      break;
    }
  }
  if (digits.length <= 1) return digits;
  const dv = digits.endsWith('K') ? 'K' : digits.slice(-1);
  const body = digits.endsWith('K') ? digits.slice(0, -1) : digits.slice(0, -1);
  const bodyLimited = body.length > 9 ? body.slice(0, 9) : body;
  return bodyLimited + dv;
}

/**
 * Modulo 11 validation for Chilean RUT.
 * Body: digits (7–8); DV: last char (0–9 or K). Factors 2,3,4,5,6,7 from right to left.
 */
export function validateRutMod11(rut: string): boolean {
  const raw = cleanRutInput(rut);
  if (raw.length < 2) return false;
  const dvChar = raw.slice(-1);
  const bodyStr = raw.slice(0, -1);
  if (!/^\d+$/.test(bodyStr)) return false;
  if (dvChar !== 'K' && !/^\d$/.test(dvChar)) return false;

  const body = bodyStr.split('').map(Number).reverse();
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body[i] * RUT_FACTORS[i % RUT_FACTORS.length];
  }
  const remainder = sum % 11;
  const computed = 11 - remainder;
  const expectedDv = computed === 11 ? '0' : computed === 10 ? 'K' : String(computed);
  return expectedDv === dvChar;
}

/** Format as 12.345.678-9 (thousands with dots, dash before DV). */
export function formatRutDisplay(raw: string): string {
  const cleaned = cleanRutInput(raw);
  if (cleaned.length < 2) return raw;
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1).replace(/\D/g, '');
  if (!body) return raw;
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots}-${dv}`;
}
