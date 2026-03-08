'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Zap, Users, QrCode, BarChart3, Shield,
  GitBranch, Check, Calendar, MapPin, ChevronDown,
  ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react'
import { Event } from '@/types'
import { formatDate } from '@/lib/utils'

/* ─── CSS overrides (same fonts, new palette + blur effects) ─────────────── */
const CSS = `
  :root {
    --accent:        #E57431;
    --accent-deep:   #C45E1F;
    --accent-glow:   #F4A261;
    --accent-light:  #FDF0E8;
    --accent-mid:    #F9D8C0;

    --ink:           #1A120B;
    --ink-2:         #2E1F14;
    --ink-3:         #6B4A35;
    --ink-4:         #A07560;
    --ink-5:         #D9C4B8;
    --ink-6:         #F5EDE6;
    --border:        #EAD9CE;
    --border-strong: #C8A898;
    --surface:       #FDF0E8;
    --white:         #FFFFFF;
    --green:         #22C55E;
    --red:           #EF4444;

    --shadow-sm:     0 1px 3px rgba(26,18,11,0.07), 0 1px 2px rgba(26,18,11,0.04);
    --shadow-md:     0 4px 16px rgba(26,18,11,0.09), 0 2px 4px rgba(26,18,11,0.05);
    --shadow-brand:  0 8px 32px rgba(229,116,49,0.32);
  }

  body { background: var(--surface) !important; }

  /* ─ Blur orbs ─ */
  .orb {
    position: absolute; border-radius: 50%;
    pointer-events: none; filter: blur(80px);
  }

  /* ─ Nav glass ─ */
  .nav-glass {
    background: rgba(253,240,232,0.82) !important;
    backdrop-filter: blur(18px) saturate(1.5) !important;
    -webkit-backdrop-filter: blur(18px) saturate(1.5) !important;
    border-bottom: 1px solid rgba(229,116,49,0.18) !important;
  }

  /* ─ Cards ─ */
  .card {
    background: rgba(255,255,255,0.82) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: 14px !important;
    box-shadow: var(--shadow-sm) !important;
  }
  .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important; }
  .card-hover:hover {
    transform: translateY(-3px) !important;
    box-shadow: var(--shadow-md) !important;
    border-color: var(--accent-mid) !important;
  }

  /* ─ Feature cards (frosted) ─ */
  .feat-card {
    background: rgba(255,255,255,0.68) !important;
    backdrop-filter: blur(14px) !important;
    -webkit-backdrop-filter: blur(14px) !important;
    border: 1.5px solid rgba(229,116,49,0.20) !important;
    border-radius: 14px !important;
    box-shadow: 0 2px 12px rgba(26,18,11,0.05) !important;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
  }
  .feat-card:hover {
    transform: translateY(-3px) !important;
    box-shadow: 0 8px 28px rgba(229,116,49,0.14) !important;
    border-color: var(--accent-mid) !important;
  }

  /* ─ Stats strip ─ */
  .stats-strip {
    background: rgba(255,255,255,0.50) !important;
    backdrop-filter: blur(20px) saturate(1.3) !important;
    -webkit-backdrop-filter: blur(20px) saturate(1.3) !important;
    border-top: 1px solid rgba(229,116,49,0.16) !important;
    border-bottom: 1px solid rgba(229,116,49,0.16) !important;
  }

  /* ─ Buttons ─ */
  .btn-primary {
    background: var(--accent) !important;
    color: white !important;
    box-shadow: 0 2px 10px rgba(229,116,49,0.30) !important;
    border: none !important;
    transition: background 0.18s, transform 0.14s, box-shadow 0.18s !important;
  }
  .btn-primary:hover {
    background: var(--accent-deep) !important;
    transform: translateY(-1px) !important;
    box-shadow: var(--shadow-brand) !important;
  }
  .btn-secondary {
    background: rgba(255,255,255,0.78) !important;
    border: 1.5px solid var(--border) !important;
    color: var(--ink-2) !important;
    backdrop-filter: blur(8px) !important;
    transition: border-color 0.18s, background 0.18s, color 0.18s !important;
  }
  .btn-secondary:hover {
    border-color: var(--accent) !important;
    background: var(--accent-light) !important;
    color: var(--accent-deep) !important;
  }
  .btn-ghost { color: var(--ink-3) !important; transition: color 0.15s, background 0.15s !important; }
  .btn-ghost:hover { color: var(--accent) !important; background: rgba(229,116,49,0.07) !important; }

  /* ─ Badges ─ */
  .badge-blue   { background: #DBEAFE !important; color: #1E40AF !important; }
  .badge-green  { background: #D1FAE5 !important; color: #065F46 !important; }
  .badge-indigo {
    background: var(--accent-light) !important;
    color: var(--accent-deep) !important;
    border: 1px solid var(--accent-mid) !important;
  }

  /* ─ Dot chip ─ */
  .accent-chip {
    background: var(--accent-light) !important;
    color: var(--accent) !important;
    border: 1px solid var(--accent-mid) !important;
  }
  .dot {
    width: 6px; height: 6px; border-radius: 50%; display: inline-block;
    animation: dotPulse 2s ease infinite;
  }
  @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

  /* ─ Logo ─ */
  .logo-bg {
    background: linear-gradient(135deg, var(--accent), var(--accent-deep)) !important;
    box-shadow: 0 2px 12px rgba(229,116,49,0.36) !important;
  }

  /* ─ Carousel fades ─ */
  .fade-l { background: linear-gradient(to right,  var(--surface), transparent) !important; }
  .fade-r { background: linear-gradient(to left,   var(--surface), transparent) !important; }

  /* ─ End card ─ */
  .end-card {
    background: rgba(253,240,232,0.65) !important;
    border: 2px dashed var(--accent-mid) !important;
    backdrop-filter: blur(8px) !important;
    transition: border-color 0.18s, background 0.18s !important;
  }
  .end-card:hover {
    border-color: var(--accent) !important;
    background: rgba(253,240,232,0.92) !important;
  }

  /* ─ Demo code block ─ */
  .demo-code { background: var(--ink-6) !important; border: 1px solid var(--border) !important; }

  /* ─ Footer ─ */
  footer {
    background: rgba(253,240,232,0.72) !important;
    backdrop-filter: blur(12px) !important;
    border-color: var(--border) !important;
  }

  /* ─ Scroll hide ─ */
  .hide-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  .hide-scroll::-webkit-scrollbar { display: none; }
`

