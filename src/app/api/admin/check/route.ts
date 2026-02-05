import { verifyAdminKey } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/check
 * Comprueba si hay sesión admin o de control de acceso. Devuelve 200 si está autenticado.
 * Usado por /admin/scanner-v2 y /admin/validar-qr para checkAuth sin exponer inventario.
 */
export async function GET(request: Request) {
  const role = verifyAdminKey(request);
  if (!role) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, role });
}
