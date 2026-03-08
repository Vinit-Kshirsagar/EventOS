'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Zap, Calendar, MapPin, Clock, Users,
  Search, X, ArrowLeft, Flame, Cpu, Globe2,
} from 'lucide-react'
import type { Event } from '@/types'
import { formatDate, timeUntil } from '@/lib/utils'

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const CSS = `
  :root {
    --brand:        #E57431;
    --brand-deep:   #C45E1F;
    --brand-glow:   #F4A261;
    --brand-pale:   #FDF0E8;
    --brand-mid:    #F9D8C0;

    --ink:          #1A120B;
    --ink-2:        #2E1F14;
    --ink-3:        #6B4A35;
    --ink-4:        #A07560;
    --ink-5:        #D9C4B8;
    --ink-6:        #F5EDE6;
    --surface:      #FDF0E8;
    --white:        #FFFFFF;

    --shadow-sm:  0 1px 3px rgba(26,18,11,0.08), 0 1px 2px rgba(26,18,11,0.04);
    --shadow-md:  0 4px 16px rgba(26,18,11,0.10), 0 2px 4px rgba(26,18,11,0.06);
    --shadow-lg:  0 12px 40px rgba(26,18,11,0.14), 0 4px 8px rgba(26,18,11,0.08);
    --shadow-brand: 0 8px 32px rgba(229,116,49,0.35);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

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

  .ecard {
    background: rgba(255,255,255,0.82);
    border-radius: 16px;
    border: 1.5px solid var(--ink-6);
    box-shadow: var(--shadow-sm);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .ecard:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--brand-mid);
  }

  .fill-track { height: 5px; border-radius: 99px; background: var(--ink-6); overflow: hidden; }
  .fill-bar   { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

  .badge {
    display: inline-flex; align-items: center;
    font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 99px;
  }
  .badge-ongoing   { background: #D1FAE5; color: #065F46; }
  .badge-published { background: #DBEAFE; color: #1E40AF; }
  .badge-neutral   { background: var(--ink-6); color: var(--ink-3); }

  .tag {
    font-size: 11px; font-weight: 500;
    padding: 2px 9px; border-radius: 6px;
    background: var(--brand-pale); color: var(--brand-deep);
    border: 1px solid var(--brand-mid);
  }

  .btn-brand {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: var(--brand); color: white;
    font-weight: 600; font-size: 13px;
    padding: 10px 18px; border-radius: 10px;
    border: none; cursor: pointer; text-decoration: none;
    box-shadow: 0 2px 8px rgba(229,116,49,0.28);
    transition: background 0.18s, transform 0.15s, box-shadow 0.18s;
  }
  .btn-brand:hover {
    background: var(--brand-deep);
    transform: translateY(-1px);
    box-shadow: var(--shadow-brand);
  }

  .btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; color: var(--ink-3);
    font-size: 13px; font-weight: 500;
    padding: 9px 16px; border-radius: 10px;
    border: 1.5px solid var(--ink-5);
    cursor: pointer; text-decoration: none;
    transition: border-color 0.18s, color 0.18s, background 0.18s;
  }
  .btn-ghost:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-pale); }

  .search-wrap { position: relative; }
  .search-input {
    width: 100%; padding: 10px 16px 10px 40px;
    background: var(--white); color: var(--ink);
    border: 1.5px solid var(--ink-5); border-radius: 12px;
    font-size: 14px;
    outline: none; box-shadow: var(--shadow-sm);
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .search-input::placeholder { color: var(--ink-4); }
  .search-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(229,116,49,0.12); }

  .sec-icon {
    width: 34px; height: 34px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  @media (max-width: 767px) {
    .event-row {
      display: flex; overflow-x: auto; gap: 14px;
      padding-bottom: 8px; scroll-snap-type: x mandatory;
      -ms-overflow-style: none; scrollbar-width: none;
    }
    .event-row::-webkit-scrollbar { display: none; }
    .event-row > * { min-width: 280px; scroll-snap-align: start; }
  }
  @media (min-width: 768px) {
    .event-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  }

  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  .fade-up { animation: fadeUp 0.4s ease both; }
  .d1 { animation-delay:0.05s; } .d2 { animation-delay:0.10s; }
  .d3 { animation-delay:0.15s; } .d4 { animation-delay:0.20s; }

  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

  /* ─ Nav + footer glass (matching landing) ─ */
  .nav-glass-applied {
    background: rgba(253,240,232,0.82) !important;
    backdrop-filter: blur(18px) saturate(1.5) !important;
    -webkit-backdrop-filter: blur(18px) saturate(1.5) !important;
  }

  /* ─ Search input glass ─ */
  .search-input {
    background: rgba(255,255,255,0.80) !important;
    backdrop-filter: blur(10px) !important;
  }
  .search-input:focus {
    background: rgba(255,255,255,0.95) !important;
  }

  /* ─ Logo bg ─ */
  .logo-bg {
    background: linear-gradient(135deg, var(--brand), var(--brand-deep)) !important;
    box-shadow: 0 2px 12px rgba(229,116,49,0.36) !important;
  }

  /* ─ Sign-up nudge card ─ */
  .nudge-card {
    background: rgba(253,240,232,0.75) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
  }

  /* ─ Footer glass ─ */
  .footer-glass {
    background: rgba(253,240,232,0.72) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
  }
`

/* ─── Section definitions ────────────────────────────────────────────────── */
type EventSection = {
  key: string; label: string; icon: React.ReactNode;
  iconBg: string; iconColor: string; keywords: string[];
}

const SECTIONS: EventSection[] = [
  {
    key: 'hackathon', label: 'Hackathons',
    icon: <Flame className="w-4 h-4" />,
    iconBg: '#FEE2D5', iconColor: '#C45E1F',
    keywords: ['hackathon', 'hack', 'build', 'code', 'sprint'],
  },
  {
    key: 'tech', label: 'Tech Events',
    icon: <Cpu className="w-4 h-4" />,
    iconBg: '#E0F2FE', iconColor: '#0369A1',
    keywords: ['tech', 'workshop', 'bootcamp', 'webinar', 'conference', 'meetup', 'seminar'],
  },
  {
    key: 'summit', label: 'Summits',
    icon: <Globe2 className="w-4 h-4" />,
    iconBg: '#D1FAE5', iconColor: '#065F46',
    keywords: ['summit', 'forum', 'expo', 'symposium', 'congress', 'gala'],
  },
]

function classifyEvent(event: Event): string {
  const text = `${event.title} ${event.description} ${event.tags.join(' ')}`.toLowerCase()
  for (const sec of SECTIONS) {
    if (sec.keywords.some(k => text.includes(k))) return sec.key
  }
  return 'tech'
}

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'badge-published', ONGOING: 'badge-ongoing',
}

