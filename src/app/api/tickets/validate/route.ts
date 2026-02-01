import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({
  qr_uuid: z.string().uuid(),
});

/**
 * POST /api/tickets/validate
 * Valida un ticket en puerta por qr_uuid (contenido del QR).
 * Si es válido (sold_unused): marca como used y scanned_at; retorna valid: true.
 * Si ya fue usado: retorna valid: false, message: 'Entrada ya utilizada'.
 * Si no existe: retorna valid: false, message: 'Entrada no válida'.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, message: 'qr_uuid inválido' },
        { status: 400 }
      );
    }
    const { qr_uuid } = parsed.data;

    const supabase = requireSupabaseAdmin();

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('id, status, scanned_at')
      .eq('qr_uuid', qr_uuid)
      .single();

    if (error || !ticket) {
      return NextResponse.json(
        { valid: false, message: 'Entrada no válida' },
        { status: 200 }
      );
    }

    const row = ticket as { id: string; status: string; scanned_at: string | null };
    if (row.status === 'used' || row.scanned_at) {
      return NextResponse.json(
        { valid: false, message: 'Entrada ya utilizada' },
        { status: 200 }
      );
    }

    if (row.status !== 'sold_unused') {
      return NextResponse.json(
        { valid: false, message: 'Entrada no válida' },
        { status: 200 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        scanned_at: now,
        used_at: now,
      })
      .eq('id', row.id);

    if (updateErr) {
      console.error('Validate ticket update error:', updateErr);
      return NextResponse.json(
        { valid: false, message: 'Error al validar' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'Entrada validada',
      ticket_id: row.id,
    });
  } catch (err) {
    console.error('POST /api/tickets/validate error:', err);
    return NextResponse.json(
      { valid: false, message: 'Error interno' },
      { status: 500 }
    );
  }
}
