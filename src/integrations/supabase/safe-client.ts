import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let safeSupabase: SupabaseClient<Database> | null = null;

try {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const { supabase } = await import('./client');
    safeSupabase = supabase;
  }
} catch {
  console.warn('Supabase not available — running in offline mode');
}

export { safeSupabase };
