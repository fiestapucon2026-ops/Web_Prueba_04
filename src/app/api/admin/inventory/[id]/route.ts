import { verifyAdminKey } from '@/lib/admin-auth';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateSchema = z.object({
  nominal_stock: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  fomo_threshold: z.number().int().min(0).max(100).optional(),
  overbooking_tolerance: z.number().int().min(0).max(100).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Al menos un campo requerido' });

/** PATCH: Actualiza daily_inventory y sincroniza inventory.total_capacity (transacción vía RPC) */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id: dailyInventoryId } = await context.params;
    const uuidResult = z.string().uuid().safeParse(dailyInventoryId);
    if (!uuidResult.success || !dailyInventoryId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
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

    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_update_daily_inventory', {
      p_id: dailyInventoryId,
      p_nominal_stock: parsed.data.nominal_stock ?? null,
      p_price: parsed.data.price ?? null,
      p_fomo_threshold: parsed.data.fomo_threshold ?? null,
      p_overbooking_tolerance: parsed.data.overbooking_tolerance ?? null,
    });

    if (rpcErr) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }

    const result = rpcData as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/inventory/[id] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
