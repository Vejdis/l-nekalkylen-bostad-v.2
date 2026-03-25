import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

function getClient(): SupabaseClient<Database> | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      // Use require-style static import — client.ts will only crash if env vars are truly missing
      // but we've already checked they exist
      const { supabase } = require('./client');
      return supabase;
    }
  } catch {
    console.warn('Supabase not available — running in offline mode');
  }
  return null;
}

export const safeSupabase = getClient();
