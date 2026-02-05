import { requireSupabaseAdmin } from '@/lib/supabase';

export type ValidateTicketResult =
  | { valid: true; message: string; ticket_id: string }
  | { valid: false; message: string };

/** Fecha "hoy" en zona Chile (America/Santiago) como YYYY-MM-DD. */
function todayChile(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    .slice(0, 10);
}

/**
 * Valida un ticket por qr_uuid: busca, comprueba estado y si está sold_unused
 * y es para el día actual (Chile), actualiza a used. Solo uso server-side.
 */
export async function validateTicketByQrUuid(qr_uuid: string): Promise<ValidateTicketResult> {
  const supabase = requireSupabaseAdmin();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id, status, scanned_at, inventory_id')
    .eq('qr_uuid', qr_uuid)
    .single();

  if (error || !ticket) {
    return { valid: false, message: 'Entrada no válida' };
  }

  const row = ticket as { id: string; status: string; scanned_at: string | null; inventory_id: string };
  if (row.status === 'used' || row.scanned_at) {
    return { valid: false, message: 'Entrada ya utilizada' };
  }

  if (row.status !== 'sold_unused') {
    return { valid: false, message: 'Entrada no válida' };
  }

  const { data: inv } = await supabase
    .from('inventory')
    .select('event_id')
    .eq('id', row.inventory_id)
    .single();

  if (inv?.event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('date')
      .eq('id', (inv as { event_id: string }).event_id)
      .single();

    const eventDate = ev?.date;
    if (eventDate) {
      const dateStr = typeof eventDate === 'string' ? eventDate.slice(0, 10) : new Date(eventDate).toISOString().slice(0, 10);
      if (dateStr !== todayChile()) {
        return { valid: false, message: 'Válido para otro día' };
      }
    }
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
