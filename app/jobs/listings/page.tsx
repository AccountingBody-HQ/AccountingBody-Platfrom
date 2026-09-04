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

interface DirectJob {
  id: string
  slug: string
  title: string
  company_name: string
  location_text: string
  salary_text: string | null
  employment_type: string | null
  created_at: string
  published_at: string | null
  apply_method: 'platform' | 'external' | 'email'
  application_url: string | null
  application_email: string | null
}

interface DirectJobsResponse {
  jobs?: DirectJob[]
}

type SortOption = 'relevance' | 'date' | 'salary'
type ContractFilter = 'all' | 'permanent' | 'contract' | 'temporary' | 'parttime'

const DEFAULT_ROLE = ''
const DEFAULT_LOCATION = ''
const DEFAULT_SORT: SortOption = 'date'
const DEFAULT_CONTRACT: ContractFilter = 'all'
const PAGE_SIZE = 12
const DEBOUNCE_MS = 300

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date', label: 'Newest' },
  { value: 'relevance', label: 'Relevance' },
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

// jobs.employment_type uses a different vocabulary ('part_time' vs
// Careerjet's work_hours=p) — mapped separately for the direct-jobs API.
function directEmploymentType(filter: ContractFilter): string | undefined {
  switch (filter) {
    case 'permanent': return 'permanent'
    case 'contract': return 'contract'
    case 'temporary': return 'temporary'
    case 'parttime': return 'part_time'
    default: return undefined
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

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function HeroSearchIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="#aaa" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5.5" />
      <line x1="11" y1="11" x2="15" y2="15" strokeLinecap="round" />
    </svg>
  )
}

function HeroLocationIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="#aaa" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 15s5-4.5 5-8.5a5 5 0 10-10 0C3 10.5 8 15 8 15z" />
      <circle cx="8" cy="6.5" r="1.8" />
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
  variant: 'contract' | 'sort'
  onClick: () => void
}) {
  const activeClasses = variant === 'contract' ? 'bg-[#0B1F3A] text-white' : 'bg-[#B8862E] text-white'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-[20px] py-[8px] text-[12px] text-center transition-colors cursor-pointer',
        active ? activeClasses : 'bg-white text-[#444] border border-[#E0E0E0] hover:bg-gray-50',
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
    <a
      href={job.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="group card-base bg-white flex flex-col p-5"
    >
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
        <span className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-navy-950 text-white text-sm font-semibold transition-colors group-hover:bg-navy-900">
          View Job
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </span>
      </div>
    </a>
  )
}

function trackAndOpen(job: DirectJob) {
  // Fire-and-forget click tracking — never blocks navigation.
  fetch(`/api/jobs/click/${job.id}`, { method: 'POST' }).catch(() => {})

  if (job.apply_method === 'external' && job.application_url) {
    window.open(job.application_url, '_blank', 'noopener,noreferrer')
  } else if (job.apply_method === 'email' && job.application_email) {
    window.location.href = `mailto:${job.application_email}?subject=${encodeURIComponent('Application: ' + job.title)}`
  } else {
    window.open(`/jobs/apply/${job.id}`, '_blank', 'noopener,noreferrer')
  }
}

