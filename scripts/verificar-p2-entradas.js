#!/usr/bin/env node
/**
 * Verificación P2: tablas y datos para flujo /entradas (precio por fecha).
 * Requiere: .env.local con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 * Uso: node scripts/verificar-p2-entradas.js
 */

const path = require('path');
const { config } = require('dotenv');

config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
config({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FECHAS_ESPERADAS = [
  '2026-02-06', '2026-02-07', '2026-02-08',
  '2026-02-13', '2026-02-14', '2026-02-15',
  '2026-02-20', '2026-02-21', '2026-02-22',
  '2026-02-27', '2026-02-28', '2026-03-01',
];

const TIPOS_ESPERADOS = new Set([
  'Familiar',
  'Todo el día',
  'Estacionamiento Familiar',
  'Estacionamiento Todo el día',
  'Promo 2x1 Cerveza Artesanal (2 x 500 cc)',
]);

async function main() {
  const problemas = [];
  const ok = [];

  // 1. event_days: id, event_date, event_id
  const { data: eventDays, error: e1 } = await supabase
    .from('event_days')
    .select('id, event_date, event_id');

  if (e1) {
    problemas.push({ tabla: 'event_days', error: e1.message });
  } else {
    const sinEventId = (eventDays || []).filter((r) => r.event_id == null);
    if (sinEventId.length) {
      problemas.push({
        tabla: 'event_days',
        error: `${sinEventId.length} fila(s) sin event_id`,
        fechas: sinEventId.map((r) => r.event_date),
      });
    }
    const fechasEnBd = new Set((eventDays || []).map((r) => r.event_date));
    const faltanFechas = FECHAS_ESPERADAS.filter((f) => !fechasEnBd.has(f));
    if (faltanFechas.length) {
      problemas.push({ tabla: 'event_days', error: 'Fechas sin fila', fechas: faltanFechas });
    }
    if (!sinEventId.length && !faltanFechas.length) {
      ok.push(`event_days: ${(eventDays || []).length} filas, todas con event_id`);
    }
  }

  // 2. ticket_types: nombres esperados
  const { data: ticketTypes, error: e2 } = await supabase.from('ticket_types').select('id, name, price');
  if (e2) {
    problemas.push({ tabla: 'ticket_types', error: e2.message });
  } else {
    const nombres = new Set((ticketTypes || []).map((r) => r.name));
    const faltanTipos = [...TIPOS_ESPERADOS].filter((n) => !nombres.has(n));
    if (faltanTipos.length) {
      problemas.push({ tabla: 'ticket_types', error: 'Tipos sin fila', nombres: faltanTipos });
    } else {
      ok.push(`ticket_types: ${(ticketTypes || []).length} filas, incluye los 5 de producción`);
    }
  }

  // 3. daily_inventory: event_day_id, ticket_type_id, price
  const { data: dailyRows, error: e3 } = await supabase
    .from('daily_inventory')
    .select('event_day_id, ticket_type_id, price, nominal_stock');

  if (e3) {
    problemas.push({ tabla: 'daily_inventory', error: e3.message });
  } else {
    const invalidos = (dailyRows || []).filter((r) => r.price == null || r.price < 0 || !Number.isFinite(Number(r.price)));
    if (invalidos.length) {
      problemas.push({
        tabla: 'daily_inventory',
        error: `${invalidos.length} fila(s) con price NULL o < 0`,
        muestra: invalidos.slice(0, 5),
      });
    }
    const totalEsperado = FECHAS_ESPERADAS.length * TIPOS_ESPERADOS.size;
    const total = (dailyRows || []).length;
    if (total < totalEsperado) {
      problemas.push({
        tabla: 'daily_inventory',
        error: `Faltan filas: ${total} de ${totalEsperado} esperadas (12 fechas × 5 tipos)`,
      });
    }
    if (!invalidos.length && total >= totalEsperado) {
      ok.push(`daily_inventory: ${total} filas, precios válidos`);
    }
  }

  // 4. Relación event_days ↔ daily_inventory por fecha
  if (eventDays?.length && dailyRows?.length) {
    const dayIdsByDate = new Map((eventDays || []).map((r) => [r.event_date, r.id]));
    const typeIdsByName = new Map((ticketTypes || []).map((r) => [r.name, r.id]));
    let faltantes = 0;
    for (const fecha of FECHAS_ESPERADAS) {
      const dayId = dayIdsByDate.get(fecha);
      if (!dayId) continue;
      for (const nombre of TIPOS_ESPERADOS) {
        const typeId = typeIdsByName.get(nombre);
        if (!typeId) continue;
        const existe = (dailyRows || []).some(
          (r) => r.event_day_id === dayId && r.ticket_type_id === typeId
        );
        if (!existe) faltantes++;
      }
    }
    if (faltantes) {
      problemas.push({
        tabla: 'daily_inventory',
        error: `Faltan ${faltantes} combinaciones (event_date × tipo) para las fechas de producción`,
      });
    }
  }

  // 5. inventory: event_id, ticket_type_id (para que create-preference encuentre inventory)
  const { data: inventoryRows, error: e5 } = await supabase
    .from('inventory')
    .select('id, event_id, ticket_type_id, total_capacity');
  if (e5) {
    problemas.push({ tabla: 'inventory', error: e5.message });
  } else {
    ok.push(`inventory: ${(inventoryRows || []).length} filas`);
  }

  // Reporte
  console.log('\n--- Verificación P2: flujo /entradas (precio por fecha) ---\n');
  if (ok.length) {
    ok.forEach((o) => console.log('OK', o));
  }
  if (problemas.length) {
    console.log('\nProblemas detectados:');
    problemas.forEach((p) => console.log(JSON.stringify(p, null, 2)));
    process.exit(1);
  }
  console.log('\nSin problemas detectados. Ejecutar también scripts/verificar-datos-p2-entradas.sql en Supabase SQL Editor para detalle por tabla.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
