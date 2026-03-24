import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;

try {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    // Dynamic import to avoid crash when env vars are missing
    const { supabase } = await import('./client');
    client = supabase;
  }
} catch {
  console.warn('Supabase not available — running in offline mode');
}

export const safeSupabase = client;
