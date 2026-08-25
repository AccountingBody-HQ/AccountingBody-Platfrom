'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomepageJobSearch() {
  const [role, setRole]         = useState('')
  const [location, setLocation] = useState('')
  const router = useRouter()

  function handleSearch() {
    const params = new URLSearchParams()
    if (role.trim())     params.set('role', role.trim())
    if (location.trim()) params.set('location', location.trim())
    router.push('/jobs/listings' + (params.toString() ? '?' + params.toString() : ''))
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:overflow-hidden sm:rounded-2xl p-2 sm:p-0">
          <div className="flex items-center gap-3 flex-1 px-5 py-4">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Job title or keyword"
              className="flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
            />
          </div>
          <div className="h-px sm:h-auto sm:w-px bg-slate-200 shrink-0" />
          <div className="flex items-center gap-3 flex-1 px-5 py-4">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="City or country"
              className="flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
            />
          </div>
          <div className="p-2 shrink-0">
            <button
              onClick={handleSearch}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl sm:rounded-none sm:rounded-r-2xl text-sm font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: '#D4A017', color: '#0C1A3D' }}
            >
              Find jobs
            </button>
          </div>
        </div>
      </div>
      <p className="text-white/40 text-xs mt-3">
        250,000+ live accounting &amp; finance roles &mdash;{' '}
        <a href="/jobs/listings" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">browse all</a>
      </p>
    </div>
  )
}