/* ─── Data ───────────────────────────────────────────────────────────────── */
const features = [
  { icon: Users, title: 'Team Engine', desc: 'Search teams, send join requests, leader accepts or rejects. One team per event.' },
  { icon: QrCode, title: 'QR Check-In', desc: 'Token-based check-in per event. Each organizer manages their own attendees.' },
  { icon: BarChart3, title: 'Live Analytics', desc: 'Health scores, velocity, and team formation rate — all scoped per event.' },
  { icon: Shield, title: 'Scoped Permissions', desc: 'Organizers own only their events. No cross-event admin access.' },
  { icon: GitBranch, title: 'Global Platform', desc: 'Any user can host events or join them. Different organizer per event, always.' },
  { icon: Users, title: 'Team Requests', desc: 'Leaders see incoming requests with messages, and accept or reject per slot.' },
]

const demos = [
  {
    role: 'Organizer', email: 'organizer@eventos.dev', pass: 'org123',
    gradient: 'linear-gradient(135deg,#7C3AED,#5B21B6)', glow: 'rgba(124,58,237,0.28)',
    perks: ['Create & publish events', 'Manage check-in for your events', 'View analytics scoped to your events'],
  },
  {
    role: 'Participant', email: 'participant@eventos.dev', pass: 'part123',
    gradient: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', glow: 'rgba(59,130,246,0.28)',
    perks: ['Register for any public event', 'Create or search teams', 'Send join requests with a message'],
  },
]

const STATUS_BADGE: Record<string, string> = { PUBLISHED: 'badge-blue', ONGOING: 'badge-green' }

