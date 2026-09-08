'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Job, EmploymentType, SeniorityLevel } from '@/lib/jobs'

interface DirectJobsResponse {
  jobs?: Job[]
  total?: number
}

type PostedWithin = 'all' | '24h' | '7d' | '30d'
type SortBy = 'relevance' | 'recent' | 'salary_high' | 'salary_low'

const PAGE_SIZE = 24
const DEBOUNCE_MS = 300

const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'CPA', 'AAT', 'CFA'] as const

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string }[] = [
  { value: 'junior',    label: 'Junior' },
  { value: 'mid',       label: 'Mid-level' },
  { value: 'senior',    label: 'Senior' },
  { value: 'director',  label: 'Director' },
  { value: 'executive', label: 'Executive' },
]

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'permanent',  label: 'Permanent' },
  { value: 'contract',   label: 'Contract' },
  { value: 'temporary',  label: 'Temporary' },
  { value: 'part_time',  label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
]

const COUNTRY_OPTIONS = [
  { value: 'all',            label: 'All countries' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States',  label: 'United States' },
  { value: 'Australia',      label: 'Australia' },
  { value: 'Canada',         label: 'Canada' },
  { value: 'Singapore',      label: 'Singapore' },
  { value: 'South Africa',   label: 'South Africa' },
  { value: 'Worldwide',      label: 'Worldwide / Remote' },
  { value: 'Philippines',    label: 'Philippines' },
  { value: 'Turkey',         label: 'Turkey' },
  { value: 'Mexico',         label: 'Mexico' },
  { value: 'Bulgaria',       label: 'Bulgaria' },
]

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'relevance',   label: 'Most relevant' },
  { value: 'recent',      label: 'Most recent' },
  { value: 'salary_high', label: 'Salary: high to low' },
  { value: 'salary_low',  label: 'Salary: low to high' },
]

const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const POSTED_DAYS: Record<Exclude<PostedWithin, 'all'>, number> = {
  '24h': 1, '7d': 7, '30d': 30,
}

interface Filters {
  qualifications:  string[]
  seniority:       SeniorityLevel[]
  employmentTypes: EmploymentType[]
  locationCountry: string
  remoteOnly:      boolean
  postedWithin:    PostedWithin
  salaryMin:       string
  salaryMax:       string
}

const EMPTY_FILTERS: Filters = {
  qualifications:  [],
  seniority:       [],
  employmentTypes: [],
  locationCountry: 'all',
  remoteOnly:      false,
  postedWithin:    'all',
  salaryMin:       '',
  salaryMax:       '',
}

// ── Saved jobs (localStorage) ─────────────────────────────────────────────

function useSavedJobs() {
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('ab_saved_jobs')
      return new Set(stored ? (JSON.parse(stored) as string[]) : [])
    } catch {
      return new Set<string>()
    }
  })

  function toggleSaved(id: string) {
    setSavedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('ab_saved_jobs', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  return { savedIds, toggleSaved }
}

// ── Recent views (localStorage) ───────────────────────────────────────────

function useRecentViews() {
  function recordView(id: string) {
    try {
      const stored = localStorage.getItem('ab_recent_views')
      const arr: string[] = stored ? (JSON.parse(stored) as string[]) : []
      const updated = [id, ...arr.filter(i => i !== id)].slice(0, 10)
      localStorage.setItem('ab_recent_views', JSON.stringify(updated))
    } catch {}
  }
  return { recordView }
}

// ── Utilities ─────────────────────────────────────────────────────────────

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
    (f.locationCountry !== 'all' ? 1 : 0) +
    (f.remoteOnly ? 1 : 0) +
    (f.postedWithin !== 'all' ? 1 : 0) +
    (f.salaryMin.trim() ? 1 : 0) +
    (f.salaryMax.trim() ? 1 : 0)
  )
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const ageMs = Date.now() - new Date(dateStr).getTime()
  const ageMins = Math.floor(ageMs / 60000)
  if (ageMins < 60) return ageMins <= 1 ? 'Just now' : `${ageMins}m ago`
  const ageHrs = Math.floor(ageMins / 60)
  if (ageHrs < 24) return `${ageHrs}h ago`
  const ageDays = Math.floor(ageHrs / 24)
  if (ageDays === 1) return 'Yesterday'
  if (ageDays < 7) return `${ageDays} days ago`
  const weeks = Math.floor(ageDays / 7)
  if (ageDays < 30) return `${weeks}w ago`
  const months = Math.floor(ageDays / 30)
  return `${months}mo ago`
}

