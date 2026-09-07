import type { NormalisedJob } from './normalise'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ── Dedup hash ────────────────────────────────────────────────────────────
// SHA-256 of normalised title + company + location.
// Matches the existing dedup_hash pattern already in the jobs table.

export async function computeDedupHash(
  title: string,
  companyName: string,
  locationText: string
): Promise<string> {
  const input = `${title}|${companyName}|${locationText}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Deduplication result ──────────────────────────────────────────────────
export interface DeduplicationResult {
  toInsert: (NormalisedJob & { dedup_hash: string })[]
  duplicateCount: number
  duplicateHashes: string[]
}

// ── Main deduplication function ────────────────────────────────────────────
// Takes normalised jobs, computes hashes, checks against DB, returns only new ones.

export async function deduplicate(
  jobs: NormalisedJob[]
): Promise<DeduplicationResult> {
  if (jobs.length === 0) {
    return { toInsert: [], duplicateCount: 0, duplicateHashes: [] }
  }

  // Compute hashes for all jobs
  const withHashes = await Promise.all(
    jobs.map(async job => ({
      ...job,
      dedup_hash: await computeDedupHash(job.title, job.company_name, job.location_text),
    }))
  )

  // Deduplicate within the current batch first (avoid inserting batch duplicates)
  const seenInBatch = new Set<string>()
  const uniqueInBatch = withHashes.filter(job => {
    if (seenInBatch.has(job.dedup_hash)) return false
    seenInBatch.add(job.dedup_hash)
    return true
  })

  // Check which hashes already exist in the DB
  const hashes = uniqueInBatch.map(j => j.dedup_hash)
  const supabase = getSupabase()
  const { data: existingRows } = await supabase
    .from('jobs')
    .select('dedup_hash')
    .in('dedup_hash', hashes)

  const existingHashes = new Set((existingRows ?? []).map(r => r.dedup_hash))

  const toInsert = uniqueInBatch.filter(j => !existingHashes.has(j.dedup_hash))
  const duplicateHashes = uniqueInBatch
    .filter(j => existingHashes.has(j.dedup_hash))
    .map(j => j.dedup_hash)

  // Total duplicates = DB duplicates + within-batch duplicates
  const batchDuplicates = withHashes.length - uniqueInBatch.length
  const duplicateCount = duplicateHashes.length + batchDuplicates

  return { toInsert, duplicateCount, duplicateHashes }
}
