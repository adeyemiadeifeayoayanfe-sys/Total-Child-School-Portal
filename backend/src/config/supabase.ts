import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './env';

// Admin client using service role key (bypasses RLS - server side only)
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAdmin;