'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Zap, Calendar, MapPin, Clock, Users,
  Image as ImageIcon, Share2, ExternalLink,
} from 'lucide-react'
import type { Event, User, Registration } from '@/types'
import { formatDate, formatDateTime, timeUntil } from '@/lib/utils'
import { authService } from '@/services/auth.service'
import { registrationsService } from '@/services/registrations.service'

/* ─── CSS ──────────────────────────────────────────────────────────────────── */
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
    --green:        #22C55E;
    --red:          #EF4444;

    --shadow-sm:  0 1px 3px rgba(26,18,11,0.08), 0 1px 2px rgba(26,18,11,0.04);
    --shadow-md:  0 4px 16px rgba(26,18,11,0.10), 0 2px 4px rgba(26,18,11,0.06);
    --shadow-lg:  0 12px 40px rgba(26,18,11,0.14), 0 4px 8px rgba(26,18,11,0.08);
    --shadow-brand: 0 8px 32px rgba(229,116,49,0.35);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .orb {
    position: absolute; border-radius: 50%;
    pointer-events: none; filter: blur(80px);
  }

  .nav-glass {
    background: rgba(253,240,232,0.82) !important;
    backdrop-filter: blur(18px) saturate(1.5) !important;
    -webkit-backdrop-filter: blur(18px) saturate(1.5) !important;
    border-bottom: 1px solid rgba(229,116,49,0.18) !important;
  }

  .logo-bg {
    background: linear-gradient(135deg, var(--brand), var(--brand-deep)) !important;
    box-shadow: 0 2px 12px rgba(229,116,49,0.36) !important;
  }

  .footer-glass {
    background: rgba(253,240,232,0.72) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
  }

  .badge {
    display: inline-flex; align-items: center;
    font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 99px;
  }
  .badge-ongoing   { background: #D1FAE5; color: #065F46; }
  .badge-published { background: #DBEAFE; color: #1E40AF; }
  .badge-completed { background: #E0E7FF; color: #3730A3; }
  .badge-cancelled { background: #FEE2E2; color: #991B1B; }
  .badge-draft     { background: var(--ink-6); color: var(--ink-3); }
  .badge-neutral   { background: var(--ink-6); color: var(--ink-3); }

  .tag {
    font-size: 12px; font-weight: 500;
    padding: 4px 12px; border-radius: 8px;
    background: var(--brand-pale); color: var(--brand-deep);
    border: 1px solid var(--brand-mid);
  }

  .btn-brand {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--brand); color: white;
    font-weight: 600; font-size: 15px;
    padding: 14px 28px; border-radius: 14px;
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

  .btn-danger {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: transparent; color: var(--red);
    font-weight: 600; font-size: 14px;
    padding: 12px 24px; border-radius: 14px;
    border: 1.5px solid var(--red); cursor: pointer; text-decoration: none;
    transition: background 0.18s, color 0.18s;
  }
  .btn-danger:hover {
    background: #FEE2E2; color: #991B1B;
  }

  .fill-track { height: 6px; border-radius: 99px; background: var(--ink-6); overflow: hidden; }
  .fill-bar   { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

  .detail-card {
    background: rgba(255,255,255,0.85);
    border: 1.5px solid var(--ink-6);
    border-radius: 20px;
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .info-row {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 16px 0;
    border-bottom: 1px solid var(--ink-6);
  }
  .info-row:last-child { border-bottom: none; }

  .info-icon {
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    background: var(--brand-pale);
  }

  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  .fade-up { animation: fadeUp 0.4s ease both; }
  .d1 { animation-delay:0.05s; } .d2 { animation-delay:0.10s; }
  .d3 { animation-delay:0.15s; } .d4 { animation-delay:0.20s; }

  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
`

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'badge-published', ONGOING: 'badge-ongoing',
  COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
  DRAFT: 'badge-draft',
}

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */
function DetailSkeleton() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ height: 14, width: '20%', borderRadius: 6, background: 'var(--ink-6)', marginBottom: 32, animation: 'pulse 1.5s ease infinite' }} />
      <div style={{ height: 260, borderRadius: 20, background: 'var(--ink-6)', marginBottom: 32, animation: 'pulse 1.5s ease infinite' }} />
      <div style={{ height: 28, width: '60%', borderRadius: 8, background: 'var(--ink-6)', marginBottom: 16, animation: 'pulse 1.5s ease infinite' }} />
      <div style={{ height: 14, width: '40%', borderRadius: 6, background: 'var(--ink-6)', marginBottom: 32, animation: 'pulse 1.5s ease infinite' }} />
      {[1,2,3,4].map(i => (
        <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--ink-6)', marginBottom: 12, animation: 'pulse 1.5s ease infinite' }} />
      ))}
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [myReg, setMyReg] = useState<Registration | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    async function init() {
      const u = await authService.getCurrentUser()
      setUser(u)

      fetch(`/api/events/${id}`)
        .then(r => r.json())
        .then(res => {
          if (res.success) setEvent(res.data)
          else setError(res.error ?? 'Event not found')
          setLoading(false)
        })
        .catch(() => { setError('Failed to load event'); setLoading(false) })

      // If logged in, check registration
      if (u) {
        registrationsService.getMyRegistrations(u.id).then(res => {
          const reg = (res.data ?? []).find(
            (r: Registration) => r.event_id === id && r.status !== 'CANCELLED'
          )
          setMyReg(reg ?? null)
        })
      }
    }
    init()
  }, [id])

  async function handleRegister() {
    if (!user || !event) return
    setRegistering(true)
    const res = await registrationsService.register({ event_id: event.id, user_id: user.id })
    if (res.success) {
      setMyReg(res.data)
    } else {
      alert(res.error ?? 'Registration failed')
    }
    setRegistering(false)
  }

  async function handleCancel() {
    if (!myReg) return
    // Check if user is a team leader for this event
    const isLeader = myReg.team_id && user
    const msg = isLeader
      ? 'You are a team leader. Cancelling your registration will dissolve your team and cancel all team members\' registrations. Are you sure?'
      : 'Cancel your registration for this event?'
    if (!confirm(msg)) return

    setCancelling(true)
    const res = await fetch(`/api/registrations/${myReg.id}/cancel`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setMyReg(null)
    } else {
      alert(data.error ?? 'Failed to cancel')
    }
    setCancelling(false)
  }

  const fill = event ? Math.min(((event.registration_count ?? 0) / event.max_participants) * 100, 100) : 0
  const almostFull = fill > 80
  const spotsLeft = event ? event.max_participants - (event.registration_count ?? 0) : 0
  const deadlinePassed = event ? new Date(event.registration_deadline) < new Date() : false
  const canRegister = event && !deadlinePassed && !myReg && ['PUBLISHED', 'ONGOING'].includes(event.status)

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>

        {/* ── Nav ── */}
        <nav className="nav-glass" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{
            maxWidth: 1120, margin: '0 auto', padding: '0 24px',
            height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
              <Link href="/events" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', textDecoration: 'none' }}>Events</Link>
              {event && (
                <>
                  <span style={{ color: 'var(--ink-5)', fontSize: 16 }}>/</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.title}
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {user ? (
                <Link href={user.role === 'ORGANIZER' ? '/organizer' : '/participant'} className="btn-ghost">Dashboard</Link>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost">Sign in</Link>
                  <Link href="/register" className="btn-brand" style={{ fontSize: 13, padding: '10px 18px' }}>
                    Get started <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {loading ? (
          <DetailSkeleton />
        ) : error || !event ? (
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😶</div>
            <h2 className="font-bold" style={{ fontSize: 22, marginBottom: 8 }}>{error || 'Event not found'}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 24 }}>This event might have been removed or the link is incorrect.</p>
            <Link href="/events" className="btn-ghost"><ArrowLeft className="w-3.5 h-3.5" /> Back to Events</Link>
          </div>
        ) : (
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Background orbs */}
            <div className="orb" style={{ width:500, height:500,
              background:'radial-gradient(circle,rgba(229,116,49,0.25) 0%,transparent 68%)',
              top:-160, right:-120, zIndex:0 }} />
            <div className="orb" style={{ width:380, height:380,
              background:'radial-gradient(circle,rgba(244,162,97,0.20) 0%,transparent 68%)',
              bottom:100, left:-80, zIndex:0 }} />

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px', position: 'relative', zIndex: 1 }}>

              {/* ── Back link ── */}
              <Link href="/events" className="fade-up" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 24,
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Events
              </Link>

              {/* ── Banner ── */}
              <div className="fade-up d1" style={{
                height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: 32,
                position: 'relative',
                background: event.cover_image
                  ? `url(${event.cover_image}) center/cover no-repeat`
                  : 'linear-gradient(135deg, #E57431 0%, #C45E1F 50%, #9A3E0A 100%)',
              }}>
                {/* Overlay for readability */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: event.cover_image
                    ? 'linear-gradient(180deg, rgba(26,18,11,0.1) 0%, rgba(26,18,11,0.55) 100%)'
                    : 'none',
                }} />
                {/* Status badge + type */}
                <div style={{ position: 'absolute', top: 20, left: 24, display: 'flex', gap: 8 }}>
                  <span className={`badge ${STATUS_BADGE[event.status] ?? 'badge-neutral'}`} style={{ fontSize: 11, padding: '4px 10px' }}>
                    {event.status}
                  </span>
                  <span className="badge badge-neutral" style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(255,255,255,0.85)' }}>
                    {event.type === 'TEAM' ? '👥 Team Event' : '👤 Individual'}
                  </span>
                </div>
                {/* No image placeholder */}
                {!event.cover_image && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0.15,
                  }}>
                    <Zap style={{ width: 120, height: 120, color: 'white' }} strokeWidth={1} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>
                {/* ── Main Column ── */}
                <div className="fade-up d2">
                  {/* Organizer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--brand), var(--brand-deep))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 13, fontWeight: 700,
                    }}>
                      {event.organizer?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                        {event.organizer?.name ?? 'Organizer'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Event Organizer</div>
                    </div>
                  </div>

                  {/* Title */}
                  <h1 className="font-bold tracking-tight" style={{
                    fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em',
                    lineHeight: 1.15, marginBottom: 8,
                  }}>
                    {event.title}
                  </h1>

                  {/* Tags */}
                  {event.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                      {event.tags.map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}

                  {/* Description */}
                  <div style={{ marginBottom: 32 }}>
                    <h3 className="font-bold" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--ink-2)' }}>
                      About this event
                    </h3>
                    <p style={{
                      fontSize: 14, lineHeight: 1.8, color: 'var(--ink-3)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {event.description}
                    </p>
                  </div>

                  {/* Info rows */}
                  <div className="detail-card" style={{ padding: '8px 24px', marginBottom: 32 }}>
                    <div className="info-row">
                      <div className="info-icon"><MapPin className="w-4 h-4" style={{ color: 'var(--brand)' }} /></div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Location</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>{event.location}</div>
                      </div>
                    </div>

                    <div className="info-row">
                      <div className="info-icon"><Calendar className="w-4 h-4" style={{ color: 'var(--brand)' }} /></div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date & Time</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
                          {formatDateTime(event.start_date)} — {formatDateTime(event.end_date)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{timeUntil(event.start_date)}</div>
                      </div>
                    </div>

                    <div className="info-row">
                      <div className="info-icon"><Clock className="w-4 h-4" style={{ color: 'var(--brand)' }} /></div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Registration Deadline</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: deadlinePassed ? 'var(--red)' : 'var(--ink-2)' }}>
                          {formatDateTime(event.registration_deadline)}
                          {deadlinePassed && <span style={{ fontSize: 11, marginLeft: 8, fontWeight: 700, color: 'var(--red)' }}>CLOSED</span>}
                        </div>
                      </div>
                    </div>

                    {event.type === 'TEAM' && (
                      <div className="info-row">
                        <div className="info-icon"><Users className="w-4 h-4" style={{ color: 'var(--brand)' }} /></div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Team Size</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
                            {event.min_team_size ?? 2} – {event.max_team_size ?? 4} members per team
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="info-row">
                      <div className="info-icon"><Users className="w-4 h-4" style={{ color: 'var(--brand)' }} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Capacity</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-3)', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{event.registration_count ?? 0} / {event.max_participants} registered</span>
                          {almostFull
                            ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>Almost full!</span>
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
                    </div>
                  </div>
                </div>

                {/* ── Sidebar ── */}
                <div className="fade-up d3" style={{ position: 'sticky', top: 80 }}>
                  <div className="detail-card" style={{ padding: 24 }}>
                    {/* Registration status */}
                    {myReg ? (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{
                          padding: '14px 16px', borderRadius: 14,
                          background: '#D1FAE5', border: '1.5px solid #A7F3D0',
                          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ color: 'white', fontSize: 14 }}>✓</span>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>You're registered!</div>
                            <div style={{ fontSize: 11, color: '#047857' }}>QR: {myReg.qr_token}</div>
                          </div>
                        </div>
                        <button
                          onClick={handleCancel}
                          disabled={cancelling}
                          className="btn-danger"
                          style={{ width: '100%', fontSize: 13, padding: '10px 16px' }}
                        >
                          {cancelling ? 'Cancelling...' : 'Cancel Registration'}
                        </button>
                      </div>
                    ) : canRegister ? (
                      <div style={{ marginBottom: 20 }}>
                        {user ? (
                          <button onClick={handleRegister} disabled={registering} className="btn-brand" style={{ width: '100%' }}>
                            {registering ? 'Registering...' : <>Register Now <ArrowRight className="w-4 h-4" /></>}
                          </button>
                        ) : (
                          <Link href="/login" className="btn-brand" style={{ width: '100%' }}>
                            Sign in to Register <ArrowRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        marginBottom: 20, padding: '14px 16px', borderRadius: 14,
                        background: 'var(--ink-6)', border: '1.5px solid var(--ink-5)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
                          {deadlinePassed ? 'Registration is closed' : 'Registration is not available'}
                        </div>
                      </div>
                    )}

                    {/* Quick stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--brand-pale)', border: '1px solid var(--brand-mid)' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-deep)', letterSpacing: '-0.02em' }}>
                          {event.registration_count ?? 0}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-4)' }}>Registered</div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--brand-pale)', border: '1px solid var(--brand-mid)' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-deep)', letterSpacing: '-0.02em' }}>
                          {spotsLeft}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-4)' }}>Spots Left</div>
                      </div>
                    </div>

                    {/* Event type + team link */}
                    {event.type === 'TEAM' && myReg && (
                      <Link href={`/participant/discover`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '12px 16px', borderRadius: 14,
                          background: 'var(--brand-pale)', border: '1.5px solid var(--brand-mid)',
                          textDecoration: 'none', color: 'var(--brand-deep)',
                          fontSize: 13, fontWeight: 600,
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-mid)'; e.currentTarget.style.borderColor = 'var(--brand)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-pale)'; e.currentTarget.style.borderColor = 'var(--brand-mid)' }}
                      >
                        <Users className="w-4 h-4" /> Find a Team <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    {/* Share */}
                    <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!') }}
                      style={{
                        marginTop: 12, width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 12,
                        background: 'transparent', border: '1.5px solid var(--ink-5)',
                        color: 'var(--ink-3)', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-5)'; e.currentTarget.style.color = 'var(--ink-3)' }}
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share Event
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="footer-glass" style={{ borderTop: '1px solid rgba(229,116,49,0.18)', padding: '28px 24px' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
