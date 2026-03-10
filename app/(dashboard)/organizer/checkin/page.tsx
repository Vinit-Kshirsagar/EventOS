// Path: app/(dashboard)/organizer/checkin/page.tsx
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { QrCode, CheckCircle, XCircle, Loader2, Search } from 'lucide-react'
import { checkinsService } from '@/services/checkins.service'
import { eventsService } from '@/services/events.service'
import { authService } from '@/services/auth.service'
import { Event, CheckIn, User } from '@/types'
import { formatDateTime } from '@/lib/utils'

export default function OrganizerCheckin() {
  // ── userRef: same pattern as organizer/page.tsx — prevents stale user
  // on refresh where auth session may not be immediately available ──────────
  const userRef = useRef<User | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [loadingCi, setLoadingCi] = useState(false)

  useEffect(() => {
    async function init() {
      const u = await authService.getCurrentUser()
      if (!u) return
      userRef.current = u
      const res = await eventsService.getAll({ created_by: u.id })
      const evs = res.data ?? []
      setEvents(evs)
      if (evs.length) setSelectedId(evs[0].id)
    }
    init()
  }, []) // ← empty deps: runs once on mount

  // loadCi only depends on selectedId — stable, no user dependency needed
  const loadCi = useCallback(async () => {
    if (!selectedId) return
    setLoadingCi(true)
    const res = await checkinsService.getByEvent(selectedId)
    setCheckins(res.data ?? [])
    setLoadingCi(false)
  }, [selectedId])

  useEffect(() => {
    loadCi()
  }, [loadCi])

  async function handleCheckin(e: React.FormEvent) {
    e.preventDefault()
    // ── Read user from ref, not state — avoids stale closure on refresh ────
    const u = userRef.current
    if (!qrInput.trim() || !selectedId || !u) return
    setScanning(true); setResult(null)
    const res = await checkinsService.checkIn(qrInput.trim(), selectedId, u.id)
    setResult(res.success
      ? { ok: true, msg: 'Checked in successfully!' }
      : { ok: false, msg: res.error ?? 'Failed' }
    )
    if (res.success) { setQrInput(''); loadCi() }
    setScanning(false)
    setTimeout(() => setResult(null), 4000)
  }

  const ev = events.find(e => e.id === selectedId)
  const rate = ev && (ev.registration_count ?? 0) > 0
    ? Math.round((checkins.length / (ev.registration_count ?? 1)) * 100)
    : 0

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8 fade-in">
        <p className="label-xs mb-1">Organizer</p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Check-In Scanner</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>Scan QR tokens for your events only</p>
      </div>

      {events.length === 0 ? (
        <div className="card bg-white py-20 text-center">
          <QrCode className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-5)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No events to check in to. Create an event first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Scanner panel ── */}
          <div className="lg:col-span-2 card bg-white p-5 slide-up">
            <div className="mb-4">
              <label className="label-xs block mb-2">Event</label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="input">
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>

            <div className="flex justify-center mb-5">
              <div className="relative w-28 h-28 flex items-center justify-center rounded-xl"
                style={{ border: '2px dashed var(--border-strong)', background: 'var(--ink-6)' }}>
                <QrCode className="w-10 h-10" style={{ color: 'var(--accent)', opacity: 0.5 }} />
                {[
                  'top-2 left-2 border-t-2 border-l-2',
                  'top-2 right-2 border-t-2 border-r-2',
                  'bottom-2 left-2 border-b-2 border-l-2',
                  'bottom-2 right-2 border-b-2 border-r-2',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-4 h-4 rounded-sm ${cls}`}
                    style={{ borderColor: 'var(--accent)' }} />
                ))}
              </div>
            </div>

            <form onSubmit={handleCheckin} className="space-y-3">
              <input
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                placeholder="Enter or scan QR token"
                autoFocus
                className="input mono text-sm"
              />
              <button
                type="submit"
                disabled={scanning || !qrInput.trim()}
                className="btn btn-primary w-full py-2.5 text-sm"
              >
                {scanning
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Checking…</>
                  : <><Search className="w-4 h-4" />Check In</>
                }
              </button>
            </form>

            {result && (
              <div
                className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-sm font-medium fade-in ${result.ok ? 'badge-green' : 'badge-red'}`}
                style={{ display: 'flex' }}>
                {result.ok
                  ? <CheckCircle className="w-4 h-4" />
                  : <XCircle className="w-4 h-4" />
                }
                {result.msg}
              </div>
            )}

            <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--ink-6)', border: '1px solid var(--border)' }}>
              <p className="label-xs mb-1.5">Test tokens</p>
              {['QR-EVT1-USR1-A7K2', 'QR-EVT1-USR2-C3P8'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQrInput(t)}
                  className="block mono text-xs py-0.5 w-full text-left transition-colors"
                  style={{ color: 'var(--ink-3)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── Check-in log ── */}
          <div className="lg:col-span-3 card bg-white overflow-hidden slide-up stagger-1">
            <div className="grid grid-cols-3 border-b" style={{ borderColor: 'var(--border)' }}>
              {[
                { l: 'Checked In', v: checkins.length },
                { l: 'Registered', v: ev?.registration_count ?? 0 },
                { l: 'Rate', v: `${rate}%` },
              ].map(({ l, v }) => (
                <div key={l} className="px-4 py-3 border-r last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="mono text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>{v}</div>
                  <div className="label-xs mt-0.5">{l}</div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--ink-6)' }}>
              <span className="text-sm font-semibold">Recent Check-Ins</span>
            </div>

            {loadingCi ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : checkins.length === 0 ? (
              <div className="py-16 text-center">
                <QrCode className="w-7 h-7 mx-auto mb-2" style={{ color: 'var(--ink-5)' }} />
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>No check-ins yet</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {[...checkins].reverse().map(ci => (
                  <div
                    key={ci.id}
                    className="px-5 py-3 flex items-center gap-3 border-b last:border-0 transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ink-6)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} />
                    <span className="mono text-xs flex-1 truncate" style={{ color: 'var(--ink-2)' }}>
                      {ci.registration_id}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
                      {formatDateTime(ci.checked_in_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}