'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'

interface CareerjetJob {
  title: string
  company?: string
  locations?: string
  salary?: string
  date?: string
  url: string
  site?: string
}

interface CareerjetResponse {
  jobs?: CareerjetJob[]
  pages?: number
  hits?: number
  error?: string
}

const DEFAULT_ROLE = ''
const DEFAULT_LOCATION = ''
const PAGE_SIZE = 12

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const datePart = dateStr.split(' ')[0]
  const d = new Date(datePart)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function JobCard({ job, fallbackLocation }: { job: CareerjetJob; fallbackLocation: string }) {
  return (
    <article className="group card-base bg-white flex flex-col p-5">
      <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors mb-1">
        {job.title}
      </h3>
      <p className="text-sm font-semibold text-navy-700 mb-3">
        {job.company || 'Company not specified'}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <LocationIcon />
          {job.locations || fallbackLocation}
        </span>
        {job.date && (
          <span className="flex items-center gap-1">
            <CalendarIcon />
            {formatDate(job.date)}
          </span>
        )}
      </div>

      {job.salary && (
        <div className="mb-4">
          <Badge variant="count">{job.salary}</Badge>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100">
        <a
          href={job.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-navy-950 text-white text-sm font-semibold transition-colors hover:bg-navy-900"
        >
          View Job
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </div>
    </article>
  )
}

function JobCardSkeleton() {
  return (
    <div className="card-base bg-white p-5 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="h-3 bg-slate-100 rounded w-2/3 mb-4" />
      <div className="h-10 bg-slate-100 rounded-lg" />
    </div>
  )
}

export default function JobListingsPage() {
  const [roleInput, setRoleInput] = useState(DEFAULT_ROLE)
  const [locationInput, setLocationInput] = useState(DEFAULT_LOCATION)
  const [activeRole, setActiveRole] = useState(DEFAULT_ROLE)
  const [activeLocation, setActiveLocation] = useState(DEFAULT_LOCATION)
  const [page, setPage] = useState(1)

  const [jobs, setJobs] = useState<CareerjetJob[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [hits, setHits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchJobs() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          role: activeRole,
          location: activeLocation,
          page: String(page),
          pagesize: String(PAGE_SIZE),
        })
        const res = await fetch(`/api/careerjet?${params.toString()}`)
        const data: CareerjetResponse = await res.json()

        if (cancelled) return

        if (!res.ok || data.error) {
          setError(data.error || 'Could not load jobs right now. Please try again.')
          setJobs([])
          return
        }

        setJobs(Array.isArray(data.jobs) ? data.jobs : [])
        setTotalPages(typeof data.pages === 'number' && data.pages > 0 ? data.pages : 1)
        setHits(typeof data.hits === 'number' ? data.hits : null)
      } catch {
        if (!cancelled) {
          setError('Could not load jobs right now. Please try again.')
          setJobs([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchJobs()
    return () => { cancelled = true }
  }, [activeRole, activeLocation, page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setActiveRole(roleInput.trim())
    setActiveLocation(locationInput.trim())
  }

  return (
    <main className="min-h-screen bg-white">

      {/* HERO + SEARCH */}
      <section className="relative overflow-hidden py-16 md:py-20 bg-navy-950">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.3) 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Job Search</span>
          <h1 className="font-display text-white text-3xl md:text-4xl lg:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
            Accounting &amp; finance jobs
          </h1>
          <p className="text-white/60 text-lg leading-relaxed mb-8 max-w-2xl">
            Search live accounting and finance vacancies from across the web.
          </p>

          <form onSubmit={handleSearch} className="w-full max-w-3xl">
            <div className="flex flex-col sm:flex-row items-stretch bg-white rounded-xl shadow-2xl shadow-black/20 overflow-hidden border-2 border-transparent focus-within:border-gold-500 transition-all duration-200">
              <div className="flex items-center flex-1 px-4 py-2 sm:py-0 border-b sm:border-b-0 sm:border-r border-slate-200">
                <SearchIcon />
                <input
                  type="text"
                  value={roleInput}
                  onChange={e => setRoleInput(e.target.value)}
                  placeholder="e.g. Auditor, Payroll Manager, CFO..."
                  className="flex-1 py-2.5 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center flex-1 px-4 py-2 sm:py-0">
                <LocationIcon />
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  placeholder="Worldwide — or enter a city/country"
                  className="flex-1 py-2.5 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                  autoComplete="off"
                />
              </div>
              <div className="p-2 shrink-0">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full h-11 px-6 bg-gold-500 hover:bg-gold-400 active:bg-gold-600 text-navy-950 font-bold rounded-lg transition-all text-sm"
                >
                  Search Jobs
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* RESULTS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8">
            <p className="text-sm text-slate-500">
              {loading
                ? 'Searching…'
                : error
                  ? ' '
                  : `${hits ?? jobs.length} job${hits === 1 ? '' : 's'}${activeRole ? ` for "${activeRole}"` : ''}${activeLocation ? ` in ${activeLocation}` : ''}`}
            </p>
          </div>

          {error && (
            <div className="text-center py-16 border border-slate-200 rounded-xl bg-white">
              <p className="text-navy-950 font-semibold mb-1">Something went wrong</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          )}

          {!error && loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
            </div>
          )}

          {!error && !loading && jobs.length === 0 && (
            <div className="text-center py-16 border border-slate-200 rounded-xl bg-white">
              <p className="text-navy-950 font-semibold mb-1">No jobs found</p>
              <p className="text-sm text-slate-500">Try different keywords or a broader location.</p>
            </div>
          )}

          {!error && !loading && jobs.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {jobs.map((job, i) => (
                  <JobCard key={`${job.url}-${i}`} job={job} fallbackLocation={activeLocation} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-10 px-5 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500 tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-10 px-5 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
