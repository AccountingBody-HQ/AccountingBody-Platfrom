'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { formatSalary, formatRelativeDate, getCompanyInitials, getCompanyColor } from '@/lib/job-format'
import { formatJobLocation } from '@/app/jobs/listings/jobLocation'
import { savedJobsErrorMessage } from '@/lib/saved-jobs'
import type { SavedJobJoinedRow } from '@/lib/saved-jobs-store'
import { runLegacyImportIfPresent } from './useSavedJobs'

// The API never includes `status` in a saved-job's `job` object (it's used
// server-side only, to compute `available` — see app/api/saved-jobs/route.ts).
// salary_currency is narrowed to `string` (not `string | null`) to match
// lib/jobs.ts's own Job type for the identical column — required so this
// can pass straight into the shared formatSalary() below.
type SavedJobCard = Omit<SavedJobJoinedRow, 'status' | 'salary_currency'> & { salary_currency: string }

interface SavedJobEntry {
  savedAt: string
  available: boolean
  job: SavedJobCard
}

type LoadState = 'loading' | 'error' | 'loaded'

const ERROR_CLEAR_MS = 5000

function SavedJobRowSkeleton() {
  return (
    <li className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-1/3 mb-3" />
        <div className="h-8 bg-slate-100 rounded w-1/4" />
      </div>
    </li>
  )
}

function SavedJobRow({ entry, removing, onRemove }: {
  entry: SavedJobEntry
  removing: boolean
  onRemove: (jobId: string) => void
}) {
  const { job, available, savedAt } = entry
  const salary = formatSalary(job)
  const initials = getCompanyInitials(job.company_name)
  const avatarColor = getCompanyColor(job.company_name)

  return (
    <li className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3 ${available ? '' : 'opacity-60'}`}>
      <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold ${avatarColor}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/jobs/${job.slug}`}
            className="font-display text-base font-medium text-navy-950 hover:text-navy-700 transition-colors line-clamp-2"
          >
            {job.title}
          </Link>
          {!available && (
            <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              No longer available
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">{job.company_name}</p>
        <p className="text-xs text-slate-500 mt-1">
          {formatJobLocation(job.location_text, job.location_country)}
        </p>

        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="min-w-0">
            {salary ? (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap bg-gold-50 text-gold-600 border border-gold-200">
                {salary}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Salary not listed</span>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5">Saved {formatRelativeDate(savedAt)}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(job.id)}
            disabled={removing}
            aria-busy={removing}
            className="shrink-0 h-9 px-4 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </li>
  )
}

export default function SavedJobsClient() {
  const [state, setState] = useState<LoadState>('loading')
  const [entries, setEntries] = useState<SavedJobEntry[]>([])
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [rowError, setRowError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const rowErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState('loading')
      await runLegacyImportIfPresent()
      try {
        const res = await fetch('/api/saved-jobs', { cache: 'no-store' })
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        if (!cancelled) {
          setEntries(Array.isArray(data.jobs) ? data.jobs : [])
          setState('loaded')
        }
      } catch {
        if (!cancelled) setState('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [reloadToken])

  useEffect(() => () => {
    if (rowErrorTimerRef.current) clearTimeout(rowErrorTimerRef.current)
  }, [])

  function showRowError(message: string) {
    setRowError(message)
    if (rowErrorTimerRef.current) clearTimeout(rowErrorTimerRef.current)
    rowErrorTimerRef.current = setTimeout(() => setRowError(null), ERROR_CLEAR_MS)
  }

  const removingIdsRef = useRef(removingIds)
  removingIdsRef.current = removingIds

  const handleRemove = useCallback(async (jobId: string) => {
    if (removingIdsRef.current.has(jobId)) return
    setRemovingIds(prev => new Set(prev).add(jobId))

    // Stashed so a failed delete can restore this exact row, in its
    // original position, instead of a full reload (which would flash a
    // loading state and briefly hide every other row too).
    let removedEntry: SavedJobEntry | undefined
    let removedIndex = -1
    setEntries(prevEntries => {
      const idx = prevEntries.findIndex(e => e.job.id === jobId)
      if (idx === -1) return prevEntries
      removedIndex = idx
      removedEntry = prevEntries[idx]
      return prevEntries.filter(e => e.job.id !== jobId)
    })

    function restore() {
      if (!removedEntry) return
      setEntries(prevEntries => {
        const next = [...prevEntries]
        next.splice(Math.min(removedIndex, next.length), 0, removedEntry as SavedJobEntry)
        return next
      })
    }

    try {
      const res = await fetch('/api/saved-jobs', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (!res.ok) {
        restore()
        showRowError(savedJobsErrorMessage(res.status))
      } else {
        setRowError(null)
      }
    } catch {
      restore()
      showRowError(savedJobsErrorMessage(0))
    } finally {
      setRemovingIds(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    }
  }, [])

  if (state === 'loading') {
    return (
      <ul className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => <SavedJobRowSkeleton key={i} />)}
      </ul>
    )
  }

  if (state === 'error') {
    return (
      <div role="alert" className="text-center py-16 border border-slate-200 rounded-2xl bg-white">
        <p className="text-navy-950 font-semibold mb-1">Something went wrong</p>
        <p className="text-sm text-slate-500 mb-4">We couldn&apos;t load your saved jobs. Please try again.</p>
        <button
          type="button"
          onClick={() => setReloadToken(t => t + 1)}
          className="h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-20 border border-slate-200 rounded-2xl bg-white">
        <p className="text-navy-950 font-semibold text-lg mb-1">You haven&apos;t saved any jobs yet.</p>
        <Link
          href="/jobs/listings"
          className="inline-flex items-center justify-center h-11 px-6 mt-4 rounded-lg border border-navy-950 text-navy-950 text-sm font-semibold hover:bg-navy-950 hover:text-white transition-colors"
        >
          Browse jobs
        </Link>
      </div>
    )
  }

  return (
    <div>
      {rowError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          {rowError}
        </p>
      )}
      <ul className="space-y-3">
        {entries.map(entry => (
          <SavedJobRow
            key={entry.job.id}
            entry={entry}
            removing={removingIds.has(entry.job.id)}
            onRemove={handleRemove}
          />
        ))}
      </ul>
    </div>
  )
}
