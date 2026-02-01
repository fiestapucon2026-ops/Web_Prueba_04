#!/usr/bin/env node
/**
 * Verifica APIs del módulo Tickets QR + Email.
 * Requiere servidor corriendo (npm run dev) o VERIFY_URL en env.
 *
 * Uso:
 *   EXTERNAL_REF=uuid-de-orden-pagada node scripts/verify-tickets-qr.js
 *   VERIFY_URL=https://tu-preview.vercel.app EXTERNAL_REF=xxx node scripts/verify-tickets-qr.js
 *
 * Si no pasas EXTERNAL_REF, el script solo verifica que las rutas existan (GET 400 esperado).
 */

const baseUrl = process.env.VERIFY_URL || 'http://localhost:3000';
const externalRef = process.env.EXTERNAL_REF;

async function main() {
  console.log('\n🔍 Verificación módulo Tickets QR + Email\n');
  console.log(`Base URL: ${baseUrl}\n`);

  let ok = 0;
  let fail = 0;

  // 1. access-token sin external_reference → 400
  try {
    const r1 = await fetch(`${baseUrl}/api/orders/access-token`);
    if (r1.status === 400) {
      console.log('✅ GET /api/orders/access-token (sin param) → 400 OK');
      ok++;
    } else {
      console.log(`❌ GET /api/orders/access-token esperaba 400, obtuvo ${r1.status}`);
      fail++;
    }
  } catch (e) {
    console.log('❌ GET /api/orders/access-token:', e.message);
    fail++;
  }

  // 2. by-reference sin token → 400
  try {
    const r2 = await fetch(`${baseUrl}/api/orders/by-reference`);
    if (r2.status === 400) {
      console.log('✅ GET /api/orders/by-reference (sin token) → 400 OK');
      ok++;
    } else {
      console.log(`❌ GET /api/orders/by-reference esperaba 400, obtuvo ${r2.status}`);
      fail++;
    }
  } catch (e) {
    console.log('❌ GET /api/orders/by-reference:', e.message);
    fail++;
  }

  // 3. by-reference/pdf sin token → 400
  try {
    const r3 = await fetch(`${baseUrl}/api/orders/by-reference/pdf`);
    if (r3.status === 400) {
      console.log('✅ GET /api/orders/by-reference/pdf (sin token) → 400 OK');
      ok++;
    } else {
      console.log(`❌ GET /api/orders/by-reference/pdf esperaba 400, obtuvo ${r3.status}`);
      fail++;
    }
  } catch (e) {
    console.log('❌ GET /api/orders/by-reference/pdf:', e.message);
    fail++;
  }

  // 4. Con external_reference: access-token → token → by-reference → by-reference/pdf
  if (externalRef) {
    try {
      const r4 = await fetch(
        `${baseUrl}/api/orders/access-token?external_reference=${encodeURIComponent(externalRef)}`
      );
      const data4 = await r4.json();

      if (!r4.ok) {
        console.log(`❌ access-token: ${r4.status}`, data4);
        fail++;
      } else if (!data4.token) {
        console.log('❌ access-token: respuesta sin token');
        fail++;
      } else {
        console.log('✅ access-token → token obtenido');
        ok++;

        const token = data4.token;

        // by-reference
        const r5 = await fetch(
          `${baseUrl}/api/orders/by-reference?token=${encodeURIComponent(token)}`
        );
        const data5 = await r5.json();

        if (!r5.ok) {
          console.log(`❌ by-reference: ${r5.status}`, data5);
          fail++;
        } else if (!data5.orders || !Array.isArray(data5.orders)) {
          console.log('❌ by-reference: respuesta sin orders');
          fail++;
        } else {
          const totalTickets = data5.orders.reduce((s, o) => s + (o.tickets?.length || 0), 0);
          console.log(`✅ by-reference → ${data5.orders.length} órdenes, ${totalTickets} tickets`);
          ok++;
        }

        // by-reference/pdf
        const r6 = await fetch(
          `${baseUrl}/api/orders/by-reference/pdf?token=${encodeURIComponent(token)}`
        );

        if (!r6.ok) {
          const err6 = await r6.json().catch(() => ({}));
          console.log(`❌ by-reference/pdf: ${r6.status}`, err6);
          fail++;
        } else {
          const contentType = r6.headers.get('content-type') || '';
          const buf = await r6.arrayBuffer();
          if (contentType.includes('application/pdf') && buf.byteLength > 0) {
            console.log(`✅ by-reference/pdf → PDF ${buf.byteLength} bytes`);
            ok++;
          } else {
            console.log(`❌ by-reference/pdf: no es PDF válido (${buf.byteLength} bytes)`);
            fail++;
          }
        }
      }
    } catch (e) {
      console.log('❌ Flujo con external_reference:', e.message);
      fail++;
    }
  } else {
    console.log('ℹ️  Omisión: EXTERNAL_REF no definido (pasa UUID de orden pagada para probar flujo completo)\n');
  }

  console.log(`\n${ok} OK, ${fail} fallos\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
