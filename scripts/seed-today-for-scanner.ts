/**
 * Añade SOLO el día de hoy (Chile) a la base de datos para poder generar
 * un ticket de regalo y probar el scanner. No toca el resto de fechas.
 *
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-today-for-scanner.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function todayChile(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    .slice(0, 10);
}

const VENUE = 'Club de Rodeo Pucón, Región de La Araucanía';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const date = todayChile();
  console.log('Fecha (hoy Chile):', date);

  // 1. Tipo "Familiar" (o el primero que exista)
  const { data: types } = await supabase.from('ticket_types').select('id, name').limit(5);
  const familiar = (types ?? []).find((t) => (t as { name?: string }).name === 'Familiar');
  const ticketType = familiar ?? (types ?? [])[0];
  if (!ticketType?.id) {
    console.error('No hay ticket_types en la base. Ejecuta antes el seed completo (npm run db:seed).');
    process.exit(1);
  }
  const ticketTypeId = (ticketType as { id: string }).id;
  console.log('Tipo de ticket:', (ticketType as { name?: string }).name);

  // 2. Evento para hoy
  const start = date + 'T00:00:00.000Z';
  const end = date + 'T23:59:59.999Z';
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .gte('date', start)
    .lte('date', end)
    .limit(1)
    .maybeSingle();

  let eventId: string;
  if (existingEvent?.id) {
    eventId = (existingEvent as { id: string }).id;
    console.log('Evento ya existe:', eventId);
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
      console.error('Error creando evento:', error);
      process.exit(1);
    }
    eventId = inserted!.id;
    console.log('Evento creado:', eventId);
  }

  // 3. event_days (hoy + event_id)
  const { data: existingDay } = await supabase
    .from('event_days')
    .select('id, event_id')
    .eq('event_date', date)
    .single();

  let eventDayId: string;
  if (existingDay?.id) {
    eventDayId = (existingDay as { id: string }).id;
    if (!(existingDay as { event_id?: string }).event_id) {
      await supabase.from('event_days').update({ event_id: eventId }).eq('id', eventDayId);
    }
    console.log('event_days ya existe:', eventDayId);
  } else {
    const { data: inserted, error } = await supabase
      .from('event_days')
      .insert({ event_date: date, event_id: eventId })
      .select('id')
      .single();
    if (error) {
      console.error('Error creando event_days:', error);
      process.exit(1);
    }
    eventDayId = inserted!.id;
    console.log('event_days creado:', eventDayId);
  }

  // 4. daily_inventory (una fila: Entrada/Familiar para hoy)
  const { data: existingDaily } = await supabase
    .from('daily_inventory')
    .select('id')
    .eq('event_day_id', eventDayId)
    .eq('ticket_type_id', ticketTypeId)
    .maybeSingle();

  if (!existingDaily?.id) {
    const { error } = await supabase.from('daily_inventory').insert({
      event_day_id: eventDayId,
      ticket_type_id: ticketTypeId,
      nominal_stock: 10,
      price: 0,
      fomo_threshold: 0,
      overbooking_tolerance: 0,
    });
    if (error) {
      console.error('Error creando daily_inventory:', error);
      process.exit(1);
    }
    console.log('daily_inventory creado');
  } else {
    console.log('daily_inventory ya existe');
  }

  // 5. inventory (event_id + ticket_type_id, total_capacity)
  const { data: existingInv } = await supabase
    .from('inventory')
    .select('id')
    .eq('event_id', eventId)
    .eq('ticket_type_id', ticketTypeId)
    .maybeSingle();

  if (!existingInv?.id) {
    const { error } = await supabase.from('inventory').insert({
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      total_capacity: 10,
    });
    if (error) {
      console.error('Error creando inventory:', error);
      process.exit(1);
    }
    console.log('inventory creado');
  } else {
    console.log('inventory ya existe');
  }

  console.log('');
  console.log('Listo. Ahora:');
  console.log('  1. Entra a https://www.festivalpucon.cl/admin/tickets-regalo');
  console.log('  2. Fecha:', date);
  console.log('  3. Tipo: Entrada, Cantidad: 1');
  console.log('  4. Generar tickets regalo → descarga el PDF');
  console.log('  5. Escanea el QR en https://www.festivalpucon.cl/admin/scanner-v2');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
