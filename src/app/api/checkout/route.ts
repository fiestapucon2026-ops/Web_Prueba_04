import { requireMercadoPagoClient } from '@/lib/mercadopago';
import { NextResponse } from 'next/server';

/**
 * @deprecated Este endpoint está deprecado y será eliminado en una versión futura.
 * Por favor, usa /api/tickets/create-preference en su lugar.
 * 
 * Razones de deprecación:
 * - No valida precios desde BD (riesgo de seguridad)
 * - No valida stock disponible
 * - No persiste órdenes en BD
 * - No soporta múltiples eventos
 * 
 * Migración:
 * Cambiar de: POST /api/checkout
 * A: POST /api/tickets/create-preference
 * 
 * Payload nuevo:
 * {
 *   event_id: string (UUID),
 *   ticket_type_id: string (UUID),
 *   quantity: number,
 *   payer_email: string
 * }
 */
export async function POST(request: Request) {
  // Log de deprecación
  console.warn('⚠️ DEPRECATED: /api/checkout está siendo usado. Migrar a /api/tickets/create-preference');
  return NextResponse.json(
    {
      error: 'Endpoint deprecated. Usa /api/tickets/create-preference.',
      deprecated: true,
    },
    { status: 410 }
  );
}