function isNewJob(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
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

function getCompanyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function getCompanyColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
    'bg-red-100 text-red-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// ── Icons ─────────────────────────────────────────────────────────────────

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

function BookmarkIcon({ saved }: { saved: boolean }) {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
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

function BellIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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

// ── Filter components ─────────────────────────────────────────────────────

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
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

function FiltersPanel({ filters, onChange, onClear }: {
  filters: Filters
  onChange: (next: Filters) => void
  onClear: () => void
}) {
  return (
    <div>
      <FilterSection title="Country">
        <select
          value={filters.locationCountry}
          onChange={e => onChange({ ...filters, locationCountry: e.target.value })}
          className="w-full h-10 rounded-lg border border-slate-200 text-sm font-medium text-navy-950 px-3 focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white"
        >
          {COUNTRY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </FilterSection>

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
          <span className="text-slate-400 text-sm shrink-0">–</span>
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
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${filters.remoteOnly ? 'translate-x-4' : 'translate-x-0'}`} />
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

// ── Active filter chips ───────────────────────────────────────────────────

function ActiveFilterChips({ filters, sortBy, onRemoveFilter, onRemoveSort }: {
  filters: Filters
  sortBy: SortBy
  onRemoveFilter: (next: Filters) => void
  onRemoveSort: () => void
}) {
  const chips: { label: string; onRemove: () => void }[] = []

  if (filters.locationCountry !== 'all') {
    const label = COUNTRY_OPTIONS.find(o => o.value === filters.locationCountry)?.label ?? filters.locationCountry
    chips.push({ label, onRemove: () => onRemoveFilter({ ...filters, locationCountry: 'all' }) })
  }
  filters.qualifications.forEach(q => chips.push({
    label: q,
    onRemove: () => onRemoveFilter({ ...filters, qualifications: filters.qualifications.filter(x => x !== q) }),
  }))
  filters.seniority.forEach(s => {
    const label = SENIORITY_OPTIONS.find(o => o.value === s)?.label ?? s
    chips.push({ label, onRemove: () => onRemoveFilter({ ...filters, seniority: filters.seniority.filter(x => x !== s) }) })
  })
  filters.employmentTypes.forEach(e => {
    const label = EMPLOYMENT_OPTIONS.find(o => o.value === e)?.label ?? e
    chips.push({ label, onRemove: () => onRemoveFilter({ ...filters, employmentTypes: filters.employmentTypes.filter(x => x !== e) }) })
  })
  if (filters.remoteOnly) chips.push({ label: 'Remote only', onRemove: () => onRemoveFilter({ ...filters, remoteOnly: false }) })
  if (filters.postedWithin !== 'all') {
    const label = POSTED_OPTIONS.find(o => o.value === filters.postedWithin)?.label ?? filters.postedWithin
    chips.push({ label, onRemove: () => onRemoveFilter({ ...filters, postedWithin: 'all' }) })
  }
  if (filters.salaryMin.trim()) chips.push({ label: `Min £${filters.salaryMin}`, onRemove: () => onRemoveFilter({ ...filters, salaryMin: '' }) })
  if (filters.salaryMax.trim()) chips.push({ label: `Max £${filters.salaryMax}`, onRemove: () => onRemoveFilter({ ...filters, salaryMax: '' }) })
  if (sortBy !== 'relevance') {
    const label = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? sortBy
    chips.push({ label: `Sort: ${label}`, onRemove: onRemoveSort })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map(chip => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-full bg-navy-950 text-white text-xs font-semibold hover:bg-navy-800 transition-colors"
        >
          {chip.label}
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">✕</span>
        </button>
      ))}
    </div>
  )
}

// ── Job alert banner ──────────────────────────────────────────────────────

function JobAlertBanner({ search, filters, onDismiss }: {
  search: string
  filters: Filters
  onDismiss: () => void
}) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    // Store alert preference in localStorage — server-side alert system to be built later
    try {
      const stored = localStorage.getItem('ab_job_alerts')
      const alerts: Array<{ email: string; search: string; filters: Filters; created: string }> =
        stored ? JSON.parse(stored) as typeof alerts : []
      alerts.push({ email: email.trim(), search, filters, created: new Date().toISOString() })
      localStorage.setItem('ab_job_alerts', JSON.stringify(alerts))
    } catch {}
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-between gap-4 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <BellIcon />
          </div>
          <p className="text-sm font-semibold text-green-800">Alert set! We will notify you when new matching jobs are posted.</p>
        </div>
        <button type="button" onClick={onDismiss} className="text-green-600 hover:text-green-800 shrink-0">
          <CloseIcon />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-navy-950 rounded-2xl px-5 py-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center shrink-0 text-gold-500">
            <BellIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold mb-0.5">Get notified about new jobs</p>
            <p className="text-white/50 text-xs">
              {search ? `New "${search}" jobs` : 'New accounting jobs'} matching your filters
            </p>
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="text-white/40 hover:text-white/70 shrink-0 mt-0.5">
          <CloseIcon />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-4 rounded-lg bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition-colors shrink-0 disabled:opacity-60"
        >
          {loading ? '…' : 'Set alert'}
        </button>
      </form>
    </div>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────

function JobCard({ job, onSelect, saved, onSave }: {
  job: Job
  onSelect: (job: Job) => void
  saved: boolean
  onSave: (id: string) => void
}) {
  const salary = formatSalary(job)
  const empLabel = employmentTypeLabel(job.employment_type)
  const seniority = seniorityLabel(job.seniority_level)
  const isEmployer = job.source === 'employer'
  const initials = getCompanyInitials(job.company_name)
  const avatarColor = getCompanyColor(job.company_name)
  const dateStr = job.published_at ?? job.created_at
  const isNew = isNewJob(dateStr)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(job) }
      }}
      className={[
        'group bg-white rounded-2xl p-5 flex flex-col cursor-pointer transition-all duration-200',
        'border border-slate-100',
        isEmployer ? 'hover:shadow-gold-lg hover:border-gold-200' : 'hover:shadow-md hover:border-slate-200',
      ].join(' ')}
    >
      {/* Header: avatar + title + bookmark */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold ${avatarColor}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors line-clamp-2">
              {job.title}
            </h3>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSave(job.id) }}
              aria-label={saved ? 'Unsave job' : 'Save job'}
              className={`shrink-0 p-1.5 rounded-lg transition-colors mt-0.5 ${saved ? 'text-gold-500 bg-gold-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
            >
              <BookmarkIcon saved={saved} />
            </button>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{job.company_name}</p>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: '#64748b' }}>
        <LocationIcon />
        <span>
          {job.location_country && job.location_country !== job.location_text
            ? job.location_country
            : job.location_text}
        </span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {empLabel && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold" style={{ color: '#334155' }}>
            {empLabel}
          </span>
        )}
        {seniority && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold" style={{ color: '#334155' }}>
            {seniority}
          </span>
        )}
        {job.location_remote && (
          <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#0d9185' }}>
            Remote
          </span>
        )}
        {isNew && (
          <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#16a34a' }}>
            New
          </span>
        )}
        {isEmployer && (
          <span className="inline-flex items-center rounded-full bg-gold-50 border border-gold-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#b87d10' }}>
            Direct
          </span>
        )}
        {job.is_featured && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 border border-gold-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#b87d10' }}>
            <StarIcon className="w-3 h-3" />Featured
          </span>
        )}
      </div>

      {/* Excerpt (hidden on mobile to keep cards compact) */}
      {job.excerpt && (
        <div className="hidden md:block">
          <p className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: '#64748b' }}>{job.excerpt}</p>
        </div>
      )}

      {/* Footer: salary + date + CTA */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {salary ? (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap" style={{ background: '#fdf9ec', color: '#b87d10', border: '1px solid #f5e095' }}>
              {salary}
            </span>
          ) : (
            <span className="text-xs text-slate-400">Salary not specified</span>
          )}
          <p className="text-[11px] text-slate-400 mt-1.5">{formatRelativeDate(dateStr)}</p>
        </div>
        <span className="shrink-0 inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-bold transition-all" style={{ background: '#0C1A3D', color: '#ffffff' }}>
          View Job →
        </span>
      </div>
    </div>
  )
}

