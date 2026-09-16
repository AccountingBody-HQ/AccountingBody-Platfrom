import { describe, it, expect } from 'vitest'
import {
  isValidUuid,
  parseJobIdBody,
  parseImportBody,
  savedJobsCookieOptions,
  isJobAvailable,
  checkSavedJobsRateLimit,
  SAVED_JOBS_LIMIT,
  SAVED_JOBS_MAX_AGE_SECONDS,
} from './saved-jobs'

const VALID_UUID = '00000000-0000-4000-8000-000000000000'
const VALID_UUID_2 = '11111111-1111-4111-8111-111111111111'

describe('isValidUuid', () => {
  it('accepts a well-formed v4 uuid', () => {
    expect(isValidUuid(VALID_UUID)).toBe(true)
  })

  it('rejects garbage strings', () => {
    expect(isValidUuid('nope')).toBe(false)
    expect(isValidUuid('')).toBe(false)
    expect(isValidUuid('00000000-0000-0000-0000-000000000000')).toBe(false) // version 0, not v4
  })

  it('rejects non-string values', () => {
    expect(isValidUuid(undefined)).toBe(false)
    expect(isValidUuid(null)).toBe(false)
    expect(isValidUuid(42)).toBe(false)
    expect(isValidUuid({})).toBe(false)
    expect(isValidUuid(['x'])).toBe(false)
  })

  it('rejects a uuid with the wrong variant nibble', () => {
    // version nibble is 4 (correct) but variant nibble is 0, not 8/9/a/b
    expect(isValidUuid('00000000-0000-4000-0000-000000000000')).toBe(false)
  })
})

describe('parseJobIdBody', () => {
  it('extracts a valid jobId', () => {
    expect(parseJobIdBody({ jobId: VALID_UUID })).toBe(VALID_UUID)
  })

  it('returns null for a garbage jobId', () => {
    expect(parseJobIdBody({ jobId: 'nope' })).toBeNull()
  })

  it('returns null for non-object bodies', () => {
    expect(parseJobIdBody(null)).toBeNull()
    expect(parseJobIdBody(undefined)).toBeNull()
    expect(parseJobIdBody('string')).toBeNull()
    expect(parseJobIdBody(42)).toBeNull()
    expect(parseJobIdBody([])).toBeNull()
  })

  it('returns null when jobId is missing', () => {
    expect(parseJobIdBody({})).toBeNull()
  })
})

describe('parseImportBody', () => {
  it('returns null when not an array', () => {
    expect(parseImportBody({ jobIds: 'not-an-array' })).toBeNull()
    expect(parseImportBody({})).toBeNull()
    expect(parseImportBody(null)).toBeNull()
    expect(parseImportBody('string')).toBeNull()
  })

  it('de-duplicates repeated ids', () => {
    const result = parseImportBody({ jobIds: [VALID_UUID, VALID_UUID, VALID_UUID_2] })
    expect(result).toEqual([VALID_UUID, VALID_UUID_2])
  })

  it('filters out invalid uuids, keeping only valid ones', () => {
    const result = parseImportBody({ jobIds: [VALID_UUID, 'garbage', 123, null, VALID_UUID_2] })
    expect(result).toEqual([VALID_UUID, VALID_UUID_2])
  })

  it('caps the result at SAVED_JOBS_LIMIT', () => {
    const many = Array.from({ length: SAVED_JOBS_LIMIT + 50 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    )
    const result = parseImportBody({ jobIds: many })
    expect(result).not.toBeNull()
    expect(result!.length).toBe(SAVED_JOBS_LIMIT)
  })

  it('returns an empty array for an empty input array', () => {
    expect(parseImportBody({ jobIds: [] })).toEqual([])
  })
})

describe('savedJobsCookieOptions', () => {
  it('returns exactly the specified cookie attributes', () => {
    expect(savedJobsCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SAVED_JOBS_MAX_AGE_SECONDS,
    })
  })

  it('maxAge is exactly 604800 seconds (7 days)', () => {
    expect(savedJobsCookieOptions().maxAge).toBe(604800)
  })
})

describe('isJobAvailable', () => {
  const now = new Date('2026-09-16T00:00:00.000Z')

  it('is available when active with no expiry', () => {
    expect(isJobAvailable({ status: 'active', expires_at: null }, now)).toBe(true)
  })

  it('is available when active with a future expiry', () => {
    expect(isJobAvailable({ status: 'active', expires_at: '2026-09-20T00:00:00.000Z' }, now)).toBe(true)
  })

  it('is unavailable when active but expired by date', () => {
    expect(isJobAvailable({ status: 'active', expires_at: '2026-09-01T00:00:00.000Z' }, now)).toBe(false)
  })

  it('is unavailable when status is not active, even with no expiry', () => {
    expect(isJobAvailable({ status: 'expired', expires_at: null }, now)).toBe(false)
    expect(isJobAvailable({ status: 'closed', expires_at: null }, now)).toBe(false)
    expect(isJobAvailable({ status: 'draft', expires_at: null }, now)).toBe(false)
  })

  it('is unavailable when status is not active and expiry is in the future', () => {
    expect(isJobAvailable({ status: 'closed', expires_at: '2026-09-20T00:00:00.000Z' }, now)).toBe(false)
  })
})

describe('checkSavedJobsRateLimit', () => {
  it('allows requests under the limit', () => {
    const key = 'ip-under-limit'
    for (let i = 0; i < 30; i++) {
      expect(checkSavedJobsRateLimit(key, 1_000)).toBe(true)
    }
  })

  it('blocks the request that exceeds the limit within the window', () => {
    const key = 'ip-over-limit'
    for (let i = 0; i < 30; i++) {
      expect(checkSavedJobsRateLimit(key, 1_000)).toBe(true)
    }
    expect(checkSavedJobsRateLimit(key, 1_500)).toBe(false)
  })

  it('resets after the window elapses', () => {
    const key = 'ip-window-reset'
    for (let i = 0; i < 30; i++) {
      checkSavedJobsRateLimit(key, 0)
    }
    expect(checkSavedJobsRateLimit(key, 0)).toBe(false)
    // 60_000ms window — a request just after it elapses gets a fresh count
    expect(checkSavedJobsRateLimit(key, 60_001)).toBe(true)
  })

  it('tracks separate keys independently', () => {
    const keyA = 'ip-a'
    const keyB = 'ip-b'
    for (let i = 0; i < 30; i++) checkSavedJobsRateLimit(keyA, 2_000)
    expect(checkSavedJobsRateLimit(keyA, 2_100)).toBe(false)
    expect(checkSavedJobsRateLimit(keyB, 2_100)).toBe(true)
  })
})