/* ─── Event card ─────────────────────────────────────────────────────────── */
function EventCard({ event }: { event: Event }) {
  const fill = Math.min(((event.registration_count ?? 0) / event.max_participants) * 100, 100)
  const almostFull = fill > 80
  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
    <div className="card flex flex-col" style={{ width: 300, minHeight: 340, padding: 20 }}>
      {/* accent stripe */}
      <div style={{
        height: 3, margin: '-20px -20px 16px', borderRadius: '14px 14px 0 0',
        background: almostFull
          ? 'linear-gradient(90deg,#EF4444,#F97316)'
          : 'linear-gradient(90deg,var(--accent),var(--accent-glow))',
      }} />

      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-deep))' }}>
          {event.organizer?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--ink-3)' }}>
          {event.organizer?.name ?? 'Organizer'}
        </span>
        <span className={`badge flex-shrink-0 ${STATUS_BADGE[event.status] ?? 'badge-neutral'}`}>
          {event.status}
        </span>
      </div>

      <h3 className="font-bold text-[15px] mb-1.5 line-clamp-1">{event.title}</h3>
      <p className="text-sm leading-relaxed mb-4 flex-1 line-clamp-2" style={{ color: 'var(--ink-3)' }}>
        {event.description}
      </p>

      <div className="space-y-1 mb-3">
        {[
          { Icon: MapPin, text: event.location },
          { Icon: Calendar, text: formatDate(event.start_date) },
          {
            Icon: Users, text: event.type === 'TEAM'
              ? `Teams of ${event.min_team_size ?? 2}–${event.max_team_size ?? 4}`
              : 'Individual'
          },
        ].map(({ Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-3)' }}>
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--accent)' }} />{text}
          </div>
        ))}
      </div>

      {event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {event.tags.slice(0, 3).map(t => <span key={t} className="badge badge-indigo">{t}</span>)}
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
          <span>{event.registration_count ?? 0} / {event.max_participants}</span>
          {almostFull && <span className="font-semibold" style={{ color: 'var(--red)' }}>Almost full!</span>}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-5)' }}>
          <div className="h-full rounded-full" style={{
            width: `${fill}%`,
            background: almostFull ? 'var(--red)' : 'var(--accent)',
          }} />
        </div>
      </div>


      <Link href="/register" className="btn btn-primary py-2 text-sm w-full rounded-xl text-center">
        Register — it&apos;s free <ArrowRight className="w-3.5 h-3.5" />
      </Link>

    </div>
    </Link>
  )
}

