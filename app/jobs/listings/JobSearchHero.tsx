'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function SearchIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="8.5" cy="8.5" r="6" />
      <line x1="13" y1="13" x2="18" y2="18" strokeLinecap="round" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="1.75" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeWidth="1.75" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export default function JobSearchHero() {
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (role.trim()) params.set('search', role.trim())
    if (location.trim()) params.set('location', location.trim())
    router.push(`/jobs/listings${params.size > 0 ? '?' + params.toString() : ''}`)
  }

  function quickSearch(term: string) {
    const params = new URLSearchParams()
    params.set('search', term)
    router.push(`/jobs/listings?${params.toString()}`)
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
        <div className="flex flex-col md:flex-row gap-3 w-full">
          <div
            className="flex-1 flex items-center gap-3 bg-white rounded-2xl px-5"
            style={{ height: '64px', boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)', border: '1.5px solid rgba(255,255,255,0.15)' }}
          >
            <span style={{ color: '#94a3b8', flexShrink: 0 }}><SearchIcon /></span>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="Job title, skills, keywords"
              className="flex-1 min-w-0 bg-transparent outline-none"
              style={{ color: '#0C1A3D', fontSize: '16px', fontWeight: 500 }}
              autoComplete="off"
            />
            {role && (
              <button type="button" onClick={() => setRole('')}
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: '#f1f5f9', color: '#94a3b8' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div
            className="flex-1 flex items-center gap-3 bg-white rounded-2xl px-5"
            style={{ height: '64px', boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)', border: '1.5px solid rgba(255,255,255,0.15)' }}
          >
            <span style={{ color: '#94a3b8', flexShrink: 0 }}><LocationIcon /></span>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location or remote"
              className="flex-1 min-w-0 bg-transparent outline-none"
              style={{ color: '#0C1A3D', fontSize: '16px', fontWeight: 500 }}
              autoComplete="off"
            />
            {location && (
              <button type="button" onClick={() => setLocation('')}
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: '#f1f5f9', color: '#94a3b8' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2.5 rounded-2xl font-bold transition-all active:scale-[0.98]"
          style={{ height: '60px', background: 'linear-gradient(135deg, #D4A017 0%, #e8b830 100%)', color: '#0C1A3D', fontSize: '16px', letterSpacing: '0.01em', boxShadow: '0 4px 20px rgba(212,160,23,0.4)' }}
        >
          <SearchIcon />
          Search Jobs
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-5">
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Popular:</span>
        {['Management Accountant', 'Tax Manager', 'Financial Controller', 'Audit Senior', 'FP&A Analyst'].map(term => (
          <button
            key={term}
            type="button"
            onClick={() => quickSearch(term)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  )
}
