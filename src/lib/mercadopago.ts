import MercadoPagoConfig, { Preference } from 'mercadopago';

// 1. Verificación de Seguridad: Detiene la app si falta el token
if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error('🔴 ERROR CRÍTICO: Falta MP_ACCESS_TOKEN en .env.local');
}

// 2. Inicializar el Cliente Maestro
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 }
});

// 3. Exportar los recursos específicos que usaremos (Preferencias de Pago)
// Esto evita tener que instanciar el cliente en cada archivo.
export const preferenceClient = new Preference(client);