/* ─── Skeleton card ──────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="card flex-shrink-0 animate-pulse" style={{ width: 300, minHeight: 340, padding: 20 }}>
      <div style={{ height: 3, margin: '-20px -20px 16px', background: 'var(--ink-5)', borderRadius: '14px 14px 0 0' }} />
      <div className="h-3 rounded mb-4" style={{ background: 'var(--ink-5)', width: '50%' }} />
      <div className="h-4 rounded mb-2" style={{ background: 'var(--ink-5)', width: '80%' }} />
      <div className="h-3 rounded mb-1" style={{ background: 'var(--ink-5)', width: '95%' }} />
      <div className="h-3 rounded mb-6" style={{ background: 'var(--ink-5)', width: '70%' }} />
      {['60%', '45%', '55%'].map(w => (
        <div key={w} className="h-3 rounded mb-2" style={{ background: 'var(--ink-5)', width: w }} />
      ))}
      <div className="h-9 rounded-xl mt-4" style={{ background: 'var(--ink-5)' }} />
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [evLoading, setEvLoading] = useState(true)
  const eventsRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/events?status=PUBLISHED').then(r => r.json()),
      fetch('/api/events?status=ONGOING').then(r => r.json()),
    ])
      .then(([pub, ong]) => {
        setEvents([...(pub.data ?? []), ...(ong.data ?? [])])
        setEvLoading(false)
      })
      .catch(() => setEvLoading(false))
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 8)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
    }
    check()
    el.addEventListener('scroll', check)
    window.addEventListener('resize', check)
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [events, evLoading])

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })

  const scrollToEvents = () =>
    eventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <style>{CSS}</style>

      <div className="min-h-screen" style={{ background: 'var(--surface)' }}>

        {/* ── Nav ── */}
        <nav className="nav-glass sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="logo-bg w-7 h-7 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-[15px] tracking-tight">EventOS</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={scrollToEvents} className="btn btn-ghost px-4 py-2 text-sm">Browse Events</button>
              <Link href="/login" className="btn btn-ghost px-4 py-2 text-sm">Sign in</Link>
              <Link href="/register" className="btn btn-primary px-4 py-2 text-sm">
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="pt-24 pb-20 px-6 relative overflow-hidden">
          {/* Blur orbs */}
          <div className="orb" style={{
            width: 620, height: 620,
            background: 'radial-gradient(circle,rgba(229,116,49,0.42) 0%,transparent 68%)',
            top: -160, left: -130
          }} />
          <div className="orb" style={{
            width: 500, height: 500,
            background: 'radial-gradient(circle,rgba(244,162,97,0.36) 0%,transparent 68%)',
            top: 20, right: -110
          }} />
          <div className="orb" style={{
            width: 380, height: 380,
            background: 'radial-gradient(circle,rgba(229,116,49,0.28) 0%,transparent 68%)',
            bottom: -80, left: '38%'
          }} />

          <div className="max-w-4xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-8 text-xs font-semibold fade-in accent-chip">
              <span className="dot" style={{ background: 'var(--accent)' }} />
              Global event platform — anyone can host or join
            </div>

            <h1 className="slide-up text-[clamp(2.75rem,7vw,5rem)] font-bold tracking-tight leading-[1.05] mb-6"
              style={{ letterSpacing: '-0.03em' }}>
              The operating system<br />
              <span style={{ color: 'var(--accent)' }}>for your events</span>
            </h1>

            <p className="slide-up stagger-1 text-lg leading-relaxed max-w-xl mx-auto mb-10"
              style={{ color: 'var(--ink-3)' }}>
              Register for events, form teams with a request flow, and check in with QR codes.
              Each event has its own organizer — no shared admin.
            </p>

            <div className="slide-up stagger-2 flex items-center justify-center gap-3 flex-wrap">
              <button onClick={scrollToEvents} className="btn btn-primary px-6 py-3 text-[15px]">
                Browse events <ChevronDown className="w-4 h-4" />
              </button>
              <Link href="/login" className="btn btn-secondary px-6 py-3 text-[15px]">Sign in</Link>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section className="stats-strip border-y py-10">
          <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
            {[
              { num: '1:1', label: 'Organizer per event' },
              { num: '2', label: 'Roles: Organizer & Participant' },
              { num: '∞', label: 'Events per organizer' },
            ].map(({ num, label }) => (
              <div key={label}>
                <div className="mono text-3xl font-semibold mb-1"
                  style={{ letterSpacing: '-0.03em', color: 'var(--accent)' }}>{num}</div>
                <div className="text-sm" style={{ color: 'var(--ink-3)' }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Events Carousel ── */}
        <section ref={eventsRef} className="py-20 relative overflow-hidden">
          <div className="orb" style={{
            width: 480, height: 480,
            background: 'radial-gradient(circle,rgba(229,116,49,0.22) 0%,transparent 68%)',
            top: -100, right: -100
          }} />

          <div className="max-w-6xl mx-auto px-6 flex items-end justify-between mb-8 relative">
            <div>
              <p className="label-xs mb-2" style={{ color: 'var(--accent)' }}>Open Now</p>
              <h2 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Events you can join
              </h2>
              <p className="text-sm mt-2" style={{ color: 'var(--ink-3)' }}>
                No account needed to browse. Sign up to register.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!evLoading && events.length > 0 && (
                <div className="flex gap-1.5">
                  {(['left', 'right'] as const).map(dir => {
                    const can = dir === 'left' ? canScrollLeft : canScrollRight
                    return (
                      <button key={dir} onClick={() => scroll(dir)} disabled={!can}
                        className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all"
                        style={{
                          borderColor: can ? 'var(--border-strong)' : 'var(--border)',
                          color: can ? 'var(--ink-2)' : 'var(--ink-5)',
                          background: can ? 'white' : 'var(--ink-6)',
                          cursor: can ? 'pointer' : 'default',
                        }}>
                        {dir === 'left'
                          ? <ChevronLeft className="w-4 h-4" />
                          : <ChevronRightIcon className="w-4 h-4" />}
                      </button>
                    )
                  })}
                </div>
              )}
              <Link href="/events" className="btn btn-secondary px-4 py-2 text-sm">
                View all events <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="relative">
            {evLoading ? (
              <div className="flex gap-4 px-6 overflow-hidden">
                {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : events.length === 0 ? (
              <div className="mx-6 card py-16 text-center">
                <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ink-5)' }} />
                <p className="font-semibold mb-1">No open events right now</p>
                <p className="text-sm mb-4" style={{ color: 'var(--ink-3)' }}>Check back soon, or create one yourself.</p>
                <Link href="/register" className="btn btn-primary px-4 py-2 text-sm mx-auto" style={{ display: 'inline-flex' }}>
                  Host an event
                </Link>
              </div>
            ) : (
              <>
                {canScrollLeft && <div className="fade-l absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" />}
                {canScrollRight && <div className="fade-r absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" />}
                <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 hide-scroll"
                  style={{ paddingLeft: 24, paddingRight: 24, WebkitOverflowScrolling: 'touch' }}>
                  {events.map(event => <EventCard key={event.id} event={event} />)}
                  <Link href="/events"
                    className="end-card flex-shrink-0 flex flex-col items-center justify-center gap-3 card-hover"
                    style={{ width: 200, minHeight: 340, borderRadius: 14, textDecoration: 'none', color: 'inherit' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)' }}>
                      <ArrowRight className="w-6 h-6" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="text-center px-4">
                      <p className="font-semibold text-sm mb-1">See all events</p>
                      <p className="text-xs" style={{ color: 'var(--ink-3)' }}>Browse, filter & search every open event</p>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-20 px-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(180deg,var(--surface) 0%,rgba(249,216,192,0.38) 100%)' }}>
          <div className="orb" style={{
            width: 580, height: 580,
            background: 'radial-gradient(circle,rgba(229,116,49,0.26) 0%,transparent 68%)',
            bottom: -150, left: -100
          }} />
          <div className="orb" style={{
            width: 420, height: 420,
            background: 'radial-gradient(circle,rgba(244,162,97,0.22) 0%,transparent 68%)',
            top: -80, right: 60
          }} />

          <div className="max-w-5xl mx-auto relative">
            <div className="text-center mb-12">
              <p className="label-xs mb-3" style={{ color: 'var(--accent)' }}>Platform Features</p>
              <h2 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Built around real event workflows
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className={`feat-card p-5 slide-up stagger-${Math.min(i + 1, 6)}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4"
                    style={{
                      background: 'linear-gradient(135deg,var(--accent-light),var(--accent-mid))',
                      border: '1px solid var(--accent-mid)'
                    }}>
                    <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  </div>
                  <h3 className="font-semibold text-[15px] mb-1.5">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Demo credentials ── */}
        <section className="py-20 px-6 relative overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="orb" style={{
            width: 460, height: 460,
            background: 'radial-gradient(circle,rgba(229,116,49,0.22) 0%,transparent 68%)',
            top: 0, right: -80
          }} />

          <div className="max-w-3xl mx-auto relative">
            <div className="text-center mb-12">
              <p className="label-xs mb-3" style={{ color: 'var(--accent)' }}>Demo Access</p>
              <h2 className="text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Try either role now
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {demos.map(({ role, email, pass, gradient, glow, perks }) => (
                <Link key={role} href="/login" className="card card-hover p-5 group block" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: gradient, boxShadow: `0 2px 8px ${glow}` }}>
                      <span className="text-white text-sm font-bold">{role[0]}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-semibold text-[15px]">{role}</span>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--accent)' }} />
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {perks.map(p => (
                      <div key={p} className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-2)' }}>
                        <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} />{p}
                      </div>
                    ))}
                  </div>
                  <div className="demo-code mono text-xs rounded-lg px-3 py-2.5 space-y-0.5">
                    <div className="flex gap-3">
                      <span style={{ color: 'var(--ink-4)' }}>email</span>
                      <span style={{ color: 'var(--ink-2)' }}>{email}</span>
                    </div>
                    <div className="flex gap-3">
                      <span style={{ color: 'var(--ink-4)' }}>pass </span>
                      <span style={{ color: 'var(--ink-2)' }}>{pass}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t py-8 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="logo-bg w-6 h-6 rounded-md flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-sm">EventOS</span>
            </div>
            <span className="text-sm" style={{ color: 'var(--ink-4)' }}>Built for hackathons. Designed to win.</span>
          </div>
        </footer>
      </div>
    </>
  )
}