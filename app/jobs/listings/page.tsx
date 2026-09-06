'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Job, EmploymentType, SeniorityLevel } from '@/lib/jobs'

interface DirectJobsResponse {
  jobs?: Job[]
  total?: number
}

type PostedWithin = 'all' | '24h' | '7d' | '30d'

const PAGE_SIZE = 24
const DEBOUNCE_MS = 300

const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'CPA', 'AAT', 'CFA'] as const

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'director', label: 'Director' },
  { value: 'executive', label: 'Executive' },
]

// jobs.employment_type has no literal "full_time" value — 'permanent' is
// this schema's closest equivalent, so the "Full-time" checkbox maps to it.
const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'permanent', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'internship', label: 'Internship' },
]

const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const POSTED_DAYS: Record<Exclude<PostedWithin, 'all'>, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
}

interface Filters {
  qualifications: string[]
  seniority: SeniorityLevel[]
  employmentTypes: EmploymentType[]
  remoteOnly: boolean
  postedWithin: PostedWithin
  salaryMin: string
  salaryMax: string
}

const EMPTY_FILTERS: Filters = {
  qualifications: [],
  seniority: [],
  employmentTypes: [],
  remoteOnly: false,
  postedWithin: 'all',
  salaryMin: '',
  salaryMax: '',
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
}

function countActiveFilters(f: Filters): number {
  return (
    f.qualifications.length +
    f.seniority.length +
    f.employmentTypes.length +
    (f.remoteOnly ? 1 : 0) +
    (f.postedWithin !== 'all' ? 1 : 0) +
    (f.salaryMin.trim() ? 1 : 0) +
    (f.salaryMax.trim() ? 1 : 0)
  )
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const ageMs = Date.now() - new Date(dateStr).getTime()
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  if (ageDays <= 0) return 'Today'
  if (ageDays === 1) return '1 day ago'
  if (ageDays < 7) return `${ageDays} days ago`
  const weeks = Math.floor(ageDays / 7)
  if (ageDays < 30) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(ageDays / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function formatSalary(job: Job): string | null {
  if (job.salary_text) return job.salary_text
  if (job.salary_min == null && job.salary_max == null) return null
  const currency = job.salary_currency || ''
  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString('en-US')}`.trim()
  if (job.salary_min != null && job.salary_max != null && job.salary_min !== job.salary_max) {
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`
  }
  return fmt(job.salary_min ?? job.salary_max ?? 0)
}

function employmentTypeLabel(value: EmploymentType | null): string | null {
  if (!value) return null
  return EMPLOYMENT_OPTIONS.find(o => o.value === value)?.label ?? value.replace('_', ' ')
}

function seniorityLabel(value: SeniorityLevel | null): string | null {
  if (!value) return null
  return SENIORITY_OPTIONS.find(o => o.value === value)?.label ?? value
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="5.5" />
      <line x1="11" y1="11" x2="15" y2="15" strokeLinecap="round" />
    </svg>
  )
}

