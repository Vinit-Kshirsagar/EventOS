// Path: services/auth.service.ts
// ─── AUTH SERVICE ─────────────────────────────────────────────────────────────
// Handles login, register, logout, and profile fetching.
//
// IMPORTANT: getCurrentUser() is intentionally NOT used in the dashboard layout
// anymore. The layout reads the profile directly from onAuthStateChange session
// to avoid the double network call (getUser() + profiles fetch) that caused the
// infinite loading on hard refresh.
//
// getCurrentUser() is still available for one-off use in individual pages that
// need the profile outside of the layout context.

import { createBrowserClient } from '@/lib/supabase/client'
import { LoginPayload, RegisterPayload, User, UserRole } from '@/types'
import { DASHBOARD_ROUTES } from '@/constants/roles'

export const authService = {

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  async login(payload: LoginPayload) {
    const supabase = createBrowserClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    payload.email,
      password: payload.password,
    })

    if (error || !data.user) {
      return { data: null, error: error?.message ?? 'Login failed', success: false }
    }

    // Fetch profile (role, name, avatar_url)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role, avatar_url, created_at')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      return { data: null, error: 'Profile not found', success: false }
    }

    return {
      data: {
        user:         profile as User,
        access_token: data.session.access_token,
        expires_at:   data.session.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : '',
      },
      error:   null,
      success: true,
    }
  },

  // ─── REGISTER ───────────────────────────────────────────────────────────────
  async register(payload: RegisterPayload) {
    const supabase = createBrowserClient()

    const { data, error } = await supabase.auth.signUp({
      email:    payload.email,
      password: payload.password,
      options: {
        // raw_user_meta_data — read by fn_handle_new_user trigger to
        // auto-create the profiles row on first sign-up
        data: {
          name: payload.name,
          role: payload.role ?? 'PARTICIPANT',
        },
      },
    })

    if (error || !data.user) {
      return { data: null, error: error?.message ?? 'Registration failed', success: false }
    }

    // Profile is auto-created by the DB trigger.
    // Small retry loop in case the trigger hasn't committed yet.
    let profile = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, email, name, role, avatar_url, created_at')
        .eq('id', data.user.id)
        .single()
      if (p) { profile = p; break }
      await new Promise(r => setTimeout(r, 300)) // wait 300ms before retry
    }

    return {
      data: {
        user:         profile as User,
        access_token: data.session?.access_token ?? '',
        expires_at:   data.session?.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : '',
      },
      error:   null,
      success: true,
    }
  },

  // ─── GET CURRENT USER ────────────────────────────────────────────────────────
  // Use sparingly — prefer reading from the layout's user state via props/context.
  //
  // This makes TWO network calls:
  //   1. supabase.auth.getUser()  → validates token with Supabase Auth servers
  //   2. profiles select          → reads from your DB
  //
  // Do NOT call this in the dashboard layout or any component that renders on
  // every route — that's what caused the infinite loading on hard refresh.
  async getCurrentUser(): Promise<User | null> {
    const supabase = createBrowserClient()

    // getSession() reads from the in-memory / cookie session without a network
    // call — safe to use for quick checks. Only use getUser() when you need
    // server-validated token verification (e.g. before a sensitive action).
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name, role, avatar_url, created_at')
      .eq('id', session.user.id)
      .single()

    return profile as User ?? null
  },

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────
  async logout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    // Hard redirect clears all in-memory state cleanly
    window.location.href = '/login'
  },

  // ─── DASHBOARD ROUTE ────────────────────────────────────────────────────────
  getDashboardRoute(role: UserRole): string {
    return DASHBOARD_ROUTES[role] ?? '/participant'
  },
}