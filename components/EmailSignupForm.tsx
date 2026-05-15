'use client'
import { useState } from 'react'

export default function EmailSignupForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
        <div className="flex items-center gap-3 bg-white/10 rounded-lg px-5 py-4 border border-white/20 w-full">
          <svg className="w-5 h-5 text-gold-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-white text-sm font-medium">You are subscribed — welcome!</p>
        </div>
        <button onClick={() => setStatus('idle')} className="text-xs text-white/50 hover:text-white/80 transition-colors">
          Subscribe another email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="w-full h-14 px-4 rounded-lg text-base border-2 border-white/40 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition-all" style={{ backgroundColor: "rgba(255,255,255,0.08)", fontSize: "16px", WebkitAppearance: "none", appearance: "none" }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full h-14 px-6 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold disabled:opacity-60"
      >
        {status === 'loading' ? 'Subscribing...' : 'Subscribe free'}
      </button>
      {status === 'error' && (
        <p className="text-red-400 text-xs text-center">Something went wrong. Please try again.</p>
      )}
    </form>
  )
}
