'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Clock, Users, CheckCircle, Loader2, Plus, Search, Zap } from 'lucide-react'

import { authService } from '@/services/auth.service'
import { eventsService } from '@/services/events.service'
import { registrationsService } from '@/services/registrations.service'
import { Event, Registration, User } from '@/types'
import { timeUntil } from '@/lib/utils'

const FILTERS = ['All', 'Hackathons', 'Workshops', 'Meetups', 'Online', 'Free']

export default function ParticipantDiscoverPage() {
  // FIX: useRef for user — handleRegister reads from ref, never stale
  const userRef = useRef<User | null>(null)
  const [user, setUser] = useState<User | null>(null)

  const [events, setEvents] = useState<Event[]>([])
  const [myRegs, setMyRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')

  useEffect(() => {
    async function load() {
      const u = await authService.getCurrentUser()
      // FIX: always unblock loading even when unauthenticated
      if (!u) { setLoading(false); return }
      userRef.current = u
      setUser(u)

      // FIX: progressive load — events render immediately; registrations arrive separately
      // User sees the event grid as soon as eventsService resolves, without waiting for regs
      eventsService.getAll().then(evRes => {
        setEvents((evRes.data ?? []).filter((e: Event) =>
          ['PUBLISHED', 'ONGOING'].includes(e.status) && e.created_by !== u.id
        ))
        setLoading(false)
      })

      registrationsService.getMyRegistrations(u.id).then(regRes => {
        setMyRegs((regRes.data ?? []).filter((r: Registration) => r.status !== 'CANCELLED'))
      })
    }
    load()
  }, [])

  // FIX: reads user from ref — no stale closure on first render after session hydrates
  async function handleRegister(eventId: string) {
    const currentUser = userRef.current
    if (!currentUser) return
    setRegistering(eventId)
    const res = await registrationsService.register({ event_id: eventId, user_id: currentUser.id })
    if (res.success && res.data) {
      setMyRegs(prev => [...prev, res.data])
      setToast('🎉 Registered! Head to My Teams to form or join a team.')
    } else {
      setToast(res.error ?? 'Registration failed')
    }
    setRegistering(null)
    setTimeout(() => setToast(''), 5000)
  }

  // --- DSA Concept: Inverted Index & Prefix Search ---
  // We build an inverted index (Map) mapping word prefixes to Sets of Event IDs.
  // This allows O(1) lookup per token, avoiding O(N * M) string matching on every search keystroke.
  const searchIndex = useMemo(() => {
    const index = new Map<string, Set<string>>()

    const addTokens = (text: string, eventId: string) => {
      const tokens = text.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)
      for (const token of tokens) {
        let prefix = ''
        for (const char of token) {
          prefix += char
          if (!index.has(prefix)) index.set(prefix, new Set())
          index.get(prefix)!.add(eventId)
        }
      }
    }

    events.forEach(e => {
      addTokens(e.title, e.id)
      addTokens(e.location, e.id)
      addTokens(e.type, e.id)
      e.tags.forEach(t => addTokens(t, e.id))
    })

    return index
  }, [events])

  // Debounce search input to avoid recalculating on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // FIX: registeredIds derived via useMemo — not recomputed on unrelated re-renders
  const registeredIds = useMemo(() => new Set(myRegs.map(r => r.event_id)), [myRegs])

  const filtered = useMemo(() => {
    let result = events

    const query = debouncedSearch.trim().toLowerCase()
    if (query) {
      const tokens = query.split(/[^a-z0-9]+/i).filter(Boolean)
      if (tokens.length > 0) {
        let matchingIds: Set<string> | null = null
        for (const token of tokens) {
          const itemSet = searchIndex.get(token) || new Set<string>()
          if (matchingIds === null) {
            matchingIds = new Set(itemSet)
          } else {
            matchingIds = new Set(Array.from<string>(matchingIds).filter(id => itemSet.has(id)))
          }
        }
        result = result.filter(e => matchingIds!.has(e.id))
      }
    }

    if (activeFilter !== 'All') {
      result = result.filter(e => {
        const titleWords = e.title.toLowerCase()
        const tags = e.tags.map(t => t.toLowerCase())
        if (activeFilter === 'Online') return e.location.toLowerCase().includes('online') || tags.includes('online')
        if (activeFilter === 'Hackathons') return titleWords.includes('hackathon') || tags.includes('hackathon')
        if (activeFilter === 'Workshops') return titleWords.includes('workshop') || tags.includes('workshop')
        if (activeFilter === 'Meetups') return titleWords.includes('meetup') || tags.includes('meetup')
        if (activeFilter === 'Free') return tags.includes('free')
        return true
      })
    }

    return result
  }, [events, debouncedSearch, activeFilter, searchIndex])

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 fade-in">
        <p className="label-xs mb-1" style={{ color: 'var(--brand)' }}>Discover</p>
        <h1 className="font-display text-[28px] font-bold tracking-tight mb-1">
          Discover Events
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          Browse hackathons, workshops, and competitions
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium slide-up"
          style={{
            background: toast.includes('fail') || toast.includes('Error') ? 'var(--red-light)' : 'var(--green-light)',
            color: toast.includes('fail') || toast.includes('Error') ? 'var(--red)' : 'var(--green)',
            border: `1px solid ${toast.includes('fail') || toast.includes('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`
          }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{toast}
        </div>
      )}

      {/* Search + Filters */}
      <div className="mb-6 slide-up stagger-1">
        <div className="glass-card rounded-2xl p-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 px-4 py-2">
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-4)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search events by name, location, or tag..."
                className="bg-transparent border-none outline-none text-sm flex-1"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeFilter === f ? 'var(--brand-pale)' : 'transparent',
                color: activeFilter === f ? 'var(--brand)' : 'var(--ink-3)',
                border: `1px solid ${activeFilter === f ? 'var(--brand-soft)' : 'var(--border)'}`,
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--brand-soft)', borderTopColor: 'var(--brand)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card bg-white py-20 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-pale)' }}>
            <Calendar className="w-7 h-7" style={{ color: 'var(--brand)' }} />
          </div>
          <p className="font-semibold mb-1">No events found</p>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event, i) => {
            const isReg = registeredIds.has(event.id)
            const fill = Math.min(((event.registration_count ?? 0) / event.max_participants) * 100, 100)
            const almost = fill > 80
            const startDate = new Date(event.start_date)
            const day = startDate.getDate()
            const month = startDate.toLocaleString('en', { month: 'short' }).toUpperCase()

            return (
              <div key={event.id} className={`card card-hover bg-white overflow-hidden slide-up`} style={{ animationDelay: `${i * 0.05}s` }}>
                {/* Image header with date badge — clickable */}
                <Link href={`/events/${event.id}`}
                  className="relative h-36 flex items-end px-4 pb-3"
                  style={{
                    display: 'block', textDecoration: 'none', color: 'inherit',
                    background: event.cover_image
                      ? `url(${event.cover_image}) center/cover no-repeat`
                      : 'linear-gradient(135deg, var(--brand), var(--brand-deep))',
                  }}>
                  <div style={{ position: 'absolute', inset: 0, background: event.cover_image ? 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.45) 100%)' : 'none' }} />
                  <div className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
                    {event.type === 'TEAM' ? <Users className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />}
                  </div>
                  <div className="absolute top-4 left-4 bg-white rounded-lg p-2 text-center shadow-sm" style={{ minWidth: 48 }}>
                    <div className="font-display text-lg font-bold leading-none" style={{ color: 'var(--brand)' }}>{day}</div>
                    <div className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--ink-3)' }}>{month}</div>
                  </div>
                  <span className={`badge ${event.status === 'ONGOING' ? 'badge-green' : 'badge-orange'}`}
                    style={{ backdropFilter: 'blur(10px)', position: 'absolute', bottom: 12, right: 12 }}>
                    {event.status}
                  </span>
                </Link>

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 gradient-brand">
                      {event.organizer?.name[0].toUpperCase() ?? '?'}
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>{event.organizer?.name ?? 'Organizer'}</span>
                  </div>

                  <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 className="font-bold text-[15px] mb-2 line-clamp-2 leading-snug" style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                      onMouseEnter={(e: React.MouseEvent<HTMLHeadingElement>) => e.currentTarget.style.color = 'var(--brand)'}
                      onMouseLeave={(e: React.MouseEvent<HTMLHeadingElement>) => e.currentTarget.style.color = 'inherit'}>{event.title}</h3>
                  </Link>

                  <div className="space-y-1.5 mb-3">
                    {[
                      { icon: MapPin, text: event.location },
                      { icon: Clock, text: timeUntil(event.registration_deadline) },
                      { icon: Users, text: event.type === 'TEAM' ? `Teams of ${event.min_team_size}–${event.max_team_size}` : 'Individual' },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-3)' }}>
                        <Icon className="w-3 h-3 flex-shrink-0" />{text}
                      </div>
                    ))}
                  </div>

                  {/* Capacity bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
                      <span>👥 {event.registration_count} / {event.max_participants}</span>
                      {almost && <span className="font-semibold" style={{ color: 'var(--red)' }}>Almost full!</span>}
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-5)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${fill}%`, background: almost ? 'var(--red)' : 'var(--brand)' }} />
                    </div>
                  </div>

                  {/* Tags */}
                  {event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {event.tags.slice(0, 3).map(t => <span key={t} className="badge badge-orange">{t}</span>)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={`/events/${event.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
                      style={{
                        background: 'var(--brand-pale)', color: 'var(--brand)',
                        border: '1px solid var(--brand-soft)', textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = 'var(--brand-soft)' }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = 'var(--brand-pale)' }}
                    >
                      View Details
                    </Link>
                    {isReg ? (
                      <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
                        <CheckCircle className="w-4 h-4" />Registered
                      </div>
                    ) : (
                      <button onClick={() => handleRegister(event.id)} disabled={registering === event.id}
                        className="btn btn-primary py-2.5 text-sm flex-1" style={{ borderRadius: 12 }}>
                        {registering === event.id
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Registering…</>
                          : <><Plus className="w-3.5 h-3.5" />Register</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}