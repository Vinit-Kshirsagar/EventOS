// Path: components/shared/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, QrCode, Users, BarChart3, LogOut, Globe, Compass } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { User } from '@/types'

interface NavItem { href: string; label: string; icon: React.ElementType }

const NAV: Record<string, NavItem[]> = {
  ORGANIZER: [
    { href: '/organizer',          label: 'My Events',  icon: Calendar },
    { href: '/organizer/discover', label: 'Discover',   icon: Globe },
    { href: '/organizer/checkin',  label: 'Check-In',   icon: QrCode },
    { href: '/organizer/analytics',label: 'Analytics',  icon: BarChart3 },
  ],
  PARTICIPANT: [
    { href: '/participant',          label: 'Dashboard',       icon: LayoutDashboard },
    { href: '/participant/discover', label: 'Discover Events', icon: Compass },
    { href: '/participant/team',     label: 'My Teams',        icon: Users },
  ],
}

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const items = NAV[user.role] ?? []

  return (
    <aside className="w-60 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-white border-r"
      style={{ borderColor: 'var(--border)' }}>

      {/* Logo */}
      <div className="px-5 py-5 border-b flex items-center gap-1" style={{ borderColor: 'var(--border)' }}>
        <span className="font-display text-xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>eventos</span>
        <span className="font-display text-xl font-bold" style={{ color: 'var(--brand)' }}>.</span>
      </div>

      {/* User chip */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--ink-6)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            text-white text-sm font-bold gradient-brand">
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{user.name}</p>
            <span className="badge badge-orange mt-0.5" style={{ fontSize: 10 }}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/participant' && href !== '/organizer' && pathname.startsWith(href + '/'))
            || pathname === href
          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--brand-pale)' : 'transparent',
                color:      active ? 'var(--brand)' : 'var(--ink-3)',
                borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
                fontWeight: active ? 600 : 500,
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--ink-6)'; e.currentTarget.style.color = 'var(--ink)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' } }}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />{label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => authService.logout()}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm w-full transition-all font-medium"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-light)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent' }}>
          <LogOut className="w-[18px] h-[18px]" /> Sign out
        </button>
      </div>
    </aside>
  )
}