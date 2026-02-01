import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { z } from 'zod';

function verifyAdminKey(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get('x-admin-key') === secret;
}

const UpdateSchema = z.object({
  nominal_stock: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  fomo_threshold: z.number().int().min(0).max(100).optional(),
  overbooking_tolerance: z.number().int().min(0).max(100).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Al menos un campo requerido' });

/** PATCH: Actualiza daily_inventory y sincroniza inventory.total_capacity */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id: dailyInventoryId } = await context.params;
    if (!dailyInventoryId) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = requireSupabaseAdmin();

    const { data: daily, error: fetchErr } = await supabase
      .from('daily_inventory')
      .select('id, event_day_id, ticket_type_id, nominal_stock, overbooking_tolerance')
      .eq('id', dailyInventoryId)
      .single();

    if (fetchErr || !daily) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    const updates: Record<string, number> = {};
    if (parsed.data.nominal_stock !== undefined) updates.nominal_stock = parsed.data.nominal_stock;
    if (parsed.data.price !== undefined) updates.price = parsed.data.price;
    if (parsed.data.fomo_threshold !== undefined) updates.fomo_threshold = parsed.data.fomo_threshold;
    if (parsed.data.overbooking_tolerance !== undefined) updates.overbooking_tolerance = parsed.data.overbooking_tolerance;

    const { error: updateErr } = await supabase
      .from('daily_inventory')
      .update(updates)
      .eq('id', dailyInventoryId);

    if (updateErr) {
      return NextResponse.json(
        { error: 'Error al actualizar', details: updateErr.message },
        { status: 500 }
      );
    }

    const nominal = updates.nominal_stock ?? Number(daily.nominal_stock) ?? 0;
    const over = updates.overbooking_tolerance ?? Number(daily.overbooking_tolerance) ?? 0;
    const totalCapacity = Math.floor(nominal * (1 + over / 100));

    const { data: eventDay } = await supabase
      .from('event_days')
      .select('event_id')
      .eq('id', daily.event_day_id)
      .single();

    if (eventDay?.event_id) {
      await supabase
        .from('inventory')
        .update({ total_capacity: totalCapacity })
        .eq('event_id', eventDay.event_id)
        .eq('ticket_type_id', daily.ticket_type_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/inventory/[id] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
