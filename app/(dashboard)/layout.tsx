// Path: app/(dashboard)/layout.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { User } from '@/types'
import Sidebar from '@/components/shared/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = authService.getSession()
    if (!session) { router.replace('/login'); return }
    setUser(session.user)
    setLoading(false)
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-6 h-6 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }} />
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