/* ─── Card ───────────────────────────────────────────────────────────────── */
function EventCard({ event, delayClass = '' }: { event: Event; delayClass?: string }) {
  const fill = Math.min(((event.registration_count ?? 0) / event.max_participants) * 100, 100)
  const almostFull = fill > 80
  const spotsLeft = event.max_participants - (event.registration_count ?? 0)

  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
    <div className={`ecard fade-up ${delayClass}`}>
      {/* Top accent stripe */}
      <div style={{
        height: 3,
        background: almostFull
          ? 'linear-gradient(90deg,#EF4444,#F97316)'
          : 'linear-gradient(90deg,var(--brand),var(--brand-glow))',
      }} />

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Organizer + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            background: 'linear-gradient(135deg,var(--brand),var(--brand-deep))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 10, fontWeight: 700,
          }}>
            {event.organizer?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 500, color: 'var(--ink-3)', flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {event.organizer?.name ?? 'Organizer'}
          </span>
          <span className={`badge ${STATUS_BADGE[event.status] ?? 'badge-neutral'}`}>
            {event.status}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold tracking-tight" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
          {event.title}
        </h3>

        {/* Description */}
        <p style={{
          fontSize: 13, lineHeight: 1.6, color: 'var(--ink-3)', marginBottom: 16, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {event.description}
        </p>

        {/* Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {([
            { icon: <MapPin className="w-3 h-3" />, text: event.location },
            { icon: <Calendar className="w-3 h-3" />, text: formatDate(event.start_date), pill: timeUntil(event.start_date) },
            { icon: <Clock className="w-3 h-3" />, text: `Deadline ${formatDate(event.registration_deadline)}` },
            {
              icon: <Users className="w-3 h-3" />,
              text: event.type === 'TEAM'
                ? `Teams of ${event.min_team_size ?? 2}–${event.max_team_size ?? 4}`
                : 'Individual',
            },
          ] as { icon: React.ReactNode; text: string; pill?: string }[]).map(({ icon, text, pill }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
              <span style={{ color: 'var(--brand)', flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1 }}>{text}</span>
              {pill && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 6,
                  background: 'var(--brand-pale)', color: 'var(--brand-deep)',
                  border: '1px solid var(--brand-mid)',
                }}>{pill}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {event.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
        )}

        {/* Fill bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginBottom: 5 }}>
            <span>{event.registration_count ?? 0} / {event.max_participants}</span>
            {almostFull
              ? <span style={{ color: '#EF4444', fontWeight: 600 }}>Almost full!</span>
              : <span>{spotsLeft} spots left</span>}
          </div>
          <div className="fill-track">
            <div className="fill-bar" style={{
              width: `${fill}%`,
              background: almostFull
                ? 'linear-gradient(90deg,#EF4444,#F97316)'
                : 'linear-gradient(90deg,var(--brand),var(--brand-glow))',
            }} />
          </div>
        </div>

        {/* CTA */}

        <Link href="/register" className="btn-brand" style={{ width: '100%' }}>
          Register — it&apos;s free <ArrowRight className="w-3.5 h-3.5" />

        </Link>
      </div>
    </div>
    </Link>
  )
}

/* ─── Section block ──────────────────────────────────────────────────────── */
function SectionBlock({ section, events }: { section: EventSection; events: Event[] }) {
  if (events.length === 0) return null
  const delays = ['d1', 'd2', 'd3', 'd4']
  return (
    <section style={{ marginBottom: 56 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {/* Left accent bar */}
        <div style={{
          width: 4, height: 28, borderRadius: 2,
          background: 'linear-gradient(180deg,var(--brand),var(--brand-glow))', flexShrink: 0
        }} />
        <div className="sec-icon" style={{ background: section.iconBg, color: section.iconColor }}>
          {section.icon}
        </div>
        <h2 className="font-bold tracking-tight" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em' }}>
          {section.label}
        </h2>
        <span style={{
          fontSize: 11, fontWeight: 600,
          padding: '3px 9px', borderRadius: 99,
          background: 'var(--brand-pale)', color: 'var(--brand-deep)',
          border: '1px solid var(--brand-mid)',
        }}>
          {events.length}
        </span>
        {/* Divider line */}
        <div style={{ flex: 1, height: 1, background: 'var(--ink-6)', marginLeft: 4 }} />
      </div>

      <div className="event-row">
        {events.map((e, i) => (
          <EventCard key={e.id} event={e} delayClass={delays[i % 4]} />
        ))}
      </div>
    </section>
  )
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="ecard" style={{ minHeight: 340 }}>
          <div style={{ height: 3, background: 'var(--ink-6)' }} />
          <div style={{ padding: 20 }}>
            {([[50, 10], [80, 14], [95, 11], [70, 11]] as [number, number][]).map(([w, h], j) => (
              <div key={j} style={{
                height: h, width: `${w}%`, borderRadius: 6,
                background: 'var(--ink-6)', marginBottom: 10,
                animation: 'pulse 1.5s ease infinite',
              }} />
            ))}
            <div style={{
              height: 38, borderRadius: 10, background: 'var(--ink-6)', marginTop: 24,
              animation: 'pulse 1.5s ease infinite'
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
type SortOption = 'soonest' | 'newest' | 'most-registered'

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('soonest')

  useEffect(() => {
    Promise.all([
      fetch('/api/events?status=PUBLISHED').then(r => r.json()),
      fetch('/api/events?status=ONGOING').then(r => r.json()),
    ])
      .then(([pub, ong]) => {
        setEvents([...(pub.data ?? []), ...(ong.data ?? [])])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    let list = [...events]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)) ||
        e.organizer?.name?.toLowerCase().includes(q)
      )
    }

    if (sort === 'newest') list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    else if (sort === 'soonest') list.sort((a, b) => +new Date(a.start_date) - +new Date(b.start_date))
    else if (sort === 'most-registered') list.sort((a, b) => (b.registration_count ?? 0) - (a.registration_count ?? 0))

    const groups: Record<string, Event[]> = {}
    for (const s of SECTIONS) groups[s.key] = []
    for (const e of list) {
      const key = classifyEvent(e)
      groups[key].push(e)
    }
    return groups
  }, [events, search, sort])

  const totalShown = Object.values(grouped).flat().length
  const activeSections = SECTIONS.filter(s => (grouped[s.key]?.length ?? 0) > 0).length

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>

        {/* ── Nav ── */}
        <nav className="nav-glass" style={{
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{
            maxWidth: 1120, margin: '0 auto', padding: '0 24px',
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                <div className="logo-bg" style={{
                  width: 30, height: 30, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Zap className="w-4 h-4" style={{ color: 'white' }} strokeWidth={2.5} />
                </div>
                <span className="font-bold tracking-tight" style={{ fontWeight: 700, fontSize: 16 }}>EventOS</span>
              </Link>
              <span style={{ color: 'var(--ink-5)', fontSize: 16 }}>/</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>Events</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/register" className="btn-brand">
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </nav>

        <div style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Background orbs */}
          <div className="orb" style={{
            width: 500, height: 500,
            background: 'radial-gradient(circle,rgba(229,116,49,0.32) 0%,transparent 68%)',
            top: -160, right: -120, zIndex: 0
          }} />
          <div className="orb" style={{
            width: 420, height: 420,
            background: 'radial-gradient(circle,rgba(244,162,97,0.26) 0%,transparent 68%)',
            top: 200, left: -140, zIndex: 0
          }} />
          <div className="orb" style={{
            width: 380, height: 380,
            background: 'radial-gradient(circle,rgba(229,116,49,0.20) 0%,transparent 68%)',
            bottom: 100, right: 80, zIndex: 0
          }} />

          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px 80px', position: 'relative', zIndex: 1 }}>

            {/* ── Page header ── */}
            <div className="fade-up" style={{ marginBottom: 36 }}>
              <Link href="/" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 16,
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back to home
              </Link>

              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 16
              }}>
                <div>
                  <p style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 6
                  }}>All Events</p>
                  <h1 className="font-bold tracking-tight" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                    Browse Events
                  </h1>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>
                    {loading
                      ? 'Loading…'
                      : `${totalShown} open event${totalShown !== 1 ? 's' : ''} across ${activeSections} categor${activeSections !== 1 ? 'ies' : 'y'}`}
                  </p>
                </div>

                {/* Sign-up nudge */}
                <div className="nudge-card" style={{
                  padding: '12px 18px', borderRadius: 14,
                  border: '1.5px solid var(--brand-mid)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 13, color: 'var(--brand-deep)', fontWeight: 500 }}>
                    Sign up free to register for any event
                  </span>
                  <Link href="/register" className="btn-brand" style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8 }}>
                    Sign up <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Search + Sort ── */}
            <div className="fade-up d1" style={{ display: 'flex', gap: 10, marginBottom: 44, flexWrap: 'wrap' }}>
              <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
                <Search style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  width: 15, height: 15, color: 'var(--ink-4)', pointerEvents: 'none'
                }} />
                <input
                  className="search-input"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search events, locations, tags, organizers…"
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortOption)}
                style={{
                  padding: '10px 14px', borderRadius: 12, border: '1.5px solid var(--ink-5)',
                  background: 'var(--white)', color: 'var(--ink)', fontSize: 13,
                  cursor: 'pointer', outline: 'none',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <option value="soonest">Starting soonest</option>
                <option value="newest">Newest first</option>
                <option value="most-registered">Most popular</option>
              </select>
            </div>

            {/* ── Content ── */}
            {loading ? (
              <SkeletonGrid />
            ) : totalShown === 0 ? (
              <div style={{
                textAlign: 'center', padding: '80px 24px',
                borderRadius: 20, background: 'var(--white)', border: '1.5px solid var(--ink-6)',
              }}>
                <Calendar style={{ width: 48, height: 48, color: 'var(--ink-5)', margin: '0 auto 16px' }} />
                <p className="font-bold tracking-tight" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {search ? 'No events match your search' : 'No open events right now'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>
                  {search ? 'Try a different keyword' : 'Check back soon, or host your own!'}
                </p>
                {search ? (
                  <button onClick={() => setSearch('')} className="btn-ghost">Clear search</button>
                ) : (
                  <Link href="/register" className="btn-brand">
                    Host an event <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              SECTIONS.map(sec => (
                <SectionBlock key={sec.key} section={sec} events={grouped[sec.key] ?? []} />
              ))
            )}

            {/* ── Bottom CTA ── */}
            {!loading && totalShown > 0 && (
              <div style={{
                position: 'relative', overflow: 'hidden', marginTop: 24,
                padding: '52px 40px', borderRadius: 24, textAlign: 'center',
                background: 'linear-gradient(135deg,var(--brand) 0%,var(--brand-deep) 100%)',
                boxShadow: 'var(--shadow-brand)',
              }}>
                {/* Decorative circles */}
                {[
                  { top: -60, right: -60, size: 220, opacity: 0.07 },
                  { bottom: -40, left: -40, size: 160, opacity: 0.05 },
                ].map((s, i) => (
                  <div key={i} style={{
                    position: 'absolute', borderRadius: '50%',
                    width: s.size, height: s.size,
                    background: `rgba(255,255,255,${s.opacity})`,
                    top: 'top' in s ? s.top : undefined,
                    bottom: 'bottom' in s ? s.bottom : undefined,
                    left: 'left' in s ? s.left : undefined,
                    right: 'right' in s ? s.right : undefined,
                    pointerEvents: 'none',
                  }} />
                ))}

                <h2 className="font-bold tracking-tight" style={{
                  fontSize: 26, fontWeight: 800, color: 'white',
                  letterSpacing: '-0.03em', marginBottom: 10, position: 'relative',
                }}>
                  Ready to join an event?
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 28, position: 'relative' }}>
                  Create a free account in under a minute — no credit card needed.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', position: 'relative' }}>
                  <Link href="/register" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'white', color: 'var(--brand-deep)',
                    fontWeight: 700, fontSize: 14,
                    padding: '11px 24px', borderRadius: 12, textDecoration: 'none',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transition: 'transform 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                    Sign up free <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/login" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.15)', color: 'white',
                    fontWeight: 600, fontSize: 14,
                    padding: '11px 24px', borderRadius: 12, textDecoration: 'none',
                    border: '1.5px solid rgba(255,255,255,0.3)', transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}>
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>{/* end orb wrapper */}

        {/* ── Footer ── */}
        <footer className="footer-glass" style={{ borderTop: '1px solid rgba(229,116,49,0.18)', padding: '28px 24px' }}>
          <div style={{
            maxWidth: 1120, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="logo-bg" style={{
                width: 26, height: 26, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap className="w-3.5 h-3.5" style={{ color: 'white' }} strokeWidth={2.5} />
              </div>
              <span className="font-bold tracking-tight" style={{ fontWeight: 700, fontSize: 14 }}>EventOS</span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Built for hackathons. Designed to win.</span>
          </div>
        </footer>
      </div>
    </>
  )
}