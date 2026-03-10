// Path: app/(dashboard)/organizer/analytics/page.tsx
'use client'
import { useEffect, useState, useRef } from 'react'
import { BarChart3, Users, CheckCircle, Loader2 } from 'lucide-react'
import { eventsService } from '@/services/events.service'
import { authService } from '@/services/auth.service'
import { Event, EventAnalytics, User } from '@/types'
import { formatDate } from '@/lib/utils'

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-5)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="mono text-sm font-semibold w-8 text-right" style={{ color }}>{score}</span>
    </div>
  )
}

export default function OrganizerAnalyticsPage() {
  // ── useRef so load() never re-creates, preventing infinite loop on refresh ─
  const userRef = useRef<User | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [analytics, setAnalytics] = useState<Record<string, EventAnalytics>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Resolve user once, cache in ref
      if (!userRef.current) {
        const u = await authService.getCurrentUser()
        if (!u) { setLoading(false); return }
        userRef.current = u
      }
      const u = userRef.current

      // Phase 1: fetch events, render table immediately
      const res = await eventsService.getAll({ created_by: u.id })
      const evs: Event[] = res.data ?? []
      setEvents(evs)
      setLoading(false) // ← unblocks UI; analytics rows show skeleton until resolved

      // Phase 2: fetch analytics per-event concurrently, merge as each resolves
      // This is O(1) per merge and does NOT block the initial render
      evs.forEach(async (e) => {
        const a = await eventsService.getAnalytics(e.id)
        if (a.data) {
          setAnalytics(prev => ({ ...prev, [e.id]: a.data! }))
        }
      })
    }
    load()
  }, []) // ← empty deps: runs once on mount only

  // Derived totals — computed from whatever analytics have resolved so far
  const totalRegs = Object.values(analytics).reduce((s, a) => s + a.total_registrations, 0)
  const totalCheckin = Object.values(analytics).reduce((s, a) => s + a.checked_in_count, 0)
  const avgHealth = Object.values(analytics).length
    ? Math.round(Object.values(analytics).reduce((s, a) => s + a.health_score, 0) / Object.values(analytics).length)
    : 0

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8 fade-in">
        <p className="label-xs mb-1">Organizer</p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Analytics</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>Performance across all your events</p>
      </div>

      {/* Summary stats — update live as analytics resolve */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: BarChart3, label: 'Avg Health Score', value: loading ? '—' : `${avgHealth}%` },
          { icon: Users, label: 'Total Registrations', value: loading ? '—' : totalRegs },
          { icon: CheckCircle, label: 'Total Checked In', value: loading ? '—' : totalCheckin },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card bg-white p-5 slide-up">
            <div className="flex items-center justify-between mb-4">
              <p className="label-xs">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
              </div>
            </div>
            <div className="stat-num">{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="card bg-white overflow-hidden slide-up stagger-2">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--ink-6)' }}>
            <span className="text-sm font-semibold">Per-Event Breakdown</span>
          </div>
          {events.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No events yet</p>
            </div>
          ) : events.map((event, i) => {
            const a = analytics[event.id]
            return (
              <div key={event.id} className="px-6 py-4 border-b last:border-0 slide-up"
                style={{ borderColor: 'var(--border)', animationDelay: `${i * 0.06}s` }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-6)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">{event.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      {formatDate(event.start_date)} · {event.location}
                    </p>
                  </div>
                  {/* Health bar: skeleton until analytics resolve for this event */}
                  <div className="w-32">
                    {a
                      ? <HealthBar score={a.health_score} />
                      : <div className="h-2 rounded-full animate-pulse" style={{ background: 'var(--ink-5)' }} />
                    }
                  </div>
                </div>
                {a ? (
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Registrations', value: a.total_registrations },
                      { label: 'Checked In', value: `${a.checked_in_count} (${a.checkin_rate}%)` },
                      { label: 'Teams', value: a.total_teams },
                      { label: 'Team Fill', value: `${a.team_formation_rate ?? 0}%` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="label-xs mb-1">{label}</p>
                        <p className="mono text-sm font-semibold" style={{ color: 'var(--ink)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Skeleton row while this event's analytics are still loading
                  <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j}>
                        <div className="h-2.5 w-16 rounded animate-pulse mb-2" style={{ background: 'var(--ink-5)' }} />
                        <div className="h-4 w-10 rounded animate-pulse" style={{ background: 'var(--ink-5)' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}