function LocationIcon({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function StarIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.74 1-5.8-4.21-4.1 5.82-.85L10 1.5z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
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

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-slate-300 text-gold-500 focus:ring-gold-400 focus:ring-offset-0 cursor-pointer"
      />
      <span className="text-sm text-navy-700 group-hover:text-navy-950 transition-colors">{label}</span>
    </label>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-5 border-b border-slate-200 last:border-b-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function FiltersPanel({
  filters,
  onChange,
  onClear,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  onClear: () => void
}) {
  return (
    <div>
      <FilterSection title="Qualification">
        {QUALIFICATIONS.map(q => (
          <CheckboxRow
            key={q}
            label={q}
            checked={filters.qualifications.includes(q)}
            onChange={() => onChange({ ...filters, qualifications: toggleInArray(filters.qualifications, q) })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Seniority">
        {SENIORITY_OPTIONS.map(opt => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            checked={filters.seniority.includes(opt.value)}
            onChange={() => onChange({ ...filters, seniority: toggleInArray(filters.seniority, opt.value) })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Employment type">
        {EMPLOYMENT_OPTIONS.map(opt => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            checked={filters.employmentTypes.includes(opt.value)}
            onChange={() => onChange({ ...filters, employmentTypes: toggleInArray(filters.employmentTypes, opt.value) })}
          />
        ))}
      </FilterSection>

      <FilterSection title="Salary range">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={filters.salaryMin}
            onChange={e => onChange({ ...filters, salaryMin: e.target.value })}
            className="w-full min-w-0 h-10 px-3 rounded-lg border border-slate-200 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={filters.salaryMax}
            onChange={e => onChange({ ...filters, salaryMax: e.target.value })}
            className="w-full min-w-0 h-10 px-3 rounded-lg border border-slate-200 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-400"
          />
        </div>
      </FilterSection>

      <FilterSection title="Remote">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-navy-700">Remote only</span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.remoteOnly}
            onClick={() => onChange({ ...filters, remoteOnly: !filters.remoteOnly })}
            className={`relative w-10 h-6 rounded-full transition-colors ${filters.remoteOnly ? 'bg-gold-500' : 'bg-slate-200'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${filters.remoteOnly ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </label>
      </FilterSection>

      <FilterSection title="Posted">
        <div className="flex flex-col gap-1">
          {POSTED_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2.5 py-1 cursor-pointer group">
              <input
                type="radio"
                name="posted-within"
                checked={filters.postedWithin === opt.value}
                onChange={() => onChange({ ...filters, postedWithin: opt.value })}
                className="w-4 h-4 border-slate-300 text-gold-500 focus:ring-gold-400 cursor-pointer"
              />
              <span className="text-sm text-navy-700 group-hover:text-navy-950 transition-colors">{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <div className="pt-5">
        <button
          type="button"
          onClick={onClear}
          className="w-full h-10 rounded-lg border border-slate-200 text-sm font-semibold text-navy-700 hover:bg-slate-50 transition-colors"
        >
          Clear all filters
        </button>
      </div>
    </div>
  )
}

function JobCard({ job, onSelect }: { job: Job; onSelect: (job: Job) => void }) {
  const salary = formatSalary(job)
  const empLabel = employmentTypeLabel(job.employment_type)
  const seniority = seniorityLabel(job.seniority_level)
  const isEmployer = job.source === 'employer'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(job)
        }
      }}
      className={[
        'group bg-white rounded-2xl p-5 flex flex-col cursor-pointer transition-shadow duration-200',
        'border border-slate-100',
        isEmployer ? 'hover:shadow-gold-lg' : 'hover:shadow-md',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
          {job.title}
        </h3>
        {job.is_featured && (
          <span title="Featured" className="shrink-0 text-gold-500 mt-1">
            <StarIcon />
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-navy-700 mb-3">{job.company_name}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 text-xs text-navy-600">
        <span className="flex items-center gap-1">
          <LocationIcon />
          {job.location_text}
        </span>
        {job.location_remote && (
          <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Remote
          </span>
        )}
        {isEmployer && (
          <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Direct
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {empLabel && (
          <span className="inline-flex items-center rounded-full bg-navy-50 text-navy-700 px-2.5 py-1 text-xs font-semibold capitalize">
            {empLabel}
          </span>
        )}
        {seniority && (
          <span className="inline-flex items-center rounded-full bg-slate-100 text-navy-600 px-2.5 py-1 text-xs font-semibold">
            {seniority}
          </span>
        )}
      </div>

      {job.excerpt && (
        <p className="text-sm text-navy-600 leading-relaxed line-clamp-2 mb-3">{job.excerpt}</p>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {salary && (
            <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-300 px-2.5 py-1 text-xs font-bold whitespace-nowrap">
              {salary}
            </span>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">{formatRelativeDate(job.published_at ?? job.created_at)}</p>
        </div>
        <span className="shrink-0 inline-flex items-center justify-center h-10 px-4 rounded-lg bg-navy-950 text-white text-sm font-semibold group-hover:bg-navy-900 transition-colors">
          View Job
        </span>
      </div>
    </div>
  )
}

function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
      <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="h-3 bg-slate-100 rounded w-2/3 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-full mb-1.5" />
      <div className="h-3 bg-slate-100 rounded w-4/5 mb-4" />
      <div className="h-10 bg-slate-100 rounded-lg" />
    </div>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-center py-20 border border-slate-200 rounded-2xl bg-white">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
        <SearchIcon />
      </div>
      <p className="text-navy-950 font-semibold text-lg mb-1">No jobs found for your search</p>
      <p className="text-sm text-slate-500 mb-5">Try adjusting your filters or broadening your search terms.</p>
      <button
        type="button"
        onClick={onClear}
        className="h-11 px-6 rounded-lg border border-navy-950 text-navy-950 text-sm font-semibold hover:bg-navy-950 hover:text-white transition-colors"
      >
        Clear filters
      </button>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages))
  const sorted = Array.from(pages).sort((a, b) => a - b)

  const items: (number | 'ellipsis')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push('ellipsis')
    items.push(p)
  })

  return (
    <nav className="flex items-center justify-center gap-2 mt-10 flex-wrap">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="h-10 px-4 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors"
      >
        Previous
      </button>
      {items.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center text-slate-400 text-sm">…</span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={[
              'w-10 h-10 rounded-lg text-sm font-semibold transition-colors',
              item === page ? 'bg-gold-500 text-navy-950' : 'text-navy-700 hover:bg-slate-100',
            ].join(' ')}
          >
            {item}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="h-10 px-4 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors"
      >
        Next
      </button>
    </nav>
  )
}

function applyJob(job: Job) {
  if (job.source === 'employer') {
    fetch(`/api/jobs/click/${job.id}`, { method: 'POST' }).catch(() => {})
  }

  if (job.apply_method === 'external' && job.application_url) {
    window.open(job.application_url, '_blank', 'noopener,noreferrer')
  } else if (job.apply_method === 'email' && job.application_email) {
    window.location.href = `mailto:${job.application_email}?subject=${encodeURIComponent('Application: ' + job.title)}`
  } else {
    window.open(`/jobs/apply/${job.id}`, '_blank', 'noopener,noreferrer')
  }
}

function DetailPanelContent({ job, onClose }: { job: Job; onClose: () => void }) {
  const salary = formatSalary(job)
  const empLabel = employmentTypeLabel(job.employment_type)
  const seniority = seniorityLabel(job.seniority_level)

  return (
    <>
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Job details</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full text-navy-600 hover:bg-slate-100 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-start gap-3 mb-2">
          <h2 className="font-display text-2xl text-navy-950 leading-snug">{job.title}</h2>
          {job.is_featured && (
            <span title="Featured" className="shrink-0 text-gold-500 mt-1.5">
              <StarIcon className="w-4 h-4" />
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-navy-700 mb-4">{job.company_name}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm text-navy-600">
          <span className="flex items-center gap-1.5">
            <LocationIcon className="w-4 h-4" />
            {job.location_text}
          </span>
          {salary && <span className="font-semibold text-gold-700">{salary}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          {empLabel && (
            <span className="inline-flex items-center rounded-full bg-navy-50 text-navy-700 px-2.5 py-1 text-xs font-semibold capitalize">
              {empLabel}
            </span>
          )}
          {seniority && (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-navy-600 px-2.5 py-1 text-xs font-semibold">
              {seniority}
            </span>
          )}
          {job.location_remote && (
            <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">
              Remote
            </span>
          )}
          {job.source === 'employer' && (
            <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">
              Direct
            </span>
          )}
        </div>

        <div className="prose prose-sm max-w-none text-navy-700 whitespace-pre-line leading-relaxed">
          {job.description}
        </div>
      </div>

      <div className="px-6 py-5 border-t border-slate-100 shrink-0">
        <button
          type="button"
          onClick={() => applyJob(job)}
          className="w-full h-12 rounded-lg bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition-colors"
        >
          Apply Now
        </button>
      </div>
    </>
  )
}

export default function JobListingsPage() {
  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [activeLocation, setActiveLocation] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [displayedJob, setDisplayedJob] = useState<Job | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const debouncedRole = useDebouncedValue(roleInput, DEBOUNCE_MS)
  const debouncedLocation = useDebouncedValue(locationInput, DEBOUNCE_MS)

  useEffect(() => {
    setActiveSearch(debouncedRole.trim())
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedRole])

  useEffect(() => {
    setActiveLocation(debouncedLocation.trim())
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLocation])

  useEffect(() => {
    if (selectedJob) setDisplayedJob(selectedJob)
  }, [selectedJob])

  useEffect(() => {
    document.body.style.overflow = selectedJob || drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedJob, drawerOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (selectedJob) setSelectedJob(null)
      else if (drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedJob, drawerOpen])

  const fetchJobs = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    })
    if (activeSearch) params.set('search', activeSearch)
    if (activeLocation) params.set('location', activeLocation)
    if (filters.employmentTypes.length > 0) params.set('employment_types', filters.employmentTypes.join(','))
    if (filters.seniority.length > 0) params.set('seniority', filters.seniority.join(','))
    if (filters.remoteOnly) params.set('remote', 'true')
    if (filters.salaryMin.trim()) params.set('salary_min', filters.salaryMin.trim())
    if (filters.salaryMax.trim()) params.set('salary_max', filters.salaryMax.trim())
    if (filters.postedWithin !== 'all') params.set('posted_within', String(POSTED_DAYS[filters.postedWithin]))
    if (filters.qualifications.length > 0) params.set('qualifications', filters.qualifications.join(','))

    try {
      const res = await fetch(`/api/jobs/direct?${params.toString()}`, { signal: controller.signal })
      const data: DirectJobsResponse = await res.json()
      setJobs(Array.isArray(data.jobs) ? data.jobs : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Could not load jobs right now. Please try again.')
      setJobs([])
      setTotal(0)
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }, [activeSearch, activeLocation, filters, page])

  useEffect(() => {
    fetchJobs()
    return () => abortRef.current?.abort()
  }, [fetchJobs])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activeFilterCount = countActiveFilters(filters)
  const isFirstLoad = loading && jobs.length === 0

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setActiveSearch(roleInput.trim())
    setActiveLocation(locationInput.trim())
    setPage(1)
    scrollToResults()
  }

  function handleFiltersChange(next: Filters) {
    setFilters(next)
    setPage(1)
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  function handlePageChange(next: number) {
    setPage(next)
    scrollToResults()
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <main className="min-h-screen bg-slate-50">
      {/* STICKY SEARCH BAR */}
      <div className="sticky top-0 z-nav bg-navy-950">
        <div className="container-wide py-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-lg px-4 h-12">
              <span className="text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                placeholder="Job title, skills, keywords"
                className="flex-1 min-w-0 text-sm font-medium text-navy-950 placeholder:text-slate-400 bg-transparent outline-none"
                autoComplete="off"
              />
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white rounded-lg px-4 h-12">
              <span className="text-slate-400 shrink-0">
                <LocationIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="Location or remote"
                className="flex-1 min-w-0 text-sm font-medium text-navy-950 placeholder:text-slate-400 bg-transparent outline-none"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-8 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-bold transition-colors shrink-0"
            >
              Search
            </button>
          </form>
          <p className="text-white/50 text-xs mt-3">
            {loading && jobs.length === 0
              ? 'Searching…'
              : `${total.toLocaleString()} accounting job${total === 1 ? '' : 's'} found`}
          </p>
        </div>
      </div>

      {/* MOBILE FILTER TRIGGER */}
      <div className="lg:hidden container-wide pt-4">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="w-full h-11 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-navy-700 flex items-center justify-center gap-2"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gold-500 text-navy-950 text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="container-wide py-8" ref={resultsRef} style={{ scrollMarginTop: '5rem' }}>
        <div className="flex gap-8 items-start">
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden lg:block w-[280px] shrink-0 bg-white rounded-2xl border border-slate-100 p-5 sticky top-24">
            <FiltersPanel filters={filters} onChange={handleFiltersChange} onClear={handleClearFilters} />
          </aside>

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0">
            {error && (
              <div className="text-center py-16 border border-slate-200 rounded-2xl bg-white">
                <p className="text-navy-950 font-semibold mb-1">Something went wrong</p>
                <p className="text-sm text-slate-500 mb-4">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchJobs()}
                  className="h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!error && isFirstLoad && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            )}

            {!error && !isFirstLoad && jobs.length === 0 && <EmptyState onClear={handleClearFilters} />}

            {!error && !isFirstLoad && jobs.length > 0 && (
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 flex items-start justify-center pt-12 z-10">
                    <Spinner />
                  </div>
                )}
                <div className={`transition-opacity duration-200 ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
                  <p className="text-sm text-slate-500 mb-4">
                    Showing {rangeStart}-{rangeEnd} of {total.toLocaleString()} jobs
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {jobs.map(job => (
                      <JobCard key={job.id} job={job} onSelect={setSelectedJob} />
                    ))}
                  </div>
                  <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE FILTER DRAWER */}
      <div className={`fixed inset-0 z-overlay lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-navy-950/40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={[
            'absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto',
            'transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-navy-950">Filters</span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close filters"
              className="w-9 h-9 flex items-center justify-center rounded-full text-navy-600 hover:bg-slate-100 transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="px-5 pb-6">
            <FiltersPanel filters={filters} onChange={handleFiltersChange} onClear={handleClearFilters} />
          </div>
        </div>
      </div>

      {/* JOB DETAIL SLIDE-OVER */}
      <div className={`fixed inset-0 z-modal ${selectedJob ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setSelectedJob(null)}
          className={`absolute inset-0 bg-navy-950/40 transition-opacity duration-300 ${selectedJob ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={[
            'absolute top-0 right-0 h-full w-full md:w-[560px] bg-white shadow-2xl flex flex-col',
            'transition-transform duration-300 ease-out',
            selectedJob ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
        >
          {displayedJob && <DetailPanelContent job={displayedJob} onClose={() => setSelectedJob(null)} />}
        </div>
      </div>
    </main>
  )
}
