'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function SearchIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5.5" />
      <line x1="11" y1="11" x2="15" y2="15" strokeLinecap="round" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

/**
 * Hero search form — lives in the page-level hero section, not sticky.
 * Submitting pushes search params into the URL which JobListingsClient reads.
 * This avoids z-index conflicts with the main nav entirely.
 */
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 md:gap-3 max-w-3xl">
      {/* Role input */}
      <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-14 md:h-16"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
        <span style={{ color: '#94a3b8' }}><SearchIcon /></span>
        <input
          type="text"
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="Job title, skills, keywords"
          className="flex-1 min-w-0 bg-transparent outline-none font-medium"
          style={{ color: '#0C1A3D', fontSize: '15px' }}
          autoComplete="off"
        />
      </div>
      {/* Location input */}
      <div className="flex-1 flex items-center gap-3 bg-white rounded-xl px-4 h-14 md:h-16"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
        <span style={{ color: '#94a3b8' }}><LocationIcon /></span>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Location or remote"
          className="flex-1 min-w-0 bg-transparent outline-none font-medium"
          style={{ color: '#0C1A3D', fontSize: '15px' }}
          autoComplete="off"
        />
      </div>
      {/* Search button */}
      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-xl font-bold transition-all active:scale-95 h-14 md:h-16 px-8 shrink-0 w-full sm:w-auto"
        style={{ background: '#D4A017', color: '#0C1A3D', fontSize: '15px', boxShadow: '0 4px 16px rgba(212,160,23,0.3)' }}>
        <SearchIcon />
        Search
      </button>
    </form>
  )
}
