import MercadoPagoConfig, { Preference, Payment } from 'mercadopago';

// 1. Verificación de Seguridad: Solo validar en runtime, no en build time
const accessToken = process.env.MP_ACCESS_TOKEN;

// 2. Inicializar el Cliente Maestro (solo si existe el token)
let client: MercadoPagoConfig | null = null;
let preferenceClient: Preference | null = null;
let paymentClient: Payment | null = null;

if (accessToken) {
  client = new MercadoPagoConfig({
    accessToken: accessToken,
    options: { timeout: 5000 }
  });
  preferenceClient = new Preference(client);
  paymentClient = new Payment(client);
} else if (typeof window === 'undefined') {
  // Solo warning en servidor, no en cliente
  console.warn('⚠️ ADVERTENCIA: MP_ACCESS_TOKEN no configurado. Las funciones de pago no estarán disponibles.');
}

// 3. Exportar con validación de runtime
export { preferenceClient, paymentClient };

// Helper para validar que el cliente esté inicializado
export function requireMercadoPagoClient(): { preferenceClient: Preference; paymentClient: Payment } {
  if (!preferenceClient || !paymentClient || !accessToken) {
    throw new Error('🔴 ERROR: MP_ACCESS_TOKEN no está configurado. Configure la variable de entorno en Vercel.');
  }
  return { preferenceClient, paymentClient };
}