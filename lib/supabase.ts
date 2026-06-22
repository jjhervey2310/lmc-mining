/*
 * TO ACTIVATE EMAIL CAPTURE:
 * Add the following to your Vercel environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL      — Your Supabase project URL (e.g. https://xyz.supabase.co)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Your Supabase anon/public key
 *   SUPABASE_SERVICE_ROLE_KEY     — Your Supabase service role key (server-side only)
 *
 * Table needed: leads
 *   id         uuid primary key default gen_random_uuid()
 *   email      text not null
 *   name       text
 *   lead_type  text
 *   source     text
 *   notes      text
 *   created_at timestamptz default now()
 *
 * When env vars are absent, lead submissions are logged to console only and the
 * UI always shows success. No errors are surfaced to the user.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Returns null (not throws) when env vars are missing.
export function getSupabaseClient(): SupabaseClient | null {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    _client = createClient(url, key)
  }
  return _client
}

// Backward-compat export used in client components.
export const supabase = {
  get client() { return getSupabaseClient() },
}

// Server-side only. Returns null when service role key is absent.
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
