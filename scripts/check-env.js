#!/usr/bin/env node
/**
 * Verifica variables de entorno antes de npm run dev.
 * No bloquea; solo muestra advertencias si faltan variables.
 */

const required = [
  { key: 'SUPABASE_URL', desc: 'Supabase' },
  { key: 'SUPABASE_ANON_KEY', desc: 'Supabase' },
  { key: 'MP_ACCESS_TOKEN', desc: 'Mercado Pago' },
];
const optional = [
  { key: 'RESEND_API_KEY', desc: 'Email (Resend)' },
  { key: 'NEXT_PUBLIC_BASE_URL', desc: 'URL base (default: localhost)' },
];

const missing = required.filter(({ key }) => !process.env[key]);

if (missing.length > 0) {
  console.log('\n⚠️  Variables de entorno faltantes para desarrollo local:\n');
  missing.forEach(({ key, desc }) => console.log(`   - ${key} (${desc})`));
  console.log('\n   Copia env.example a .env.local y completa los valores.');
  console.log('   Sin ellas, /api/tickets/* y webhook no funcionarán.\n');
} else {
  const optMissing = optional.filter(({ key }) => !process.env[key]);
  if (optMissing.length > 0) {
    console.log('\nℹ️  Opcionales no configuradas:', optMissing.map(({ key }) => key).join(', '));
    console.log('   El flujo de pago funciona; el email no se enviará.\n');
  }
}
