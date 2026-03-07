// Path: app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowRight, Mail, Lock } from 'lucide-react'
import { authService } from '@/services/auth.service'

const QUICK = [
  { label: '🎯 Organizer',   email: 'organizer@eventos.dev',  pass: 'org123' },
  { label: '🎟 Participant', email: 'participant@eventos.dev', pass: 'part123' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await authService.login({ email, password })
    if (!res.success || !res.data) {
      setError(res.error ?? 'Invalid credentials'); setLoading(false); return
    }
    authService.saveSession(res.data)
    router.push(authService.getDashboardRoute(res.data.user.role))
  }

  return (
    <div className="w-full max-w-[420px] slide-up">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-1 mb-4">
          <span className="font-display text-2xl font-bold tracking-tight">eventos</span>
          <span className="font-display text-2xl font-bold" style={{ color: 'var(--brand)' }}>.</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Welcome back</h1>
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Sign in to your account</p>
      </div>

      <div className="bg-white rounded-2xl border p-8" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-md)' }}>
        {/* Quick demo */}
        <div className="mb-6">
          <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--ink-3)' }}>Quick demo login</p>
          <div className="flex gap-2">
            {QUICK.map(({ label, email: e, pass }) => (
              <button key={label} type="button"
                onClick={() => { setEmail(e); setPassword(pass); setError('') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-medium transition-all border"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', background: 'var(--ink-6)' }}
                onMouseEnter={ev => { ev.currentTarget.style.borderColor = 'var(--brand-soft)'; ev.currentTarget.style.background = 'var(--brand-pale)'; ev.currentTarget.style.color = 'var(--brand)' }}
                onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'var(--border)'; ev.currentTarget.style.background = 'var(--ink-6)'; ev.currentTarget.style.color = 'var(--ink-2)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--ink-4)' }}>or enter manually</span>
          <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ink-4)' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ink-4)' }} />
              <input type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="input pl-10 pr-10" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <div className="badge badge-red px-3.5 py-2.5 text-xs rounded-lg w-full fade-in" style={{ display: 'flex' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 text-sm" style={{ borderRadius: 12 }}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : <>Sign in <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </form>
      </div>
      <p className="text-center text-sm mt-5" style={{ color: 'var(--ink-3)' }}>
        No account?{' '}
        <Link href="/register" className="font-semibold" style={{ color: 'var(--brand)' }}>Create one</Link>
      </p>
    </div>
  )
}