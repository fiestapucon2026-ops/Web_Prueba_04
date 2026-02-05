import { verifyAdminKeyEdge } from '@/lib/admin-auth-edge';
import { type NextRequest, NextResponse } from 'next/server';

const ADMIN_RATE_LIMIT = 60;
const ADMIN_RATE_WINDOW_MS = 60_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(ip: string, path: string): boolean {
  const now = Date.now();
  const key = `${ip}:${path.startsWith('/api/admin') ? 'api' : 'page'}`;
  let entry = rateLimitMap.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + ADMIN_RATE_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  return entry.count > ADMIN_RATE_LIMIT;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/workers')) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);

  if (isRateLimited(ip, path)) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }
    return new NextResponse('Demasiadas solicitudes', { status: 429 });
  }

  if (path.startsWith('/api/admin')) {
    if ((path === '/api/admin/login' || path === '/api/admin/logout') && request.method === 'POST') {
      // Login y logout no requieren auth
    } else {
      const ok = await verifyAdminKeyEdge(request, path);
      if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*', '/workers/:path*'] };
