/**
 * Actualiza la base de datos con datos de producción: Festival Pucón 2026.
 * Tipos: Familiar (gratis), Todo el día, Estacionamiento Familiar, Estacionamiento Todo el día.
 * Fechas: 12 días feb/mar 2026. FOMO 99% (28/feb 100%). Sobreventa 10%.
 *
 * Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local (o .env).
 * Ejecutar desde la raíz del proyecto: npm run db:update-production
 */

import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Cargar .env.local primero y con override para que gane sobre cualquier variable ya definida (shell, etc.)
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Configúralas en .env.local (mismo archivo que para npm run dev).');
  process.exit(1);
}

if (SUPABASE_URL.includes('tu-proyecto') || SUPABASE_URL.includes('tu_proyecto') || SUPABASE_URL.includes('TU_PROYECTO')) {
  console.error('SUPABASE_URL en .env.local sigue siendo el placeholder. Reemplázala por la URL real de Supabase (Project Settings → API → Project URL).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EVENT_DATES: string[] = [
  '2026-02-06', '2026-02-07', '2026-02-08',
  '2026-02-13', '2026-02-14', '2026-02-15',
  '2026-02-20', '2026-02-21', '2026-02-22',
  '2026-02-27', '2026-02-28', '2026-03-01',
];

const VENUE = 'Club de Rodeo de Pucón';
const FOMO_100_DATE = '2026-02-28';

type TypeKey = 'Familiar' | 'Todo el día' | 'Estacionamiento Familiar' | 'Estacionamiento Todo el día';

const TICKET_TYPES: { name: TypeKey; base_price: number }[] = [
  { name: 'Familiar', base_price: 0 },
  { name: 'Todo el día', base_price: 5000 },
  { name: 'Estacionamiento Familiar', base_price: 5000 },
  { name: 'Estacionamiento Todo el día', base_price: 8000 },
];

const STOCK: Record<TypeKey, number> = {
  'Familiar': 500,
  'Todo el día': 500,
  'Estacionamiento Familiar': 200,
  'Estacionamiento Todo el día': 200,
};

const PRICE: Record<TypeKey, number> = {
  'Familiar': 0,
  'Todo el día': 5000,
  'Estacionamiento Familiar': 5000,
  'Estacionamiento Todo el día': 8000,
};

const OVERBOOKING_PCT = 10;

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
}

function getFomo(date: string): number {
  return date === FOMO_100_DATE ? 100 : 99;
}

async function main() {
  // 1. Ticket types (get or create by name)
  console.log('Tipos de entrada...');
  const typeIds: Record<TypeKey, string> = {} as Record<TypeKey, string>;
  for (const t of TICKET_TYPES) {
    const { data: existing } = await supabase
      .from('ticket_types')
      .select('id')
      .eq('name', t.name)
      .maybeSingle();
    if (existing?.id) {
      typeIds[t.name] = existing.id;
      const { error: up } = await supabase.from('ticket_types').update({ price: t.base_price }).eq('id', existing.id);
      if (up) console.warn('No se actualizó precio base', t.name, up.message);
    } else {
      const { data: inserted, error } = await supabase
        .from('ticket_types')
        .insert({ name: t.name, price: t.base_price })
        .select('id')
        .single();
      if (error) {
        console.error('Error insertando tipo', t.name, error);
        process.exit(1);
      }
      typeIds[t.name] = inserted!.id;
    }
  }
  console.log('  OK:', Object.keys(typeIds).length, 'tipos');

  // 2. Events (get or create by date)
  console.log('Eventos...');
  const eventIds: Record<string, string> = {};
  for (const date of EVENT_DATES) {
    const start = date + 'T00:00:00.000Z';
    const end = nextDay(date);
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .gte('date', start)
      .lt('date', end)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      eventIds[date] = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from('events')
        .insert({
          name: 'Festival Pucón 2026',
          date: date + 'T18:00:00-03:00',
          venue: VENUE,
        })
        .select('id')
        .single();
      if (error) {
        console.error('Error insertando evento', date, error);
        process.exit(1);
      }
      eventIds[date] = inserted!.id;
    }
  }
  console.log('  OK:', Object.keys(eventIds).length, 'eventos');

  // 3. Event days (upsert event_date + event_id)
  console.log('Días de evento...');
  const eventDaysRows: Array<{ event_date: string; event_id: string | null }> = EVENT_DATES.map(
    (event_date) => ({
      event_date,
      event_id: eventIds[event_date] ?? null,
    })
  );
  const { data: upsertedDays, error: daysErr } = await supabase
    .from('event_days')
    .upsert(eventDaysRows, { onConflict: 'event_date', ignoreDuplicates: false })
    .select('id, event_date');

  if (daysErr) {
    console.error('Error upsert event_days', daysErr);
    process.exit(1);
  }

  const dayIds: Record<string, string> = {};
  for (const row of upsertedDays || []) {
    dayIds[row.event_date] = row.id;
  }
  for (const d of EVENT_DATES) {
    if (dayIds[d]) continue;
    const { data: one } = await supabase.from('event_days').select('id').eq('event_date', d).single();
    if (one?.id) dayIds[d] = one.id;
  }
  console.log('  OK:', Object.keys(dayIds).length, 'días');

  // 4. Daily inventory (stock, price, fomo, overbooking)
  console.log('Inventario diario...');
  const dailyRows: Array<{
    event_day_id: string;
    ticket_type_id: string;
    nominal_stock: number;
    price: number;
    fomo_threshold: number;
    overbooking_tolerance: number;
  }> = [];
  for (const date of EVENT_DATES) {
    const eventDayId = dayIds[date];
    if (!eventDayId) continue;
    for (const t of TICKET_TYPES) {
      const key = t.name;
      dailyRows.push({
        event_day_id: eventDayId,
        ticket_type_id: typeIds[key],
        nominal_stock: STOCK[key],
        price: PRICE[key],
        fomo_threshold: getFomo(date),
        overbooking_tolerance: OVERBOOKING_PCT,
      });
    }
  }

  const { error: dailyErr } = await supabase.from('daily_inventory').upsert(dailyRows, {
    onConflict: 'event_day_id,ticket_type_id',
    ignoreDuplicates: false,
  });
  if (dailyErr) {
    console.error('Error upsert daily_inventory', dailyErr);
    process.exit(1);
  }
  console.log('  OK:', dailyRows.length, 'filas');

  // 5. Inventory (total_capacity = nominal * (1 + overbooking/100))
  console.log('Inventario (capacidad total)...');
  const totalCapacity = (nominal: number) => Math.floor(nominal * (1 + OVERBOOKING_PCT / 100));
  const inventoryRows: Array<{ event_id: string; ticket_type_id: string; total_capacity: number }> = [];
  for (const date of EVENT_DATES) {
    const eventId = eventIds[date];
    if (!eventId) continue;
    for (const t of TICKET_TYPES) {
      inventoryRows.push({
        event_id: eventId,
        ticket_type_id: typeIds[t.name],
        total_capacity: totalCapacity(STOCK[t.name]),
      });
    }
  }
  const { error: invErr } = await supabase.from('inventory').upsert(inventoryRows, {
    onConflict: 'event_id,ticket_type_id',
    ignoreDuplicates: false,
  });
  if (invErr) {
    console.error('Error upsert inventory', invErr);
    process.exit(1);
  }
  console.log('  OK:', inventoryRows.length, 'filas');

  console.log('');
  console.log('Listo. FOMO 99% (28/feb 100%), Sobreventa 10%, Recinto:', VENUE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
