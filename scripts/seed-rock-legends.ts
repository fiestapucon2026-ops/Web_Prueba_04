/**
 * Seed datos para PUCÓN ROCK LEGENDS 2026 (Viernes 20 feb).
 * Crea ticket_types (Tickets, Estacionamiento, Promo), inventario y daily_inventory.
 * Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
 * Ejecutar: npx tsx scripts/seed-rock-legends.ts
 */

import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ROCK_DATE = '2026-02-20';
const VENUE = 'Club de Rodeo de Pucón';
const STOCK = 500;
const OVERBOOKING_PCT = 10;

/** Precios de prueba (1000, 1003, 1007) para pruebas; luego volver a 5000, 3000, 8000. */
const TICKET_TYPES = [
  { name: 'Tickets', price: 1000 },
  { name: 'Estacionamiento', price: 1003 },
  { name: 'Promo', price: 1007 },
] as const;

async function main() {
  console.log('PUCÓN ROCK LEGENDS 2026 — Seed');
  console.log('');

  const typeIds: Record<string, string> = {};

  for (const t of TICKET_TYPES) {
    const { data: existing } = await supabase
      .from('ticket_types')
      .select('id')
      .eq('name', t.name)
      .maybeSingle();
    if (existing?.id) {
      typeIds[t.name] = existing.id;
      await supabase.from('ticket_types').update({ price: t.price }).eq('id', existing.id);
    } else {
      const { data: inserted, error } = await supabase
        .from('ticket_types')
        .insert({ name: t.name, price: t.price })
        .select('id')
        .single();
      if (error) {
        console.error('Error creando tipo', t.name, error);
        process.exit(1);
      }
      typeIds[t.name] = inserted!.id;
    }
  }
  console.log('Tipos:', Object.keys(typeIds).length);

  const { data: eventDay, error: dayErr } = await supabase
    .from('event_days')
    .select('id, event_id')
    .eq('event_date', ROCK_DATE)
    .single();

  if (dayErr || !eventDay) {
    const { data: newEvent, error: evErr } = await supabase
      .from('events')
      .insert({
        name: 'PUCÓN ROCK LEGENDS 2026',
        date: ROCK_DATE + 'T20:00:00-03:00',
        venue: VENUE,
      })
      .select('id')
      .single();
    if (evErr || !newEvent?.id) {
      console.error('Error creando evento', evErr);
      process.exit(1);
    }
    const { data: newDay, error: newDayErr } = await supabase
      .from('event_days')
      .insert({ event_date: ROCK_DATE, event_id: newEvent.id })
      .select('id')
      .single();
    if (newDayErr || !newDay?.id) {
      console.error('Error creando event_day', newDayErr);
      process.exit(1);
    }
    console.log('Evento y día creados para', ROCK_DATE);
    const eventId = newEvent.id;
    const eventDayId = newDay.id;

    await upsertInventoryAndDaily(supabase, eventId, eventDayId, typeIds);
  } else {
    const eventId = (eventDay as { event_id: string }).event_id;
    const eventDayId = (eventDay as { id: string }).id;
    if (!eventId) {
      console.error('event_day sin event_id; actualizar event_days con event_id del evento para', ROCK_DATE);
      process.exit(1);
    }
    await upsertInventoryAndDaily(supabase, eventId, eventDayId, typeIds);
  }

  console.log('');
  console.log('Listo. Rock Legends', ROCK_DATE, VENUE);
}

async function upsertInventoryAndDaily(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  eventDayId: string,
  typeIds: Record<string, string>
) {
  const totalCap = Math.floor(STOCK * (1 + OVERBOOKING_PCT / 100));

  const invRows = TICKET_TYPES.map((t) => ({
    event_id: eventId,
    ticket_type_id: typeIds[t.name],
    total_capacity: totalCap,
  }));
  const { error: invErr } = await supabase.from('inventory').upsert(invRows, {
    onConflict: 'event_id,ticket_type_id',
    ignoreDuplicates: false,
  });
  if (invErr) {
    console.error('Error upsert inventory', invErr);
    process.exit(1);
  }
  console.log('Inventario: 3 filas');

  const dailyRows = TICKET_TYPES.map((t) => ({
    event_day_id: eventDayId,
    ticket_type_id: typeIds[t.name],
    nominal_stock: STOCK,
    price: t.price,
    fomo_threshold: 99,
    overbooking_tolerance: OVERBOOKING_PCT,
  }));
  const { error: dailyErr } = await supabase.from('daily_inventory').upsert(dailyRows, {
    onConflict: 'event_day_id,ticket_type_id',
    ignoreDuplicates: false,
  });
  if (dailyErr) {
    console.error('Error upsert daily_inventory', dailyErr);
    process.exit(1);
  }
  console.log('Daily inventory: 3 filas');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