function DirectJobCard({ job }: { job: DirectJob }) {
  return (
    <div className="group card-base bg-white flex flex-col p-5 relative">
      <span className="absolute top-4 right-4 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
        style={{ background: 'rgba(45,212,191,0.12)', color: '#0d9488', border: '1px solid rgba(45,212,191,0.3)' }}>
        Hiring Direct
      </span>
      <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors mb-1 pr-24">
        {job.title}
      </h3>
      <p className="text-sm font-semibold text-navy-700 mb-3">{job.company_name}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <LocationIcon />
          {job.location_text}
        </span>
        {job.employment_type && (
          <span className="capitalize">{job.employment_type.replace('_', ' ')}</span>
        )}
      </div>

      {job.salary_text && (
        <div className="mb-4">
          <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-300 px-2.5 py-1 text-xs font-bold whitespace-nowrap">
            {job.salary_text}
          </span>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => trackAndOpen(job)}
          className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: '#C9982A', color: '#0C1A3D' }}>
          Apply Now
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>
    </div>
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
  const [page, setPage] = useState(1)

  const [jobs, setJobs] = useState<CareerjetJob[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [hits, setHits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [directJobs, setDirectJobs] = useState<DirectJob[]>([])

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

    // Direct employer jobs are only shown alongside page 1 — they're a
    // small, fixed "top of feed" set, not a paginated source in their own
    // right, so repeating them across every Careerjet page would just be
    // confusing duplication for a low-volume Phase-1 inventory.
    const directPromise = page === 1
      ? fetch(
          `/api/jobs/direct?${new URLSearchParams({
            search: activeRole,
            location: activeLocation,
            ...(directEmploymentType(activeContract) ? { employment_type: directEmploymentType(activeContract)! } : {}),
          }).toString()}`,
          { signal: controller.signal }
        )
          .then(res => (res.ok ? (res.json() as Promise<DirectJobsResponse>) : { jobs: [] }))
          .then(data => Array.isArray(data.jobs) ? data.jobs : [])
          .catch(err => {
            if ((err as Error).name !== 'AbortError') console.error('Direct jobs fetch failed:', err)
            return [] as DirectJob[]
          })
      : Promise.resolve([] as DirectJob[])

    const careerjetPromise = (async () => {
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
      return { res, data }
    })()

    try {
      const [direct, { res, data }] = await Promise.all([directPromise, careerjetPromise])

      setDirectJobs(direct)

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
    setPage(1)
  }

  // Combined count only adds direct jobs when there are any — avoids
  // inflating the displayed total on searches with zero direct matches.
  const count = (hits ?? jobs.length) + (directJobs.length > 0 ? directJobs.length : 0)
  const isFirstLoad = loading && jobs.length === 0 && directJobs.length === 0

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

          <div className="w-full bg-white rounded-[18px] shadow-lg overflow-hidden">
            <form onSubmit={handleSearch}>
              {/* Row 1 — desktop: role | divider | location | button */}
              <div className="hidden md:flex md:items-stretch border-b border-[#ECECEC]">
                <div className="flex items-center gap-2 flex-1 py-[16px] px-[18px]">
                  <HeroSearchIcon />
                  <input
                    type="text"
                    value={roleInput}
                    onChange={e => handleRoleInputChange(e.target.value)}
                    placeholder="e.g. Auditor, Payroll Manager, CFO..."
                    className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                    autoComplete="off"
                  />
                </div>
                <div className="w-px shrink-0 bg-[#ECECEC]" />
                <div className="flex items-center gap-2 flex-1 py-[16px] px-[18px]">
                  <HeroLocationIcon />
                  <input
                    type="text"
                    value={locationInput}
                    onChange={e => setLocationInput(e.target.value)}
                    placeholder="Leave blank for local jobs, or enter a city/country"
                    className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                    autoComplete="off"
                  />
                </div>
                <div className="w-[130px] shrink-0 py-[10px] px-[12px]">
                  <button
                    type="submit"
                    className="w-full bg-[#B8862E] hover:brightness-110 text-white rounded-[10px] py-[12px] text-sm font-semibold transition-all"
                  >
                    Search Jobs
                  </button>
                </div>
              </div>

              {/* Row 1 — mobile: stacked */}
              <div className="flex flex-col gap-3 p-4 md:hidden border-b border-[#ECECEC]">
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-2.5">
                  <HeroSearchIcon />
                  <input
                    type="text"
                    value={roleInput}
                    onChange={e => handleRoleInputChange(e.target.value)}
                    placeholder="e.g. Auditor, Payroll Manager, CFO..."
                    className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-2.5">
                  <HeroLocationIcon />
                  <input
                    type="text"
                    value={locationInput}
                    onChange={e => setLocationInput(e.target.value)}
                    placeholder="Leave blank for local jobs, or enter a city/country"
                    className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#B8862E] hover:brightness-110 text-white rounded-[10px] py-[12px] px-[18px] text-sm font-semibold transition-all"
                >
                  Search Jobs
                </button>
              </div>
            </form>

            {/* Row 2 — desktop: contract | divider | sort | spacer */}
            <div className="hidden md:flex md:items-stretch bg-[#FAFAFA]">
              <div className="flex-1 py-[14px] px-[18px]">
                <span className="block text-[10px] uppercase text-[#bbb] font-semibold tracking-[0.08em] mb-[10px]">Contract Type</span>
                <div className="grid grid-cols-2 gap-[6px]">
                  {CONTRACT_OPTIONS.map((opt, i) => (
                    <div key={opt.value} className={i === CONTRACT_OPTIONS.length - 1 ? 'col-span-2' : undefined}>
                      <PillButton
                        label={opt.label}
                        variant="contract"
                        active={activeContract === opt.value}
                        onClick={() => handleContractChange(opt.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-px shrink-0 bg-[#ECECEC]" />
              <div className="flex-1 py-[14px] px-[18px]">
                <span className="block text-[10px] uppercase text-[#bbb] font-semibold tracking-[0.08em] mb-[10px]">Sort By</span>
                <div className="grid grid-cols-3 gap-[6px]">
                  {SORT_OPTIONS.map(opt => (
                    <PillButton
                      key={opt.value}
                      label={opt.label}
                      variant="sort"
                      active={activeSort === opt.value}
                      onClick={() => handleSortChange(opt.value)}
                    />
                  ))}
                </div>
              </div>
              <div className="w-[130px] shrink-0 bg-[#FAFAFA]" />
            </div>

            {/* Row 2 — mobile: contract, then sort */}
            <div className="flex flex-col md:hidden bg-[#FAFAFA]">
              <div className="py-[14px] px-[18px]">
                <span className="block text-[10px] uppercase text-[#bbb] font-semibold tracking-[0.08em] mb-[10px]">Contract Type</span>
                <div className="grid grid-cols-2 gap-[6px]">
                  {CONTRACT_OPTIONS.map((opt, i) => (
                    <div key={opt.value} className={i === CONTRACT_OPTIONS.length - 1 ? 'col-span-2' : undefined}>
                      <PillButton
                        label={opt.label}
                        variant="contract"
                        active={activeContract === opt.value}
                        onClick={() => handleContractChange(opt.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[#ECECEC] py-[14px] px-[18px]">
                <span className="block text-[10px] uppercase text-[#bbb] font-semibold tracking-[0.08em] mb-[10px]">Sort By</span>
                <div className="grid grid-cols-3 gap-[6px]">
                  {SORT_OPTIONS.map(opt => (
                    <PillButton
                      key={opt.value}
                      label={opt.label}
                      variant="sort"
                      active={activeSort === opt.value}
                      onClick={() => handleSortChange(opt.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-white/50 text-xs mt-3">
            Showing jobs near you — enter a location to search elsewhere
          </p>
        </div>
      </section>

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

          {!error && !isFirstLoad && jobs.length === 0 && directJobs.length === 0 && (
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

          {!error && (jobs.length > 0 || directJobs.length > 0) && (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 flex items-start justify-center pt-12 z-10">
                  <Spinner />
                </div>
              )}
              <div className={`transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {directJobs.map(job => (
                    <DirectJobCard key={`direct-${job.id}`} job={job} />
                  ))}
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
