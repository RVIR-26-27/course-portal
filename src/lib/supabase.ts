import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && anonKey);

// The anon/publishable key is public by design; every table is protected by
// RLS and every mutation goes through Edge Functions (docs/ARCHITECTURE.md).
export const supabase: SupabaseClient = createClient(url ?? 'http://127.0.0.1:54321', anonKey ?? 'missing-key', {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
