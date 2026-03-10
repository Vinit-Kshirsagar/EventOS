// Path: app/(dashboard)/layout.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { User } from '@/types'
import Sidebar from '@/components/shared/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Create client inside effect — safe, @supabase/ssr handles deduplication
    const supabase = createBrowserClient()

    // onAuthStateChange is the most reliable way to get the session.
    // It fires INITIAL_SESSION synchronously from the cookie on mount —
    // no network call, no hanging, no race condition.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (!session?.user) {
            setLoading(false)
            router.replace('/login')
            return
          }

          // Single lightweight profile fetch
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, email, name, role, avatar_url, created_at')
            .eq('id', session.user.id)
            .single()

          if (error || !profile) {
            console.error('Profile fetch failed:', error)
            await supabase.auth.signOut()
            router.replace('/login')
            return
          }

          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            avatar_url: profile.avatar_url ?? undefined,
            created_at: profile.created_at,
          })
          setLoading(false)
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          router.replace('/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  // Role-based route guard
  useEffect(() => {
    if (!user || loading) return
    if (user.role === 'ORGANIZER' && pathname.startsWith('/participant')) {
      router.replace('/organizer')
    }
    if (user.role === 'PARTICIPANT' && pathname.startsWith('/organizer')) {
      router.replace('/participant')
    }
  }, [user, loading, pathname, router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div
        className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--ink-5)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )

  if (!user) return null

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--ink-6)' }}>
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  )
}