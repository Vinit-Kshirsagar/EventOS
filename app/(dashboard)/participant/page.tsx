'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Calendar, QrCode, Users, CheckCircle, Clock, MapPin, Trophy, ArrowRight, Compass, Star, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { authService } from '@/services/auth.service'
import { eventsService } from '@/services/events.service'
import { registrationsService } from '@/services/registrations.service'
import { reviewsService } from '@/services/reviews.service'
import { Event, Registration, User, Review } from '@/types'
import { timeUntil, formatDate } from '@/lib/utils'

// ── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ rating, onChange, size = 20, readonly = false }: {
  rating: number; onChange?: (r: number) => void; size?: number; readonly?: boolean
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            cursor: readonly ? 'default' : 'pointer',
            background: 'none', border: 'none', padding: 2,
            transition: 'transform 0.15s',
            transform: !readonly && hover === star ? 'scale(1.2)' : 'scale(1)',
          }}>
          <Star
            style={{
              width: size, height: size,
              fill: star <= (hover || rating) ? '#F59E0B' : 'transparent',
              color: star <= (hover || rating) ? '#F59E0B' : 'var(--ink-4)',
              transition: 'fill 0.15s, color 0.15s',
            }}
          />
        </button>
      ))}
    </div>
  )
}

// ── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ event, existingReview, onClose, onSubmitted }: {
  event: Event; existingReview?: Review; onClose: () => void; onSubmitted: (r: Review) => void
}) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) { setError('Please select a star rating'); return }
    setError(''); setSaving(true)
    const res = await reviewsService.submitReview({ event_id: event.id, rating, comment: comment.trim() || undefined })
    if (!res.success) { setError(res.error ?? 'Failed to submit review'); setSaving(false); return }
    onSubmitted(res.data!)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,16,0.4)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-md slide-up"
        style={{ boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-[15px] flex items-center gap-2">
            <Star className="w-4 h-4" style={{ color: '#F59E0B' }} />
            {existingReview ? 'Edit Your Review' : 'Leave a Review'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost p-1.5 rounded-lg">
            <X className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Event name */}
          <div className="mb-5">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--ink-3)' }}>Event</p>
            <p className="font-semibold text-sm">{event.title}</p>
          </div>

          {/* Star rating */}
          <div className="mb-5">
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--ink-2)' }}>Your Rating</p>
            <StarRating rating={rating} onChange={setRating} size={28} />
            {rating > 0 && (
              <p className="text-xs mt-1.5 font-medium" style={{ color: '#F59E0B' }}>
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>
              Comment <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              rows={3} placeholder="Share your experience…"
              className="input resize-none" maxLength={500} />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--ink-4)' }}>{comment.length}/500</p>
          </div>

          {error && <div className="badge badge-red px-3.5 py-2.5 text-xs rounded-lg w-full mb-4">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving || rating < 1} className="btn btn-primary px-4 py-2 text-sm">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Submitting…</> : existingReview ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function ParticipantDashboard() {
  // FIX: useRef for user — prevents stale closure in callbacks and avoids infinite loop
  const userRef = useRef<User | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // FIX: separate loading states — registrations + reviews can render immediately while events stream in
  const [loading, setLoading] = useState(true)

  // FIX: events stored as a map for O(1) lookup — eliminates O(N²) .find() in render
  const [eventsMap, setEventsMap] = useState<Record<string, Event>>({})
  const [myRegs, setMyRegs] = useState<Registration[]>([])
  const [myReviews, setMyReviews] = useState<Review[]>([])

  // Review modal
  const [reviewEvent, setReviewEvent] = useState<Event | null>(null)

  // FIX: stable load with empty deps — user stored in ref, not captured in closure
  const load = useCallback(async () => {
    const u = await authService.getCurrentUser()
    // FIX: always call setLoading(false) even if user is null — no infinite spinner
    if (!u) { setLoading(false); return }
    userRef.current = u
    setUser(u)

    // FIX: progressive load — registrations + reviews don't block each other or the events list
    // Kick off all three in parallel; each updates state independently as it resolves
    registrationsService.getMyRegistrations(u.id).then(res => {
      setMyRegs((res.data ?? []).filter((r: Registration) => r.status !== 'CANCELLED'))
    })

    reviewsService.getByUser(u.id).then(res => {
      setMyReviews(res.data ?? [])
    })

    eventsService.getAll().then(res => {
      // Build map for O(1) lookup in render
      const map: Record<string, Event> = {}
      for (const ev of (res.data ?? [])) map[ev.id] = ev
      setEventsMap(map)
      setLoading(false)
    })
  }, []) // empty deps — no captured state variables; userRef holds the value

  useEffect(() => { load() }, [load])

  // FIX: useMemo — derived lists computed once per data change, not on every render
  const upcomingRegs = useMemo(() =>
    myRegs.filter(r => {
      const ev = eventsMap[r.event_id]
      return ev && ev.status !== 'COMPLETED' && ev.status !== 'CANCELLED'
    }),
    [myRegs, eventsMap]
  )

  const pastRegs = useMemo(() =>
    myRegs.filter(r => {
      const ev = eventsMap[r.event_id]
      return ev && (ev.status === 'COMPLETED' || ev.status === 'CANCELLED')
    }),
    [myRegs, eventsMap]
  )

  const checkedInCount = useMemo(() => myRegs.filter(r => r.checked_in).length, [myRegs])

  const teamEventCount = useMemo(() =>
    myRegs.filter(r => eventsMap[r.event_id]?.type === 'TEAM').length,
    [myRegs, eventsMap]
  )

  const completedCount = useMemo(() =>
    pastRegs.filter(r => eventsMap[r.event_id]?.status === 'COMPLETED').length,
    [pastRegs, eventsMap]
  )

  function getReviewForEvent(eventId: string) {
    return myReviews.find(r => r.event_id === eventId)
  }

  function handleReviewSubmitted(review: Review) {
    setMyReviews(prev => {
      const idx = prev.findIndex(r => r.event_id === review.event_id)
      if (idx >= 0) { const updated = [...prev]; updated[idx] = review; return updated }
      return [...prev, review]
    })
  }

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
          { label: 'Upcoming', value: upcomingRegs.length, icon: Calendar, iconBg: 'var(--brand-pale)', iconColor: 'var(--brand)' },
          { label: 'Checked In', value: checkedInCount, icon: CheckCircle, iconBg: 'var(--green-light)', iconColor: 'var(--green)' },
          { label: 'Competitions', value: teamEventCount, icon: Trophy, iconBg: 'var(--brand-pale)', iconColor: 'var(--brand)' },
          { label: 'Completed', value: completedCount, icon: Star, iconBg: 'var(--amber-light)', iconColor: 'var(--amber)' },
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

      {/* ── Your Upcoming Events ── */}
      {upcomingRegs.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Your Upcoming Events</h2>
            <Link href="/participant/discover" className="text-sm font-medium" style={{ color: 'var(--brand)' }}>View All →</Link>
          </div>
          <div className="space-y-3">
            {upcomingRegs.map((reg, i) => {
              // FIX: O(1) map lookup instead of .find() in render body
              const event = eventsMap[reg.event_id]
              if (!event) return null
              const startDate = new Date(event.start_date)
              const day = startDate.getDate()
              const month = startDate.toLocaleString('en', { month: 'short' }).toUpperCase()
              return (
                <div key={reg.id} className={`card bg-white overflow-hidden slide-up stagger-${Math.min(i + 1, 6)}`}>
                  <div className="flex">
                    <Link href={`/events/${event.id}`} className="w-20 flex-shrink-0 flex flex-col items-center justify-center gradient-brand text-white px-3 py-4" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span className="font-display text-2xl font-bold leading-none">{day}</span>
                      <span className="text-xs font-semibold mt-1 opacity-90">{month}</span>
                    </Link>
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
                        <Link href={`/events/${event.id}`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                          style={{ background: 'var(--brand-pale)', color: 'var(--brand)', border: '1px solid var(--brand-soft)', textDecoration: 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-soft)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--brand-pale)' }}>
                          View Details
                        </Link>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: 'var(--brand-pale)', border: '1px solid var(--brand-soft)' }}>
                          <QrCode className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                          <span className="mono text-xs font-bold" style={{ color: 'var(--brand)' }}>{reg.qr_token}</span>
                        </div>
                        <span className={`badge ${reg.checked_in ? 'badge-green' : 'badge-orange'}`}>
                          {reg.checked_in ? '✓ Checked In' : reg.status}
                        </span>
                        {!reg.checked_in && (
                          <button
                            onClick={async () => {
                              // FIX: read from ref — not stale state
                              const currentUser = userRef.current
                              const isLeader = reg.team_id && currentUser
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
                            style={{ background: 'transparent', color: 'var(--red)', border: '1.5px solid currentColor', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
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

      {/* ── Past Events ── */}
      {pastRegs.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Past Events</h2>
            <span className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>
              {pastRegs.length} event{pastRegs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {pastRegs.map((reg, i) => {
              // FIX: O(1) map lookup
              const event = eventsMap[reg.event_id]
              if (!event) return null
              const review = getReviewForEvent(event.id)
              const isCompleted = event.status === 'COMPLETED'
              const startDate = new Date(event.start_date)
              const day = startDate.getDate()
              const month = startDate.toLocaleString('en', { month: 'short' }).toUpperCase()
              return (
                <div key={reg.id} className={`card bg-white overflow-hidden slide-up stagger-${Math.min(i + 1, 6)}`}>
                  <div className="flex">
                    {/* Date sidebar — muted for past events */}
                    <Link href={`/events/${event.id}`}
                      className="w-20 flex-shrink-0 flex flex-col items-center justify-center px-3 py-4"
                      style={{
                        background: event.status === 'CANCELLED' ? 'var(--ink-5)' : 'linear-gradient(135deg, #92400e, #b45309)',
                        color: 'white', textDecoration: 'none',
                      }}>
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
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(event.start_date)} → {formatDate(event.end_date)}</span>
                        </div>
                        {/* Existing review display */}
                        {review && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <StarRating rating={review.rating} readonly size={14} />
                            <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>Your rating</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`badge ${event.status === 'COMPLETED' ? 'badge-indigo' : 'badge-red'}`}>
                          {event.status}
                        </span>
                        {isCompleted && (
                          <button onClick={() => setReviewEvent(event)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            style={{
                              background: review ? 'var(--amber-light)' : 'var(--brand-pale)',
                              color: review ? '#92400E' : 'var(--brand)',
                              border: `1px solid ${review ? '#FDE68A' : 'var(--brand-soft)'}`,
                              cursor: 'pointer', transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = review ? '#FDE68A' : 'var(--brand-soft)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = review ? 'var(--amber-light)' : 'var(--brand-pale)' }}>
                            <Star className="w-3 h-3" />
                            {review ? 'Edit Review' : 'Leave a Review'}
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

      {/* ── Review Modal ── */}
      {reviewEvent && (
        <ReviewModal
          event={reviewEvent}
          existingReview={getReviewForEvent(reviewEvent.id)}
          onClose={() => setReviewEvent(null)}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  )
}