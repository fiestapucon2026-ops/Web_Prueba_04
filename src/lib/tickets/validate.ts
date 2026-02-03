import { requireSupabaseAdmin } from '@/lib/supabase';

export type ValidateTicketResult =
  | { valid: true; message: string; ticket_id: string }
  | { valid: false; message: string };

/**
 * Valida un ticket por qr_uuid: busca, comprueba estado y si está sold_unused
 * actualiza a used con scanned_at y used_at. Solo uso server-side.
 */
export async function validateTicketByQrUuid(qr_uuid: string): Promise<ValidateTicketResult> {
  const supabase = requireSupabaseAdmin();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id, status, scanned_at')
    .eq('qr_uuid', qr_uuid)
    .single();

  if (error || !ticket) {
    return { valid: false, message: 'Entrada no válida' };
  }

  const row = ticket as { id: string; status: string; scanned_at: string | null };
  if (row.status === 'used' || row.scanned_at) {
    return { valid: false, message: 'Entrada ya utilizada' };
  }

  if (row.status !== 'sold_unused') {
    return { valid: false, message: 'Entrada no válida' };
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
    return { valid: false, message: 'Error al validar' };
  }

  return {
    valid: true,
    message: 'Entrada validada',
    ticket_id: row.id,
  };
}
