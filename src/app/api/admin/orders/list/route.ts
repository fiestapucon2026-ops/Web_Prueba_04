import { verifyAdminKey } from '@/lib/admin-auth';
import { requireSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIMIT = 200;

/** GET: Listado de órdenes para admin. Filtros opcionales: dateFrom, dateTo, status. Solo admin. */
export async function GET(request: Request) {
  const role = verifyAdminKey(request);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('dateFrom')?.trim();
    const dateTo = url.searchParams.get('dateTo')?.trim();
    const status = url.searchParams.get('status')?.trim();
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') ?? '100', 10) || 100,
      MAX_LIMIT
    );

    const supabase = requireSupabaseAdmin();

    let query = supabase
      .from('orders')
      .select('id, external_reference, user_email, status, amount, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (dateFrom && DATE_REGEX.test(dateFrom)) {
      query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo && DATE_REGEX.test(dateTo)) {
      query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }
    if (status && ['pending', 'paid', 'rejected', 'cancelled'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('GET /api/admin/orders/list error:', error);
      return NextResponse.json({ error: 'Error al cargar órdenes' }, { status: 500 });
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      total: count ?? (orders?.length ?? 0),
      orders: (orders ?? []).map((o) => ({
        id: (o as { id: string }).id,
        external_reference: (o as { external_reference: string }).external_reference,
        user_email: (o as { user_email: string }).user_email,
        status: (o as { status: string }).status,
        amount: (o as { amount: number }).amount,
        created_at: (o as { created_at: string }).created_at,
      })),
    });
  } catch (e) {
    console.error('GET /api/admin/orders/list error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
