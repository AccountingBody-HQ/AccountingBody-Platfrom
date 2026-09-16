'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseStoredSavedJobIds, savedJobsErrorMessage } from '@/lib/saved-jobs'

const ERROR_CLEAR_MS = 5000

// One-time migration of the pre-Step-2 localStorage saves (key
// 'ab_saved_jobs', a JSON array of job uuids — see the old useSavedJobs()
// this file replaces, formerly in JobListingsClient.tsx) into the
// server-side table. Shared by this hook's own mount effect and by
// SavedJobsClient.tsx (the /jobs/saved page needs the same one-time import
// to run before its first full fetch) so the read/import/remove sequence
// lives in exactly one place. Idempotent: once the import succeeds and the
// key is removed, every later call is a no-op read that returns
// immediately. On any failure (non-2xx or network error) the localStorage
// value is deliberately left in place so a later visit retries — never
// silently drops a visitor's pre-existing saves.
export async function runLegacyImportIfPresent(): Promise<void> {
  let raw: string | null = null
  try {
    raw = localStorage.getItem('ab_saved_jobs')
  } catch {
    return
  }

  const legacyIds = parseStoredSavedJobIds(raw)
  if (legacyIds.length === 0) return

  try {
    const res = await fetch('/api/saved-jobs/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobIds: legacyIds }),
    })
    if (res.ok) {
      try {
        localStorage.removeItem('ab_saved_jobs')
      } catch {
        // Import already succeeded server-side; a later visit will just
        // re-attempt the same (now no-op, since the ids are already saved)
        // import instead of losing anything.
      }
    }
  } catch {
    // Network error — leave localStorage untouched, retry next visit.
  }
}

// Server-backed replacement for the old localStorage-only useSavedJobs().
// Powers the Save button's state across the listings pages — button state
// only, not the full saved-job records (see SavedJobsClient.tsx for the
// /jobs/saved page's own fetch of the full list).
export function useSavedJobs() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors savedIds/pending without forcing toggle() to change identity
  // every time either one updates — toggle reads the latest values through
  // these refs instead of closing over stale state.
  const savedIdsRef = useRef(savedIds)
  const pendingRef = useRef(pending)
  savedIdsRef.current = savedIds
  pendingRef.current = pending

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }, [])

  const showError = useCallback((message: string) => {
    setError(message)
    clearErrorTimer()
    errorTimerRef.current = setTimeout(() => setError(null), ERROR_CLEAR_MS)
  }, [clearErrorTimer])

  useEffect(() => {
    let cancelled = false

    async function load() {
      await runLegacyImportIfPresent()
      try {
        const res = await fetch('/api/saved-jobs?view=ids', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && Array.isArray(data.jobIds)) {
            setSavedIds(new Set(data.jobIds))
          }
        }
        // A failed load leaves the set empty — buttons still work, they
        // just start from "nothing saved" until the next successful load.
      } catch {
        // Network error — same fallback as a non-2xx response above.
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => clearErrorTimer, [clearErrorTimer])

  const toggle = useCallback(async (jobId: string) => {
    if (pendingRef.current.has(jobId)) return
    const wasSaved = savedIdsRef.current.has(jobId)

    setPending(prev => new Set(prev).add(jobId))
    setSavedIds(prev => {
      const next = new Set(prev)
      if (wasSaved) next.delete(jobId)
      else next.add(jobId)
      return next
    })

    function revert() {
      setSavedIds(prev => {
        const next = new Set(prev)
        if (wasSaved) next.add(jobId)
        else next.delete(jobId)
        return next
      })
    }

    try {
      const res = await fetch('/api/saved-jobs', {
        method: wasSaved ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (res.ok) {
        clearErrorTimer()
        setError(null)
      } else {
        revert()
        showError(savedJobsErrorMessage(res.status))
      }
    } catch {
      revert()
      showError(savedJobsErrorMessage(0))
    } finally {
      setPending(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    }
  }, [clearErrorTimer, showError])

  return { savedIds, ready, pending, error, toggle }
}
