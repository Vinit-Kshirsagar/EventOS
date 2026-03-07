import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #FFF3EB 0%, #ffffff 40%, #FFF8F2 100%)' }}>
      {/* Decorative orbs */}
      <div className="glow-orb" style={{ width: 500, height: 500, top: -100, left: -100, opacity: 0.08 }} />
      <div className="glow-orb" style={{ width: 300, height: 300, bottom: -50, right: -50, opacity: 0.06, background: 'var(--brand-accent)' }} />
      <nav className="relative z-10 px-6 py-4">
        <Link href="/" className="flex items-center gap-1 w-fit">
          <span className="font-display text-xl font-bold tracking-tight">eventos</span>
          <span className="font-display text-xl font-bold" style={{ color: 'var(--brand)' }}>.</span>
        </Link>
      </nav>
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}