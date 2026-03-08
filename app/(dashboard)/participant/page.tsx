// Path: app/(dashboard)/participant/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { Calendar, QrCode, Users, CheckCircle, Clock, MapPin, Trophy, Bookmark, ArrowRight, Compass } from 'lucide-react'
import Link from 'next/link'
import { authService } from '@/services/auth.service'
import { eventsService } from '@/services/events.service'
import { registrationsService } from '@/services/registrations.service'
import { Event, Registration, User } from '@/types'
import { timeUntil } from '@/lib/utils'

export default function ParticipantDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [myRegs, setMyRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const u = await authService.getCurrentUser()
      setUser(u)
      if (!u) return

      const [evRes, regRes] = await Promise.all([
        eventsService.getAll(),
        registrationsService.getMyRegistrations(u.id),
      ])
      setEvents(evRes.data ?? [])
      setMyRegs((regRes.data ?? []).filter((r: Registration) => r.status !== 'CANCELLED'))
      setLoading(false)
    }
    load()
  }, [])

  const registeredEvents = myRegs.map(r => events.find(e => e.id === r.event_id)).filter(Boolean) as Event[]
  const checkedInCount = myRegs.filter(r => r.checked_in).length

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }} />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8 fade-in">
        <p className="label-xs mb-1" style={{ color: 'var(--brand)' }}>Dashboard</p>
        <h1 className="font-display text-[28px] font-bold tracking-tight mb-1">
          Good morning, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Here&apos;s what&apos;s happening with your events
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Upcoming', value: myRegs.length, icon: Calendar, iconBg: 'var(--brand-pale)', iconColor: 'var(--brand)' },
          { label: 'Checked In', value: checkedInCount, icon: CheckCircle, iconBg: 'var(--green-light)', iconColor: 'var(--green)' },
          { label: 'Competitions', value: registeredEvents.filter(e => e.type === 'TEAM').length, icon: Trophy, iconBg: 'var(--brand-pale)', iconColor: 'var(--brand)' },
          { label: 'Saved', value: 0, icon: Bookmark, iconBg: 'var(--blue-light)', iconColor: 'var(--blue)' },
        ].map(({ label, value, icon: Icon, iconBg, iconColor }, i) => (
          <div key={label} className={`card bg-white p-5 slide-up stagger-${i + 1}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: iconBg }}>
                <Icon className="w-5 h-5" style={{ color: iconColor }} />
              </div>
            </div>
            <div className="mono text-2xl font-bold mb-0.5" style={{ color: value > 0 ? iconColor : 'var(--ink-4)' }}>{value}</div>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Action Banner */}
      <div className="rounded-2xl p-6 mb-8 flex items-center justify-between slide-up stagger-3"
        style={{ background: 'var(--brand-pale)', border: '1px solid var(--brand-soft)' }}>
        <div>
          <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--brand-dark)' }}>Discover New Events</h3>
          <p className="text-sm" style={{ color: 'var(--brand-mid)' }}>Find hackathons, workshops, and competitions near you</p>
        </div>
        <Link href="/participant/discover" className="btn btn-primary px-5 py-2.5 text-sm" style={{ borderRadius: 12 }}>
          <Compass className="w-4 h-4" /> Explore <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* My Registrations */}
      {myRegs.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Your Upcoming Events</h2>
            <Link href="/participant/discover" className="text-sm font-medium" style={{ color: 'var(--brand)' }}>View All →</Link>
          </div>
          <div className="space-y-3">
            {myRegs.map((reg, i) => {
              const event = events.find(e => e.id === reg.event_id)
              if (!event) return null
              const startDate = new Date(event.start_date)
              const day = startDate.getDate()
              const month = startDate.toLocaleString('en', { month: 'short' }).toUpperCase()
              return (
                <div key={reg.id} className={`card bg-white overflow-hidden slide-up stagger-${Math.min(i + 1, 6)}`}>
                  <div className="flex">
                    {/* Orange date sidebar */}
                    <Link href={`/events/${event.id}`} className="w-20 flex-shrink-0 flex flex-col items-center justify-center gradient-brand text-white px-3 py-4" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span className="font-display text-2xl font-bold leading-none">{day}</span>
                      <span className="text-xs font-semibold mt-1 opacity-90">{month}</span>
                    </Link>
                    {/* Event info */}
                    <div className="flex-1 p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                          <h3 className="font-semibold text-[15px] mb-1 truncate" style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--brand)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>{event.title}</h3>
                        </Link>
                        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--ink-3)' }}>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeUntil(event.start_date)}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.type === 'TEAM' ? 'Team' : 'Solo'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* View Details */}
                        <Link href={`/events/${event.id}`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                          style={{
                            background: 'var(--brand-pale)', color: 'var(--brand)',
                            border: '1px solid var(--brand-soft)', textDecoration: 'none',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-soft)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-pale)' }}
                        >
                          View Details
                        </Link>
                        {/* QR Token */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: 'var(--brand-pale)', border: '1px solid var(--brand-soft)' }}>
                          <QrCode className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                          <span className="mono text-xs font-bold" style={{ color: 'var(--brand)' }}>{reg.qr_token}</span>
                        </div>
                        {/* Status */}
                        <span className={`badge ${reg.checked_in ? 'badge-green' : 'badge-orange'}`}>
                          {reg.checked_in ? '✓ Checked In' : reg.status}
                        </span>
                        {/* Cancel button */}
                        {!reg.checked_in && (
                          <button
                            onClick={async () => {
                              const isLeader = reg.team_id && user
                              const msg = isLeader
                                ? 'You are a team leader. Cancelling will dissolve your team and cancel all members\' registrations. Continue?'
                                : 'Cancel your registration for this event?'
                              if (!confirm(msg)) return
                              const res = await fetch(`/api/registrations/${reg.id}/cancel`, { method: 'POST' })
                              const data = await res.json()
                              if (data.success) {
                                setMyRegs(prev => prev.filter(r => r.id !== reg.id))
                              } else {
                                alert(data.error ?? 'Failed to cancel')
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                            style={{
                              background: 'transparent', color: 'var(--red)',
                              border: '1.5px solid currentColor', cursor: 'pointer',
                              transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {myRegs.length === 0 && (
        <div className="card bg-white py-20 text-center slide-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-pale)' }}>
            <Calendar className="w-8 h-8" style={{ color: 'var(--brand)' }} />
          </div>
          <h3 className="font-display text-lg font-bold mb-2">No events yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>Discover hackathons, workshops, and competitions</p>
          <Link href="/participant/discover" className="btn btn-primary px-6 py-3 text-sm mx-auto" style={{ display: 'inline-flex', borderRadius: 12 }}>
            <Compass className="w-4 h-4" /> Discover Events
          </Link>
        </div>
      )}
    </div>
  )
}