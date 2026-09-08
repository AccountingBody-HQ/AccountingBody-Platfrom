'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const POPULAR = [
  'Management Accountant', 'Tax Manager', 'Financial Controller',
  'Audit Senior', 'FP&A Analyst', 'CFO',
]

export default function JobSearchHero() {
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const router = useRouter()

  function navigate(r: string, l: string) {
    const p = new URLSearchParams()
    if (r.trim()) p.set('search', r.trim())
    if (l.trim()) p.set('location', l.trim())
    router.push('/jobs/listings' + (p.size > 0 ? '?' + p.toString() : ''))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(role, location)
  }

  const inputStyle: React.CSSProperties = {
    color: '#0C1A3D',
    fontSize: '16px',
    fontWeight: 500,
    caretColor: '#D4A017',
  }

  const clearBtn = (fn: () => void, label: string) => (
    <button
      type="button"
      onClick={fn}
      aria-label={label}
      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
      style={{ background: '#f1f0ec', color: '#94a3b8' }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )

  return (
    <div className="w-full">

      {/* ── Desktop: single unified row ── */}
      <form
        onSubmit={handleSubmit}
        aria-label="Job search"
        className="hidden md:flex flex-row rounded-2xl overflow-hidden w-full"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)', height: '72px' }}
      >
        {/* Role */}
        <div className="flex-1 flex items-center gap-3 bg-white px-6"
          style={{ borderRight: '1px solid #e4e2db' }}>
          <svg className="w-5 h-5 shrink-0" style={{ color: '#94a3b8' }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="8.5" cy="8.5" r="6" /><line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
          </svg>
          <input type="text" value={role} onChange={e => setRole(e.target.value)}
            placeholder="Job title, skills, keywords" autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none" style={inputStyle} />
          {role && clearBtn(() => setRole(''), 'Clear role')}
        </div>
        {/* Location */}
        <div className="flex-1 flex items-center gap-3 bg-white px-6"
          style={{ borderRight: '1px solid #e4e2db' }}>
          <svg className="w-5 h-5 shrink-0" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="1.75" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeWidth="1.75" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Location or remote" autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none" style={inputStyle} />
          {location && clearBtn(() => setLocation(''), 'Clear location')}
        </div>
        {/* Button */}
        <button type="submit"
          className="flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.98] shrink-0 px-10"
          style={{ background: 'linear-gradient(135deg, #D4A017 0%, #c8950e 100%)', color: '#0C1A3D', fontSize: '15px', letterSpacing: '0.02em', minWidth: '180px' }}>
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="6" /><line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
          </svg>
          Search Jobs
        </button>
      </form>

      {/* ── Mobile: unified card with stacked inputs + full-width button ── */}
      <form
        onSubmit={handleSubmit}
        aria-label="Job search"
        className="md:hidden flex flex-col rounded-2xl overflow-hidden w-full"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)' }}
      >
        {/* Role */}
        <div className="flex items-center gap-3 bg-white px-5"
          style={{ height: '60px', borderBottom: '1px solid #e4e2db' }}>
          <svg className="w-5 h-5 shrink-0" style={{ color: '#94a3b8' }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="8.5" cy="8.5" r="6" /><line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
          </svg>
          <input type="text" value={role} onChange={e => setRole(e.target.value)}
            placeholder="Job title, skills, keywords" autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none" style={{ ...inputStyle, fontSize: '15px' }} />
          {role && clearBtn(() => setRole(''), 'Clear role')}
        </div>
        {/* Location */}
        <div className="flex items-center gap-3 bg-white px-5"
          style={{ height: '60px', borderBottom: '1px solid #e4e2db' }}>
          <svg className="w-5 h-5 shrink-0" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="1.75" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeWidth="1.75" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Location or remote" autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none" style={{ ...inputStyle, fontSize: '15px' }} />
          {location && clearBtn(() => setLocation(''), 'Clear location')}
        </div>
        {/* Button */}
        <button type="submit"
          className="flex items-center justify-center gap-2.5 font-bold transition-all active:scale-[0.99]"
          style={{ height: '60px', background: 'linear-gradient(135deg, #D4A017 0%, #c8950e 100%)', color: '#0C1A3D', fontSize: '16px', letterSpacing: '0.02em' }}>
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="6" /><line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
          </svg>
          Search Jobs
        </button>
      </form>

      {/* ── Popular searches ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-5">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Popular:
        </span>
        {POPULAR.map(term => (
          <button
            key={term}
            type="button"
            onClick={() => navigate(term, '')}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:bg-white/15"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            {term}
          </button>
        ))}
      </div>

    </div>
  )
}
