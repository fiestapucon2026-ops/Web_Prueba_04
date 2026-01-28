import { NextResponse } from 'next/server';
import { getSupabaseEnvStatus } from '@/lib/supabase';

// Endpoint de diagnóstico (no expone secretos, solo flags).
// Útil para verificar env vars en Preview/Production.
export async function GET() {
  const supabase = getSupabaseEnvStatus();
  const mpAccessToken = Boolean(process.env.MP_ACCESS_TOKEN);
  const resend = Boolean(process.env.RESEND_API_KEY);
  const baseUrl = Boolean(process.env.NEXT_PUBLIC_BASE_URL);
  const mpWebhookSecret = Boolean(process.env.MP_WEBHOOK_SECRET);

  const missing: string[] = [];
  if (!supabase.ok) missing.push(...supabase.missing);
  if (!mpAccessToken) missing.push('MP_ACCESS_TOKEN');
  if (!baseUrl) missing.push('NEXT_PUBLIC_BASE_URL');
  // RESEND y MP_WEBHOOK_SECRET son opcionales para pruebas de pago

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    supabase,
    mp: { hasAccessToken: mpAccessToken, hasWebhookSecret: mpWebhookSecret },
    email: { hasResendApiKey: resend },
    baseUrlConfigured: baseUrl,
  });
}

