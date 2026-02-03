import { validateTicketByQrUuid } from '@/lib/tickets/validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BodySchema = z.object({
  qr_uuid: z.string().uuid(),
});

/**
 * POST /api/admin/tickets/validate
 * Proxy de validación protegido por auth admin (middleware).
 * Mismo contrato que POST /api/tickets/validate.
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

    const result = await validateTicketByQrUuid(qr_uuid);

    if (result.valid) {
      return NextResponse.json({
        valid: true,
        message: result.message,
        ticket_id: result.ticket_id,
      });
    }

    const status =
      result.message === 'Error al validar' ? 500 : 200;
    return NextResponse.json(
      { valid: false, message: result.message },
      { status }
    );
  } catch (err) {
    console.error('POST /api/admin/tickets/validate error:', err);
    return NextResponse.json(
      { valid: false, message: 'Error interno' },
      { status: 500 }
    );
  }
}
