import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (url && key) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient<Database>(url, key, {
      auth: {
        storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch {
    console.warn('Supabase not available — running in offline mode');
  }
}

export const safeSupabase = client;
