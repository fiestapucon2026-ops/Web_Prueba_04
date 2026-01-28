#!/usr/bin/env node
/**
 * Verifica que la API /api/tickets/types responde correctamente.
 * Uso: npm run verify:api
 * Requiere servidor corriendo (npm run dev) o pasar URL: VERIFY_URL=https://tu-preview.vercel.app npm run verify:api
 */

const baseUrl = process.env.VERIFY_URL || 'http://localhost:3000';

async function verify() {
  console.log(`\n🔍 Verificando API: ${baseUrl}/api/tickets/types\n`);
  try {
    const res = await fetch(`${baseUrl}/api/tickets/types`);
    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Error:', res.status, res.statusText);
      console.error(data);
      process.exit(1);
    }

    const hasTypes = Array.isArray(data.ticket_types) && data.ticket_types.length > 0;
    const hasEvents = Array.isArray(data.events) && data.events.length > 0;
    const hasInventory = Array.isArray(data.inventory) && data.inventory.length > 0;

    if (!hasTypes || !hasEvents || !hasInventory) {
      console.error('❌ Respuesta incompleta:');
      console.error('  ticket_types:', data.ticket_types?.length ?? 0);
      console.error('  events:', data.events?.length ?? 0);
      console.error('  inventory:', data.inventory?.length ?? 0);
      process.exit(1);
    }

    console.log('✅ API OK');
    console.log('  ticket_types:', data.ticket_types.length);
    console.log('  events:', data.events.length);
    console.log('  inventory:', data.inventory.length);
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    console.error('   ¿Está el servidor corriendo? (npm run dev)');
    console.error('   O usa: VERIFY_URL=https://tu-preview.vercel.app npm run verify:api\n');
    process.exit(1);
  }
}

verify();