function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded w-2/3 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-full mb-1.5" />
      <div className="h-3 bg-slate-100 rounded w-4/5 mb-4" />
      <div className="h-9 bg-slate-100 rounded-lg" />
    </div>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-center py-20 border border-slate-200 rounded-2xl bg-white">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
        <SearchIcon />
      </div>
      <p className="text-navy-950 font-semibold text-lg mb-1">No jobs found</p>
      <p className="text-sm text-slate-500 mb-5">Try adjusting your filters or broadening your search terms.</p>
      <button
        type="button"
        onClick={onClear}
        className="h-11 px-6 rounded-lg border border-navy-950 text-navy-950 text-sm font-semibold hover:bg-navy-950 hover:text-white transition-colors"
      >
        Clear all filters
      </button>
    </div>
  )
}

function Pagination({ page, totalPages, onChange }: {
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
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
        className="h-10 px-4 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors">
        Previous
      </button>
      {items.map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e${i}`} className="w-8 text-center text-slate-400 text-sm">…</span>
        ) : (
          <button key={item} type="button" onClick={() => onChange(item)}
            className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${item === page ? 'bg-gold-500 text-navy-950' : 'text-navy-700 hover:bg-slate-100'}`}>
            {item}
          </button>
        )
      )}
      <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        className="h-10 px-4 rounded-lg text-sm font-medium border border-navy-950 text-navy-950 disabled:opacity-40 disabled:pointer-events-none hover:bg-navy-950 hover:text-white transition-colors">
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

