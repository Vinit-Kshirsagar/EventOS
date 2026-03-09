// Path: middleware.ts
// ─── SUPABASE AUTH MIDDLEWARE ─────────────────────────────────────────────────
// Single responsibility: refresh the session cookie on every request.
// Route protection is handled by (dashboard)/layout.tsx on the client,
// which avoids the redirect loop caused by cookie timing on hard refresh.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // API routes handle their own auth — skip entirely
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to both the request (for this middleware pass) and
          // the response (so the browser gets the refreshed cookie)
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: calling getUser() here refreshes the session cookie.
  // We intentionally do NOT redirect based on the result here —
  // that caused the infinite loop on hard refresh because the cookie
  // isn't always readable server-side before the browser hydrates.
  // The layout handles the redirect client-side via onAuthStateChange,
  // which is reliable because it reads from the in-memory session.
  await supabase.auth.getUser()

  return res
}

export const config = {
  matcher: [
    // Run on all pages except Next.js internals, static files, and API routes
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}