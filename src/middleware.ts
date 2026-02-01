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

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
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
      const ok = await verifyAdminKeyEdge(request);
      if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', CSP);
  return res;
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
