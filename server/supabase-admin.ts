import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing Supabase environment variable: ${name}`);
  return value;
}

export function createSupabaseAuthClient() {
  const url = requiredEnv("VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL);
  const anonKey = requiredEnv("VITE_SUPABASE_ANON_KEY", process.env.VITE_SUPABASE_ANON_KEY);
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createSupabaseAdminClient() {
  const url = requiredEnv("VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}