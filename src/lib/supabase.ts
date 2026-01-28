import { createClient } from '@supabase/supabase-js';

// Validación de variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window === 'undefined') {
    console.warn(
      '⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_ANON_KEY no configurados. Las funciones de BD no estarán disponibles.'
    );
  }
}

// Cliente singleton para uso en Server Components y API Routes
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper para validar que el cliente esté inicializado
export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error(
      '🔴 ERROR: Supabase no está configurado. Configure SUPABASE_URL y SUPABASE_ANON_KEY en Vercel.'
    );
  }
  return supabase;
}
