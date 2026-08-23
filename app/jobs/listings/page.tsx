'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

type SortOption = 'relevance' | 'date' | 'salary'
type ContractFilter = 'all' | 'permanent' | 'contract' | 'temporary' | 'parttime'

const DEFAULT_ROLE = ''
const DEFAULT_LOCATION = ''
const DEFAULT_SORT: SortOption = 'date'
const DEFAULT_CONTRACT: ContractFilter = 'all'
const PAGE_SIZE = 12
const DEBOUNCE_MS = 300

const ROLE_CHIPS = [
  'All', 'Accountant', 'Auditor', 'Finance Manager', 'Payroll', 'Tax', 'CFO', 'Bookkeeper',
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date', label: 'Newest' },
  { value: 'relevance', label: 'Relevant' },
  { value: 'salary', label: 'Salary' },
]

const CONTRACT_OPTIONS: { value: ContractFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'parttime', label: 'Part-time' },
]

function contractQueryParams(filter: ContractFilter): Record<string, string> {
  switch (filter) {
    case 'permanent': return { contract_type: 'p' }
    case 'contract': return { contract_type: 'c' }
    case 'temporary': return { contract_type: 't' }
    case 'parttime': return { work_hours: 'p' }
    default: return {}
  }
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const datePart = dateStr.split(' ')[0]
  const d = new Date(datePart)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatResultsSummary(count: number, role: string, location: string): string {
  const countStr = count.toLocaleString()
  const noun = role ? `${role} job${count === 1 ? '' : 's'}` : `accounting & finance job${count === 1 ? '' : 's'}`
  const locationSuffix = location ? ` in ${location}` : ''
  return `${countStr} ${noun}${locationSuffix}`
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

function PillButton({
  label,
  active,
  variant,
  onClick,
}: {
  label: string
  active: boolean
  variant: 'chip' | 'filter'
  onClick: () => void
}) {
  const activeClasses = variant === 'chip'
    ? 'bg-gold-500 border-gold-500 text-white'
    : 'bg-navy-950 border-navy-950 text-white'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap transition-colors',
        active ? activeClasses : 'bg-white border-navy-200 text-navy-700 hover:border-navy-400',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Spinner({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin text-gold-500`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function JobCard({ job, fallbackLocation }: { job: CareerjetJob; fallbackLocation: string }) {
  const location = job.locations || fallbackLocation

  return (
    <article className="group card-base bg-white flex flex-col p-5">
      <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors mb-1">
        {job.title}
      </h3>
      <p className="text-sm font-semibold text-navy-700 mb-3">
        {job.company || 'Company not specified'}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-xs text-slate-500">
        {location && (
          <span className="flex items-center gap-1">
            <LocationIcon />
            {location}
          </span>
        )}
        {job.date && (
          <span className="flex items-center gap-1">
            <CalendarIcon />
            {formatDate(job.date)}
          </span>
        )}
      </div>

      {job.salary && (
        <div className="mb-4">
          <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-300 px-2.5 py-1 text-xs font-bold whitespace-nowrap">
            {job.salary}
          </span>
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
  const [activeSort, setActiveSort] = useState<SortOption>(DEFAULT_SORT)
  const [activeContract, setActiveContract] = useState<ContractFilter>(DEFAULT_CONTRACT)
  const [activeChip, setActiveChip] = useState<string | null>('All')
  const [page, setPage] = useState(1)

  const [jobs, setJobs] = useState<CareerjetJob[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [hits, setHits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const debouncedRoleInput = useDebouncedValue(roleInput, DEBOUNCE_MS)
  const debouncedLocationInput = useDebouncedValue(locationInput, DEBOUNCE_MS)

  useEffect(() => {
    setActiveRole(debouncedRoleInput.trim())
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedRoleInput])

  useEffect(() => {
    setActiveLocation(debouncedLocationInput.trim())
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLocationInput])

  const fetchJobs = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        role: activeRole,
        location: activeLocation,
        page: String(page),
        pagesize: String(PAGE_SIZE),
        sort: activeSort,
        ...contractQueryParams(activeContract),
      })
      const res = await fetch(`/api/careerjet?${params.toString()}`, { signal: controller.signal })
      const data: CareerjetResponse = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Could not load jobs right now. Please try again.')
        setJobs([])
        return
      }

      setJobs(Array.isArray(data.jobs) ? data.jobs : [])
      setTotalPages(typeof data.pages === 'number' && data.pages > 0 ? data.pages : 1)
      setHits(typeof data.hits === 'number' ? data.hits : null)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Could not load jobs right now. Please try again.')
      setJobs([])
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }, [activeRole, activeLocation, page, activeSort, activeContract])

  useEffect(() => {
    fetchJobs()
    return () => abortRef.current?.abort()
  }, [fetchJobs])

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setActiveRole(roleInput.trim())
    setActiveLocation(locationInput.trim())
    scrollToResults()
  }

  function handleRoleInputChange(value: string) {
    setRoleInput(value)
    setActiveChip(null)
  }

  function handleChipClick(chip: string) {
    const value = chip === 'All' ? '' : chip
    setRoleInput(value)
    setActiveRole(value)
    setActiveChip(chip)
    setPage(1)
    scrollToResults()
  }

  function handleSortChange(value: SortOption) {
    setActiveSort(value)
    setPage(1)
  }

  function handleContractChange(value: ContractFilter) {
    setActiveContract(value)
    setPage(1)
  }

  function handleReset() {
    setRoleInput(DEFAULT_ROLE)
    setLocationInput(DEFAULT_LOCATION)
    setActiveRole(DEFAULT_ROLE)
    setActiveLocation(DEFAULT_LOCATION)
    setActiveSort(DEFAULT_SORT)
    setActiveContract(DEFAULT_CONTRACT)
    setActiveChip('All')
    setPage(1)
  }

  const count = hits ?? jobs.length
  const isFirstLoad = loading && jobs.length === 0

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
            <div className="flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-stretch sm:bg-white sm:rounded-xl sm:shadow-2xl sm:shadow-black/20 sm:overflow-hidden sm:border-2 sm:border-transparent sm:focus-within:border-gold-500 transition-all duration-200">
              <div className="flex items-center flex-1 bg-white rounded-lg sm:rounded-none px-4 py-2.5 sm:py-0 border border-slate-200 sm:border-0 sm:border-b-0 sm:border-r sm:border-slate-200">
                <SearchIcon />
                <input
                  type="text"
                  value={roleInput}
                  onChange={e => handleRoleInputChange(e.target.value)}
                  placeholder="e.g. Auditor, Payroll Manager, CFO..."
                  className="flex-1 py-1 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center flex-1 bg-white rounded-lg sm:rounded-none px-4 py-2.5 sm:py-0 border border-slate-200 sm:border-0">
                <LocationIcon />
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  placeholder="Leave blank for local jobs, or enter a city/country"
                  className="flex-1 py-1 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                  autoComplete="off"
                />
              </div>
              <div className="sm:p-2 sm:shrink-0">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full h-11 px-6 bg-gold-500 hover:bg-gold-400 active:bg-gold-600 text-navy-950 font-bold rounded-lg transition-all text-sm"
                >
                  Search Jobs
                </button>
              </div>
            </div>
            <p className="text-white/50 text-xs mt-3">
              Showing jobs near you — enter a location to search elsewhere
            </p>
          </form>
        </div>
      </section>

      {/* FILTERS TOOLBAR */}
      <div className="bg-white border-b border-slate-200">
        <div className="container-site">
          {/* Desktop: single row — role chips left, dropdowns right */}
          <div className="hidden md:flex md:items-center md:justify-between md:gap-6 py-3">
            <div
              className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {ROLE_CHIPS.map(chip => (
                <PillButton
                  key={chip}
                  label={chip}
                  variant="chip"
                  active={activeChip === chip}
                  onClick={() => handleChipClick(chip)}
                />
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <label className="flex items-center">
                <span className="text-sm text-gray-500 mr-1">Contract:</span>
                <select
                  value={activeContract}
                  onChange={e => handleContractChange(e.target.value as ContractFilter)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-navy-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {CONTRACT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center">
                <span className="text-sm text-gray-500 mr-1">Sort:</span>
                <select
                  value={activeSort}
                  onChange={e => handleSortChange(e.target.value as SortOption)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-navy-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Mobile: chips wrap, dropdowns below in a 50/50 row */}
          <div className="flex flex-col md:hidden">
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {ROLE_CHIPS.map(chip => (
                <PillButton
                  key={chip}
                  label={chip}
                  variant="chip"
                  active={activeChip === chip}
                  onClick={() => handleChipClick(chip)}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 px-4 pb-3">
              <label className="flex items-center w-1/2 min-w-0">
                <span className="text-sm text-gray-500 mr-1 shrink-0">Contract</span>
                <select
                  value={activeContract}
                  onChange={e => handleContractChange(e.target.value as ContractFilter)}
                  className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-navy-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {CONTRACT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center w-1/2 min-w-0">
                <span className="text-sm text-gray-500 mr-1 shrink-0">Sort</span>
                <select
                  value={activeSort}
                  onChange={e => handleSortChange(e.target.value as SortOption)}
                  className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-navy-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-500"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <section className="section bg-slate-50">
        <div className="container-site" ref={resultsRef} style={{ scrollMarginTop: '5rem' }}>
          <div className="mb-8">
            <p className="text-sm text-slate-500">
              {isFirstLoad
                ? 'Searching…'
                : error
                  ? ' '
                  : formatResultsSummary(count, activeRole, activeLocation)}
            </p>
          </div>

          {error && (
            <div className="text-center py-16 border border-slate-200 rounded-xl bg-white">
              <p className="text-navy-950 font-semibold mb-1">Something went wrong</p>
              <p className="text-sm text-slate-500 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => fetchJobs()}
                className="h-10 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!error && isFirstLoad && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => <JobCardSkeleton key={i} />)}
            </div>
          )}

          {!error && !isFirstLoad && jobs.length === 0 && (
            <div className="text-center py-16 border border-slate-200 rounded-xl bg-white">
              <p className="text-navy-950 font-semibold mb-1">No jobs found</p>
              <p className="text-sm text-slate-500 mb-4">Try broadening your search or clearing filters.</p>
              <button
                type="button"
                onClick={handleReset}
                className="h-10 px-6 rounded-lg border border-navy-950 text-navy-950 text-sm font-semibold hover:bg-navy-950 hover:text-white transition-colors"
              >
                Reset filters
              </button>
            </div>
          )}

          {!error && jobs.length > 0 && (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 flex items-start justify-center pt-12 z-10">
                  <Spinner />
                </div>
              )}
              <div className={`transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {jobs.map((job, i) => (
                    <JobCard key={`${job.url}-${i}`} job={job} fallbackLocation={activeLocation} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-10">
                    <button
                      type="button"
                      onClick={() => { setPage(p => Math.max(1, p - 1)); scrollToResults() }}
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
                      onClick={() => { setPage(p => Math.min(totalPages, p + 1)); scrollToResults() }}
                      disabled={page >= totalPages}
                      className="h-10 px-5 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
