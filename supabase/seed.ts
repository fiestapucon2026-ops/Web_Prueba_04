/**
 * Database Seed: ticket_types, events, event_days, daily_inventory, inventory.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
 *
 * Rules:
 * - VIP: nominal_stock=20, overbooking_tolerance=50 (50%) → physical cap 30.
 * - Feb 14: Familiar $4.000, Todo el Día $10.000, Estac. VIP $15.000.
 * - Feb 13–15: FOMO Person 90%, FOMO Parking 85%.
 * - events: get-or-create by date (idempotent). event_days.event_id linked. inventory for create-preference.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EVENT_DATES_2026: string[] = [
  '2026-02-06', '2026-02-07', '2026-02-08',
  '2026-02-13', '2026-02-14', '2026-02-15',
  '2026-02-20', '2026-02-21', '2026-02-22',
  '2026-02-27', '2026-02-28', '2026-03-01',
];

const TICKET_TYPES = [
  { name: 'Familiar', base_price: 2000 },
  { name: 'Todo el Día', base_price: 5000 },
  { name: 'Estac. Normal', base_price: 5000 },
  { name: 'Estac. VIP', base_price: 10000 },
  { name: 'Promo 2x1 Cerveza Artesanal (2 x 500 cc)', base_price: 6000 },
] as const;

type TicketTypeKey = (typeof TICKET_TYPES)[number]['name'];

const STANDARD_STOCK: Record<TicketTypeKey, number> = {
  Familiar: 600,
  'Todo el Día': 600,
  'Estac. Normal': 100,
  'Estac. VIP': 20,
  'Promo 2x1 Cerveza Artesanal (2 x 500 cc)': 1000,
};

const STANDARD_FOMO: Record<TicketTypeKey, number> = {
  Familiar: 75,
  'Todo el Día': 75,
  'Estac. Normal': 50,
  'Estac. VIP': 50,
  'Promo 2x1 Cerveza Artesanal (2 x 500 cc)': 0,
};

const OVERBOOKING: Record<TicketTypeKey, number> = {
  Familiar: 0,
  'Todo el Día': 0,
  'Estac. Normal': 0,
  'Estac. VIP': 50,
  'Promo 2x1 Cerveza Artesanal (2 x 500 cc)': 0,
};

const PEAK_DATES = ['2026-02-13', '2026-02-14', '2026-02-15'];
const FEB_14 = '2026-02-14';
const PEAK_FOMO_PERSONS = 90;
const PEAK_FOMO_PARKING = 85;

const VENUE = 'Camping Pucón, Región de La Araucanía';

function getPrice(date: string, typeName: TicketTypeKey): number {
  if (date !== FEB_14) return TICKET_TYPES.find((t) => t.name === typeName)!.base_price;
  switch (typeName) {
    case 'Familiar': return 4000;
    case 'Todo el Día': return 10000;
    case 'Estac. VIP': return 15000;
    case 'Estac. Normal': return 5000;
    default: return TICKET_TYPES.find((t) => t.name === typeName)!.base_price;
  }
}

function getFomo(date: string, typeName: TicketTypeKey): number {
  const isPeak = PEAK_DATES.includes(date);
  const isPerson = typeName === 'Familiar' || typeName === 'Todo el Día';
  const isPromo = typeName === 'Promo 2x1 Cerveza Artesanal (2 x 500 cc)';
  if (isPromo) return STANDARD_FOMO[typeName];
  if (isPeak && isPerson) return PEAK_FOMO_PERSONS;
  if (isPeak && !isPerson) return PEAK_FOMO_PARKING;
  return STANDARD_FOMO[typeName];
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
}

async function main() {
  // 1. Ticket types (upsert by name)
  console.log('Seeding ticket_types...');
  const typeIds: Record<TicketTypeKey, string> = {} as Record<TicketTypeKey, string>;
  for (const t of TICKET_TYPES) {
    const { data: existing } = await supabase.from('ticket_types').select('id').eq('name', t.name).single();
    if (existing?.id) {
      typeIds[t.name as TicketTypeKey] = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from('ticket_types')
        .insert({ name: t.name, price: t.base_price })
        .select('id')
        .single();
      if (error) {
        console.error('Insert ticket_type failed:', error);
        process.exit(1);
      }
      typeIds[t.name as TicketTypeKey] = inserted!.id;
    }
  }

  // 2. Events: get-or-create by date (idempotent)
  console.log('Seeding events...');
  const eventIds: Record<string, string> = {};
  for (const date of EVENT_DATES_2026) {
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
        console.error('Insert event failed:', error);
        process.exit(1);
      }
      eventIds[date] = inserted!.id;
    }
  }
  console.log(`  events: ${Object.keys(eventIds).length} rows.`);

  // 3. Event days (upsert with event_id)
  console.log('Seeding event_days...');
  const dayIds: Record<string, string> = {};
  const eventDaysRows = EVENT_DATES_2026.map((event_date) => ({
    event_date,
    event_id: eventIds[event_date] ?? null,
  }));
  const { data: upsertedDays, error: daysErr } = await supabase
    .from('event_days')
    .upsert(eventDaysRows, { onConflict: ['event_date'], ignoreDuplicates: false })
    .select('id, event_date');

  if (daysErr) {
    console.error('Upsert event_days failed:', daysErr);
    process.exit(1);
  }
  for (const row of upsertedDays || []) {
    dayIds[row.event_date] = row.id;
  }
  for (const d of EVENT_DATES_2026) {
    if (dayIds[d]) continue;
    const { data: one } = await supabase.from('event_days').select('id').eq('event_date', d).single();
    if (one?.id) dayIds[d] = one.id;
  }
  console.log(`  event_days: ${Object.keys(dayIds).length} rows.`);

  // 4. Daily inventory
  console.log('Seeding daily_inventory...');
  const dailyRows: Array<{
    event_day_id: string;
    ticket_type_id: string;
    nominal_stock: number;
    price: number;
    fomo_threshold: number;
    overbooking_tolerance: number;
  }> = [];
  for (const date of EVENT_DATES_2026) {
    const eventDayId = dayIds[date];
    if (!eventDayId) continue;
    for (const t of TICKET_TYPES) {
      const typeName = t.name as TicketTypeKey;
      dailyRows.push({
        event_day_id: eventDayId,
        ticket_type_id: typeIds[typeName],
        nominal_stock: STANDARD_STOCK[typeName],
        price: getPrice(date, typeName),
        fomo_threshold: getFomo(date, typeName),
        overbooking_tolerance: OVERBOOKING[typeName],
      });
    }
  }
  const { error: invErr } = await supabase.from('daily_inventory').upsert(dailyRows, {
    onConflict: ['event_day_id', 'ticket_type_id'],
    ignoreDuplicates: false,
  });
  if (invErr) {
    console.error('Upsert daily_inventory failed:', invErr);
    process.exit(1);
  }

  // 5. Inventory (for create-preference: event_id + ticket_type_id, total_capacity with overbooking)
  console.log('Seeding inventory...');
  const inventoryRows: Array<{ event_id: string; ticket_type_id: string; total_capacity: number }> = [];
  for (const date of EVENT_DATES_2026) {
    const eventId = eventIds[date];
    if (!eventId) continue;
    for (const t of TICKET_TYPES) {
      const typeName = t.name as TicketTypeKey;
      const nominal = STANDARD_STOCK[typeName];
      const over = OVERBOOKING[typeName];
      const total_capacity = Math.floor(nominal * (1 + over / 100));
      inventoryRows.push({
        event_id: eventId,
        ticket_type_id: typeIds[typeName],
        total_capacity,
      });
    }
  }
  const { error: invTableErr } = await supabase.from('inventory').upsert(inventoryRows, {
    onConflict: ['event_id', 'ticket_type_id'],
    ignoreDuplicates: false,
  });
  if (invTableErr) {
    console.error('Upsert inventory failed:', invTableErr);
    process.exit(1);
  }

  console.log(`Done. daily_inventory: ${dailyRows.length} rows; inventory: ${inventoryRows.length} rows.`);
  console.log('Estac. VIP: nominal_stock=20, overbooking_tolerance=50 (50%) → physical cap 30.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
