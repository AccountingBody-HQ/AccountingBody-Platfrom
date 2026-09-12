'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Job, EmploymentType, SeniorityLevel } from '@/lib/jobs'
import {
  EMPLOYMENT_TYPE_LABELS,
  SENIORITY_LABELS,
  employmentTypeLabel,
  seniorityLabel,
  formatSalary,
  formatRelativeDate,
} from '@/lib/job-format'
import {
  parseListingsUrlState,
  buildListingsSearchString,
  EMPTY_FILTERS,
  DEFAULT_SORT,
  DEFAULT_PAGE,
  POSTED_DAYS,
  type Filters,
  type PostedWithin,
  type SortBy,
  type ListingsUrlState,
} from './urlState'

interface DirectJobsResponse {
  jobs?: Job[]
  total?: number
}

const PAGE_SIZE = 24

const QUALIFICATIONS = ['ACCA', 'CIMA', 'ICAEW', 'CPA', 'AAT', 'CFA'] as const

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string }[] = (
  Object.entries(SENIORITY_LABELS) as [SeniorityLevel, string][]
).map(([value, label]) => ({ value, label }))

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = (
  Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]
).map(([value, label]) => ({ value, label }))

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

// ── Utilities ─────────────────────────────────────────────────────────────

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

function isNewJob(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
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
    <div className="py-4 border-b border-slate-100 last:border-b-0">
      <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94a3b8', letterSpacing: '0.08em' }}>{title}</h3>
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
          <span className="text-sm" style={{ color: '#334155' }}>Remote only</span>
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

function JobCard({ job, saved, onSave }: {
  job: Job
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
      className={[
        'group relative bg-white rounded-2xl p-5 flex flex-col transition-all duration-200',
        'border border-slate-100 shadow-sm',
        isEmployer ? 'hover:shadow-lg hover:border-gold-200' : 'hover:shadow-md hover:border-slate-200',
      ].join(' ')}
    >
      {/*
        Stretched-link overlay: this is the card's ONLY navigational
        element, and the only element with an href. It's absolutely
        positioned over the whole card (z-0, below the bookmark button's
        z-10) so the entire surface — not just the title text — is the
        tap target. It carries its own accessible name via aria-label
        since the visible title text below it is now plain, unlinked
        text; a screen reader on this element hears "Job Title at
        Company", not the whole card's badges/excerpt/footer.
      */}
      <Link
        href={`/jobs/${job.slug}`}
        aria-label={`${job.title} at ${job.company_name}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      />

      {/* Header: avatar + title + bookmark */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold ${avatarColor}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-medium text-navy-950 leading-snug line-clamp-2 group-hover:text-navy-700 transition-colors">
              {job.title}
            </h3>
            <button
              type="button"
              onClick={() => onSave(job.id)}
              aria-label={saved ? 'Unsave job' : 'Save job'}
              className={`relative z-10 shrink-0 p-1.5 rounded-lg transition-colors mt-0.5 ${saved ? 'text-gold-500 bg-gold-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
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
      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
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
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#f8f7f4' }}>
        <svg className="w-8 h-8" style={{ color: '#cbd5e1' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
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

// ── Main component ────────────────────────────────────────────────────────

export default function JobListingsClient({ isEthioTax }: { isEthioTax: boolean }) {
  const platform = isEthioTax ? 'et' : 'ab'

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Single source of truth, derived fresh from the URL on every render —
  // never mirrored into useState. navigateToState() (below) is the only
  // write path, via router.replace(); fetchJobs() is a pure reader of this
  // value and never writes back to the URL itself — a one-way flow with
  // nothing for the two to ping-pong through. useSearchParams() only
  // changes identity when the URL actually changes, so this useMemo only
  // recomputes then, not on every unrelated re-render (e.g. `loading`
  // flipping) — that stability is what keeps fetchJobs's own dependency
  // array (below) from re-firing when nothing about the requested view
  // has changed.
  const urlState = useMemo(() => parseListingsUrlState(searchParams), [searchParams])
  const { search: activeSearch, location: activeLocation, filters, sortBy, page } = urlState

  function navigateToState(next: ListingsUrlState) {
    router.replace(pathname + buildListingsSearchString(next), { scroll: false })
  }

  const [showAlert, setShowAlert] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)

  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)

  const { savedIds, toggleSaved } = useSavedJobs()

  const abortRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  // The page `total`/`jobs` actually belong to — not `page` itself, which is
  // read fresh from the URL every render and updates as soon as
  // router.replace() takes effect, before the fetch for it resolves. Using
  // the URL-fresh `page` to compute "Showing X-Y of Z" against a `total`
  // that still belongs to the previous fetch mixes two points in time in
  // one line; this ref keeps the count math pinned to whichever fetch
  // `total`/`jobs` last actually completed.
  const confirmedPageRef = useRef(page)

  // Lets /jobs/[slug]'s "Back to all jobs" link tell whether router.back()
  // has a listings page to land on — document.referrer can't answer that
  // for a same-tab SPA transition (see BackToListingsLink.tsx).
  useEffect(() => { try { sessionStorage.setItem('ab_visited_listings', '1') } catch {} }, [])

  useEffect(() => { document.body.style.overflow = drawerOpen ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [drawerOpen])
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (drawerOpen) setDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

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
      confirmedPageRef.current = page
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Could not load jobs right now. Please try again.')
      setJobs([])
      setTotal(0)
      confirmedPageRef.current = page
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }, [platform, activeSearch, activeLocation, filters, sortBy, page])

  useEffect(() => { fetchJobs(); return () => abortRef.current?.abort() }, [fetchJobs])

  // ── Scroll restoration ──────────────────────────────────────────────
  // Content is fetched client-side after mount, so the browser's own
  // automatic restoration on Back/Forward (history.scrollRestoration =
  // 'auto', the default) will very often fire before that fetch resolves —
  // against a shorter, skeleton-only page than the one the user actually
  // scrolled on. Take manual control instead: capture scroll position
  // continuously, keyed by the full URL it belongs to, and restore it
  // once per URL after real content has rendered. Reset back to 'auto' on
  // unmount so this doesn't change scroll behaviour on the rest of the
  // site for the remainder of the session.
  useEffect(() => {
    const original = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = original }
  }, [])

  const scrollKeyRef = useRef('')
  const restoredKeyRef = useRef('')

  useEffect(() => {
    scrollKeyRef.current = `jobs-listings-scroll:${pathname}${buildListingsSearchString(urlState)}`
  }, [pathname, urlState])

  useEffect(() => {
    function handleScroll() {
      try { sessionStorage.setItem(scrollKeyRef.current, String(window.scrollY)) } catch {}
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (loading) return
    const key = scrollKeyRef.current
    if (restoredKeyRef.current === key) return
    restoredKeyRef.current = key
    let saved: string | null = null
    try { saved = sessionStorage.getItem(key) } catch {}
    if (saved) window.scrollTo(0, parseInt(saved, 10))
  }, [loading])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activeFilterCount = countActiveFilters(filters)
  const isFirstLoad = loading && jobs.length === 0

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleFiltersChange(next: Filters) { navigateToState({ ...urlState, filters: next, page: DEFAULT_PAGE }) }
  function handleClearFilters() { navigateToState({ ...urlState, filters: EMPTY_FILTERS, sortBy: DEFAULT_SORT, page: DEFAULT_PAGE }) }
  function handlePageChange(next: number) { navigateToState({ ...urlState, page: next }); scrollToResults() }

  const displayedPage = confirmedPageRef.current
  const rangeStart = total === 0 ? 0 : (displayedPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(displayedPage * PAGE_SIZE, total)

  return (
    <main className="min-h-screen bg-slate-50">
      {/* MOBILE FILTER TRIGGER */}
      <div className="lg:hidden container-wide pt-5">
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

      <div className="container-wide pt-4 pb-12" ref={resultsRef} style={{ scrollMarginTop: '2rem' }}>
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
                          onChange={e => navigateToState({ ...urlState, sortBy: e.target.value as SortBy, page: DEFAULT_PAGE })}
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
                    onRemoveFilter={next => navigateToState({ ...urlState, filters: next, page: DEFAULT_PAGE })}
                    onRemoveSort={() => navigateToState({ ...urlState, sortBy: DEFAULT_SORT, page: DEFAULT_PAGE })}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {jobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
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
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors" style={{ color: '#475569' }}>
              <CloseIcon />
            </button>
          </div>
          <div className="px-5 pb-6">
            <FiltersPanel filters={filters} onChange={handleFiltersChange} onClear={handleClearFilters} />
          </div>
        </div>
      </div>
    </main>
  )
}