// ── Detail panel ──────────────────────────────────────────────────────────

function DetailPanelContent({ job, onClose, saved, onSave }: {
  job: Job
  onClose: () => void
  saved: boolean
  onSave: (id: string) => void
}) {
  const salary = formatSalary(job)
  const empLabel = employmentTypeLabel(job.employment_type)
  const seniority = seniorityLabel(job.seniority_level)
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const url = `${window.location.origin}/jobs/listings?job=${job.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const paragraphs = job.description
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean)

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Job details</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave(job.id)}
            aria-label={saved ? 'Unsave job' : 'Save job'}
            className={`p-2 rounded-lg transition-colors ${saved ? 'text-gold-500 bg-gold-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            <BookmarkIcon saved={saved} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share job"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {copied ? <span className="text-xs font-semibold text-green-600 px-1">Copied!</span> : <ShareIcon />}
          </button>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:bg-slate-100 transition-colors">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Company avatar + title */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-lg font-bold ${getCompanyColor(job.company_name)}`}>
            {getCompanyInitials(job.company_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl text-navy-950 leading-snug mb-1">{job.title}</h2>
            <p className="text-base font-semibold text-gray-800">{job.company_name}</p>
          </div>
        </div>

        {/* Location + salary */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <LocationIcon className="w-4 h-4" />
            {job.location_text}
            {job.location_country && job.location_country !== job.location_text && (
              <span className="text-slate-400">· {job.location_country}</span>
            )}
          </span>
          {salary && <span className="font-semibold text-gold-700">{salary}</span>}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          {empLabel && (
            <span className="inline-flex items-center rounded-full bg-navy-50 text-navy-700 px-2.5 py-1 text-xs font-semibold">{empLabel}</span>
          )}
          {seniority && (
            <span className="inline-flex items-center rounded-full bg-slate-100 text-gray-600 px-2.5 py-1 text-xs font-semibold">{seniority}</span>
          )}
          {job.location_remote && (
            <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">Remote</span>
          )}
          {job.source === 'employer' && (
            <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">Direct Employer</span>
          )}
          {isNewJob(job.published_at ?? job.created_at) && (
            <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">New</span>
          )}
          {job.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">
              <StarIcon className="w-3 h-3" />Featured
            </span>
          )}
        </div>

        {/* Posted date */}
        <p className="text-xs text-slate-400 mb-6">{formatRelativeDate(job.published_at ?? job.created_at)}</p>

        {/* Description */}
        <div className="space-y-3">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed" style={{ color: '#334155' }}>{para}</p>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 border-t border-slate-100 shrink-0 space-y-3">
        <button
          type="button"
          onClick={() => applyJob(job)}
          className="w-full h-14 rounded-xl text-sm font-bold transition-all active:scale-95"
          style={{ background: '#D4A017', color: '#0C1A3D' }}
        >
          Apply Now →
        </button>
        <p className="text-xs text-center mt-2" style={{ color: '#94a3b8' }}>
          Opens the employer&apos;s application page
        </p>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function JobListingsClient({ isEthioTax }: { isEthioTax: boolean }) {
  const platform = isEthioTax ? 'et' : 'ab'

  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [activeLocation, setActiveLocation] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState<SortBy>('relevance')
  const [page, setPage] = useState(1)
  const [showAlert, setShowAlert] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)

  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [displayedJob, setDisplayedJob] = useState<Job | null>(null)

  const { savedIds, toggleSaved } = useSavedJobs()
  const { recordView } = useRecentViews()

  const abortRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const debouncedRole = useDebouncedValue(roleInput, DEBOUNCE_MS)
  const debouncedLocation = useDebouncedValue(locationInput, DEBOUNCE_MS)

  useEffect(() => { setActiveSearch(debouncedRole.trim()); setPage(1) }, [debouncedRole])
  useEffect(() => { setActiveLocation(debouncedLocation.trim()); setPage(1) }, [debouncedLocation])
  useEffect(() => { if (selectedJob) { setDisplayedJob(selectedJob); recordView(selectedJob.id) } }, [selectedJob, recordView])
  useEffect(() => { document.body.style.overflow = selectedJob || drawerOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [selectedJob, drawerOpen])
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (selectedJob) setSelectedJob(null)
      else if (drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedJob, drawerOpen])

  // Show job alert banner after 10 seconds if user has an active search
  useEffect(() => {
    if (alertDismissed || !activeSearch) return
    const timer = setTimeout(() => setShowAlert(true), 10000)
    return () => clearTimeout(timer)
  }, [activeSearch, alertDismissed])

  const fetchJobs = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      platform,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    })
    if (activeSearch) params.set('search', activeSearch)
    if (activeLocation) params.set('location', activeLocation)
    if (filters.employmentTypes.length > 0) params.set('employment_types', filters.employmentTypes.join(','))
    if (filters.seniority.length > 0) params.set('seniority', filters.seniority.join(','))
    if (filters.locationCountry !== 'all') params.set('location_country', filters.locationCountry)
    if (filters.remoteOnly) params.set('remote', 'true')
    if (filters.salaryMin.trim()) params.set('salary_min', filters.salaryMin.trim())
    if (filters.salaryMax.trim()) params.set('salary_max', filters.salaryMax.trim())
    if (filters.postedWithin !== 'all') params.set('posted_within', String(POSTED_DAYS[filters.postedWithin]))
    if (filters.qualifications.length > 0) params.set('qualifications', filters.qualifications.join(','))
    if (sortBy !== 'relevance') params.set('sort_by', sortBy)

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
  }, [platform, activeSearch, activeLocation, filters, sortBy, page])

  useEffect(() => { fetchJobs(); return () => abortRef.current?.abort() }, [fetchJobs])

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

  function handleFiltersChange(next: Filters) { setFilters(next); setPage(1) }
  function handleClearFilters() { setFilters(EMPTY_FILTERS); setSortBy('relevance'); setPage(1) }
  function handlePageChange(next: number) { setPage(next); scrollToResults() }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <main className="min-h-screen bg-slate-50">
      {/* STICKY SEARCH BAR */}
      <div className="sticky top-0 z-nav bg-navy-950">
        <div className="container-wide py-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-4 h-12 border border-white/20 shadow-sm">
              <span className="text-slate-400"><SearchIcon /></span>
              <input
                type="text"
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                placeholder="Job title, skills, keywords"
                className="flex-1 min-w-0 text-sm font-medium text-navy-950 placeholder:text-slate-400 bg-transparent outline-none"
                autoComplete="off"
              />
              {roleInput && (
                <button type="button" onClick={() => { setRoleInput(''); setActiveSearch(''); setPage(1) }}
                  className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                  <CloseIcon />
                </button>
              )}
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-4 h-12 border border-white/20 shadow-sm">
              <span className="text-slate-400 shrink-0"><LocationIcon className="w-4 h-4" /></span>
              <input
                type="text"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="Location or remote"
                className="flex-1 min-w-0 text-sm font-medium text-navy-950 placeholder:text-slate-400 bg-transparent outline-none"
                autoComplete="off"
              />
              {locationInput && (
                <button type="button" onClick={() => { setLocationInput(''); setActiveLocation(''); setPage(1) }}
                  className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                  <CloseIcon />
                </button>
              )}
            </div>
            <button type="submit"
              className="h-12 px-8 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-bold transition-colors shrink-0 w-full md:w-auto">
              Search
            </button>
          </form>
          <p className="text-white/60 text-xs mt-2 font-medium">
            {loading && jobs.length === 0 ? 'Searching…' : `${total.toLocaleString()} accounting job${total === 1 ? '' : 's'} found`}
          </p>
        </div>
      </div>

      {/* MOBILE FILTER TRIGGER */}
      <div className="lg:hidden container-wide pt-4">
        <button type="button" onClick={() => setDrawerOpen(true)}
          className="w-full h-12 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform" style={{ color: '#0C1A3D' }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold" style={{ background: '#D4A017', color: '#0C1A3D' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="container-wide pt-5 pb-10" ref={resultsRef} style={{ scrollMarginTop: '6rem' }}>
        <div className="flex gap-8 items-start">
          {/* DESKTOP SIDEBAR */}
          <aside className="hidden lg:block w-[280px] shrink-0 bg-white rounded-2xl border border-slate-100 p-5 sticky top-24">
            <FiltersPanel filters={filters} onChange={handleFiltersChange} onClear={handleClearFilters} />
          </aside>

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0">
            {/* Job alert banner */}
            {showAlert && !alertDismissed && (
              <JobAlertBanner
                search={activeSearch}
                filters={filters}
                onDismiss={() => { setShowAlert(false); setAlertDismissed(true) }}
              />
            )}

            {error && (
              <div className="text-center py-16 border border-slate-200 rounded-2xl bg-white">
                <p className="text-navy-950 font-semibold mb-1">Something went wrong</p>
                <p className="text-sm text-slate-500 mb-4">{error}</p>
                <button type="button" onClick={() => fetchJobs()}
                  className="h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors">
                  Retry
                </button>
              </div>
            )}

            {!error && isFirstLoad && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
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
                  {/* Sort bar + active chips */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm text-slate-500 font-medium">
                        {total.toLocaleString()} job{total === 1 ? '' : 's'} found
                      </p>
                      <div className="relative">
                        <select
                          value={sortBy}
                          onChange={e => { setSortBy(e.target.value as SortBy); setPage(1) }}
                          className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 text-sm font-medium text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white appearance-none cursor-pointer"
                        >
                          {SORT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                          <ChevronDownIcon />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Showing {rangeStart}–{rangeEnd} of {total.toLocaleString()}
                    </p>
                  </div>

                  <ActiveFilterChips
                    filters={filters}
                    sortBy={sortBy}
                    onRemoveFilter={next => { setFilters(next); setPage(1) }}
                    onRemoveSort={() => { setSortBy('relevance'); setPage(1) }}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {jobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onSelect={setSelectedJob}
                        saved={savedIds.has(job.id)}
                        onSave={toggleSaved}
                      />
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
        <div onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-navy-950/40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div className={[
          'absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto',
          'transition-transform duration-300 ease-out',
          drawerOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-navy-950">Filters</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close filters"
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:bg-slate-100 transition-colors">
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
        <div onClick={() => setSelectedJob(null)}
          className={`absolute inset-0 bg-navy-950/40 transition-opacity duration-300 ${selectedJob ? 'opacity-100' : 'opacity-0'}`}
        />
        <div className={[
          'absolute top-0 right-0 h-full w-full md:w-[560px] bg-white shadow-2xl flex flex-col',
          'transition-transform duration-300 ease-out',
          selectedJob ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}>
          {displayedJob && (
            <DetailPanelContent
              job={displayedJob}
              onClose={() => setSelectedJob(null)}
              saved={savedIds.has(displayedJob.id)}
              onSave={toggleSaved}
            />
          )}
        </div>
      </div>
    </main>
  )
}
