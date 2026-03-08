// Path: app/(dashboard)/organizer/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Loader2, Calendar, MapPin, Users, BarChart3 } from 'lucide-react'

import { eventsService } from '@/services/events.service'
import { authService } from '@/services/auth.service'
import { Event, CreateEventPayload, EventType, EventAnalytics, User } from '@/types'
import { formatDate } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-neutral', PUBLISHED: 'badge-blue',
  ONGOING: 'badge-green', COMPLETED: 'badge-indigo', CANCELLED: 'badge-red',
}

const defaultForm: CreateEventPayload = {
  title: '', description: '', type: 'TEAM', start_date: '', end_date: '',
  location: '', max_participants: 100, max_team_size: 4, min_team_size: 2,
  registration_deadline: '', tags: [], cover_image: '',
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-5)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="mono text-xs font-medium" style={{ color }}>{score}</span>
    </div>
  )
}

export default function OrganizerPage() {
  const [user, setUser] = useState<User | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [analytics, setAnalytics] = useState<Record<string, EventAnalytics>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateEventPayload>(defaultForm)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')

  const load = useCallback(async () => {
    let u = user
    if (!u) {
      u = await authService.getCurrentUser()
      setUser(u)
    }
    if (!u) return
    setLoading(true)
    // Only fetch events created by this user
    const res = await eventsService.getAll({ created_by: u.id })
    setEvents(res.data ?? [])
    const map: Record<string, EventAnalytics> = {}
    await Promise.all((res.data ?? []).map(async (e: Event) => {
      const a = await eventsService.getAnalytics(e.id)
      if (a.data) map[e.id] = a.data
    }))
    setAnalytics(map)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(''); setSaving(true)

    let coverUrl = form.cover_image ?? ''

    // Upload image if selected
    if (imageFile) {
      const fd = new FormData()
      fd.append('file', imageFile)
      try {
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        const uploadData = await uploadRes.json()
        if (!uploadData.success) {
          setError(uploadData.error ?? 'Image upload failed'); setSaving(false); return
        }
        coverUrl = uploadData.url
      } catch {
        setError('Image upload failed'); setSaving(false); return
      }
    }

    const res = await eventsService.create({ ...form, cover_image: coverUrl || undefined, created_by: user.id })
    if (!res.success) { setError(res.error ?? 'Failed'); setSaving(false); return }
    await load(); setShowCreate(false); setForm(defaultForm); setImageFile(null); setImagePreview(''); setSaving(false)
  }

  async function updateStatus(id: string, status: Event['status']) {
    if (!user) return
    await eventsService.updateStatus(id, status, user.id); await load()
  }

  async function deleteEvent(id: string) {
    if (!user || !confirm('Delete this event? This cannot be undone.')) return
    await eventsService.delete(id, user.id); await load()
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) { setForm({ ...form, tags: [...form.tags, t] }); setTagInput('') }
  }

  const totalRegs = events.reduce((s, e) => s + (e.registration_count ?? 0), 0)
  const totalCheckin = events.reduce((s, e) => s + (e.checkin_count ?? 0), 0)
  const active = events.filter(e => ['PUBLISHED', 'ONGOING'].includes(e.status)).length

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 fade-in">
        <div>
          <p className="label-xs mb-1">Organizer Dashboard</p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>My Events</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>Events you&apos;ve created and manage</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary px-4 py-2 text-sm">
          <Plus className="w-3.5 h-3.5" /> Create Event
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Your Events', value: events.length, sub: `${active} live` },
          { label: 'Registrations', value: totalRegs, sub: 'across all events' },
          { label: 'Checked In', value: totalCheckin, sub: 'total attendees' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="card bg-white p-4 slide-up">
            <p className="label-xs mb-3">{label}</p>
            <div className="stat-num mb-1">{value}</div>
            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-sm" style={{ color: 'var(--ink-3)' }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--ink-4)', borderTopColor: 'var(--accent)' }} /> Loading…
        </div>
      ) : events.length === 0 ? (
        <div className="card bg-white py-20 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ink-5)' }} />
          <p className="text-base font-semibold mb-1">No events yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-3)' }}>Create your first event and start accepting registrations</p>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary px-4 py-2 text-sm mx-auto">
            <Plus className="w-3.5 h-3.5" /> Create Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {events.map((event, i) => {
            const a = analytics[event.id]
            const fill = Math.min(((event.registration_count ?? 0) / event.max_participants) * 100, 100)
            return (
              <div key={event.id} className="card card-hover bg-white p-5 slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-3">
                    <h3 className="font-bold text-[15px] mb-2">{event.title}</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`badge ${STATUS_BADGE[event.status]}`}>{event.status}</span>
                      <span className="badge badge-neutral">{event.type}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(event.id)}
                    className="p-1.5 rounded-lg transition-all flex-shrink-0"
                    style={{ color: 'var(--ink-4)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-light)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent' }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-sm leading-relaxed mb-4 line-clamp-2" style={{ color: 'var(--ink-3)' }}>{event.description}</p>

                <div className="space-y-1.5 mb-4">
                  {[
                    { icon: MapPin, text: event.location },
                    { icon: Calendar, text: `${formatDate(event.start_date)} → ${formatDate(event.end_date)}` },
                    { icon: Users, text: `${event.registration_count ?? 0} / ${event.max_participants} registered` },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-3)' }}>
                      <Icon className="w-3 h-3 flex-shrink-0" />{text}
                    </div>
                  ))}
                </div>

                {event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {event.tags.map(t => <span key={t} className="badge badge-indigo">{t}</span>)}
                  </div>
                )}

                {/* Fill + health */}
                <div className="mb-4 space-y-2">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--ink-5)' }}>
                    <div className="h-full rounded-full" style={{ width: `${fill}%`, background: fill > 85 ? 'var(--red)' : 'var(--accent)' }} />
                  </div>
                  {a && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-3)' }}>
                      <BarChart3 className="w-3 h-3" />
                      <span>Health</span>
                      <div className="flex-1"><HealthBar score={a.health_score} /></div>
                    </div>
                  )}
                </div>

                {/* Status actions */}
                <div className="flex gap-1.5 flex-wrap">
                  {event.status === 'DRAFT' && (
                    <button onClick={() => updateStatus(event.id, 'PUBLISHED')} className="btn btn-secondary px-3 py-1.5 text-xs rounded-lg">Publish</button>
                  )}
                  {event.status === 'PUBLISHED' && (
                    <button onClick={() => updateStatus(event.id, 'ONGOING')} className="btn btn-secondary px-3 py-1.5 text-xs rounded-lg">Mark Ongoing</button>
                  )}
                  {event.status === 'ONGOING' && (
                    <button onClick={() => updateStatus(event.id, 'COMPLETED')} className="btn btn-secondary px-3 py-1.5 text-xs rounded-lg">Complete</button>
                  )}
                  {['PUBLISHED', 'DRAFT'].includes(event.status) && (
                    <button onClick={() => updateStatus(event.id, 'CANCELLED')} className="btn btn-danger px-3 py-1.5 text-xs rounded-lg">Cancel</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,15,16,0.4)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto slide-up"
            style={{ boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-[15px]">Create New Event</h2>
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost p-1.5 rounded-lg">
                <X className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Event Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="HackFest 2025" className="input" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={3} className="input resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as EventType })} className="input">
                    <option value="TEAM">Team</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Location</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required placeholder="Mumbai, India" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Start Date</label>
                  <input type="datetime-local" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>End Date</label>
                  <input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Registration Deadline</label>
                  <input type="datetime-local" value={form.registration_deadline} onChange={e => setForm({ ...form, registration_deadline: e.target.value })} required className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Max Participants</label>
                  <input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: +e.target.value })} min={1} className="input" />
                </div>
                {form.type === 'TEAM' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Min Team Size</label>
                      <input type="number" value={form.min_team_size} onChange={e => setForm({ ...form, min_team_size: +e.target.value })} min={2} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Max Team Size</label>
                      <input type="number" value={form.max_team_size} onChange={e => setForm({ ...form, max_team_size: +e.target.value })} min={2} className="input" />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Tags</label>
                  <div className="flex gap-2">
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder="React, Python, Design… (press Enter)" className="input flex-1" />
                    <button type="button" onClick={addTag} className="btn btn-secondary px-3 py-2 text-sm rounded-lg">Add</button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.tags.map(t => (
                        <span key={t} className="badge badge-indigo flex items-center gap-1.5">
                          {t}
                          <button type="button" onClick={() => setForm({ ...form, tags: form.tags.filter(x => x !== t) })} className="opacity-60 hover:opacity-100">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cover Image Upload */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Cover Image <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
                  {imagePreview ? (
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8, border: '1px solid var(--border)' }}>
                      <img src={imagePreview} alt="Preview" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview('') }}
                        className="p-1.5 rounded-lg"
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', cursor: 'pointer' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '24px 16px', borderRadius: 12, cursor: 'pointer',
                      border: '2px dashed var(--border)', background: 'var(--surface)',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      <Upload className="w-5 h-5" style={{ color: 'var(--ink-4)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--ink-3)' }}>Click to upload banner image</span>
                      <span className="text-xs" style={{ color: 'var(--ink-4)' }}>JPEG, PNG, WebP • Max 5MB</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setImageFile(file)
                            setImagePreview(URL.createObjectURL(file))
                          }
                        }} />
                    </label>
                  )}
                </div>
              </div>
              {error && <div className="mt-4 badge badge-red px-3.5 py-2.5 text-xs rounded-lg w-full">{error}</div>}
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2 text-sm">
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</> : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}