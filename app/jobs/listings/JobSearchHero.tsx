'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const POPULAR_SEARCHES = [
  'Management Accountant',
  'Tax Manager',
  'Financial Controller',
  'Audit Senior',
  'FP&A Analyst',
  'CFO',
]

export default function JobSearchHero() {
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const router = useRouter()

  function navigate(r: string, l: string) {
    const params = new URLSearchParams()
    if (r.trim()) params.set('search', r.trim())
    if (l.trim()) params.set('location', l.trim())
    router.push(`/jobs/listings${params.size > 0 ? '?' + params.toString() : ''}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(role, location)
  }

  return (
    <div className="w-full max-w-5xl">
      {/* ── Unified search bar ── */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row rounded-2xl overflow-hidden md:overflow-visible gap-0 md:gap-0"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)' }}
      >
        {/* Role input */}
        <div
          className="flex items-center gap-3 bg-white px-5 md:rounded-l-2xl md:rounded-r-none rounded-t-2xl"
          style={{
            flex: '1 1 0',
            minHeight: '64px',
            borderRight: '1px solid #e4e2db',
          }}
        >
          {/* Search icon */}
          <svg className="w-5 h-5 shrink-0" style={{ color: '#94a3b8' }} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="8.5" cy="8.5" r="6" />
            <line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="Job title, skills, keywords"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ color: '#0C1A3D', fontSize: '15px', fontWeight: 500, caretColor: '#D4A017' }}
          />
          {role && (
            <button
              type="button"
              onClick={() => setRole('')}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: '#f1f0ec', color: '#94a3b8' }}
              aria-label="Clear role"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Divider — visible only on mobile between the two text inputs */}
        <div className="md:hidden h-px bg-slate-200" />

        {/* Location input */}
        <div
          className="flex items-center gap-3 bg-white px-5"
          style={{
            flex: '1 1 0',
            minHeight: '64px',
            borderRight: '1px solid #e4e2db',
          }}
        >
          {/* Location icon */}
          <svg className="w-5 h-5 shrink-0" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="1.75" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeWidth="1.75" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Location or remote"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{ color: '#0C1A3D', fontSize: '15px', fontWeight: 500, caretColor: '#D4A017' }}
          />
          {location && (
            <button
              type="button"
              onClick={() => setLocation('')}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: '#f1f0ec', color: '#94a3b8' }}
              aria-label="Clear location"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Search button */}
        <button
          type="submit"
          className="flex items-center justify-center gap-2.5 font-bold transition-all active:scale-[0.98] md:rounded-r-2xl rounded-b-2xl"
          style={{
            minHeight: '64px',
            padding: '0 2rem',
            background: 'linear-gradient(135deg, #D4A017 0%, #c8950e 100%)',
            color: '#0C1A3D',
            fontSize: '15px',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8.5" cy="8.5" r="6" />
            <line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
          </svg>
          Search Jobs
        </button>
      </form>

      {/* ── Popular searches ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-5">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}
        >
          Popular:
        </span>
        {POPULAR_SEARCHES.map(term => (
          <button
            key={term}
            type="button"
            onClick={() => navigate(term, '')}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={{
              background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            onMouseEnter={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(255,255,255,0.14)'
              t.style.color = 'rgba(255,255,255,0.9)'
              t.style.borderColor = 'rgba(255,255,255,0.25)'
            }}
            onMouseLeave={e => {
              const t = e.currentTarget
              t.style.background = 'rgba(255,255,255,0.07)'
              t.style.color = 'rgba(255,255,255,0.6)'
              t.style.borderColor = 'rgba(255,255,255,0.12)'
            }}
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  )
}
