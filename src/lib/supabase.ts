import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Validación de variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseEnvStatus(): {
  ok: boolean;
  missing: string[];
  hasServiceRole: boolean;
  hasAnonKey: boolean;
} {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey && !supabaseAnonKey) {
    // Al menos una key debe existir
    missing.push('SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY');
  }
  return {
    ok: missing.length === 0,
    missing,
    hasServiceRole: Boolean(supabaseServiceRoleKey),
    hasAnonKey: Boolean(supabaseAnonKey),
  };
}

if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
  if (typeof window === 'undefined') {
    console.warn(
      '⚠️ ADVERTENCIA: Supabase no está configurado. Configure SUPABASE_URL y (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY).'
    );
  }
}

// Cliente público (respeta RLS)
export const supabasePublic = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Cliente admin (bypassa RLS) — SOLO SERVER-SIDE
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export function requireSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error(
      '🔴 ERROR: Supabase Admin no está configurado. Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (solo servidor) en Vercel.'
    );
  }
  return supabaseAdmin;
}

// Helper para validar que el cliente esté inicializado
export function requireSupabaseClient(): SupabaseClient {
  // Preferimos admin en server para evitar fallos por RLS en API routes/webhooks
  const client = supabaseAdmin ?? supabasePublic;
  if (!client) {
    throw new Error(
      '🔴 ERROR: Supabase no está configurado. Configure SUPABASE_URL y (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY) en Vercel.'
    );
  }
  return client;
}
