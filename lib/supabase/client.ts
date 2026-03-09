// Path: lib/supabase/client.ts
import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'

// Simple export — no singleton, no caching.
// The @supabase/ssr browser client handles its own internal session state.
// Creating multiple instances is safe; they all read from the same cookie.
export const createBrowserClient = () =>
  _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )