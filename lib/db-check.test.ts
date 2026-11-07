import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRead } from './db-check'

let logged: unknown[][] = []

beforeEach(() => {
  logged = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkRead', () => {
  it('passes through the rows of a read that worked', () => {
    const result = checkRead({ data: [{ id: 'a' }], error: null }, 'test')
    expect(result).toEqual({ ok: true, data: [{ id: 'a' }], count: null })
    expect(logged).toEqual([])
  })

  it('passes through a single row and a count', () => {
    expect(checkRead({ data: { id: 'a' }, error: null, count: 4 }, 'test')).toEqual({
      ok: true,
      data: { id: 'a' },
      count: 4,
    })
  })

  it('treats a read that found nothing as a working read', () => {
    expect(checkRead({ data: null, error: null }, 'test')).toEqual({ ok: true, data: null, count: null })
    expect(checkRead({ data: [], error: null }, 'test')).toEqual({ ok: true, data: [], count: null })
    expect(checkRead({ data: null, error: null, count: 0 }, 'test')).toEqual({ ok: true, data: null, count: 0 })
    expect(logged).toEqual([])
  })

  it('reports a failed read and logs it under its label', () => {
    const error = { message: 'connection reset', code: '08006' }
    const result = checkRead({ data: null, error }, 'course save: existing course')
    expect(result).toEqual({ ok: false, error })
    expect(logged).toEqual([['course save: existing course read failed:', error]])
  })

  it('reports a failed count read even when its message is empty', () => {
    expect(checkRead({ data: null, error: { message: '' }, count: null }, 'test')).toEqual({
      ok: false,
      error: { message: '' },
    })
  })

  it('reports a read that reached its time limit', () => {
    const error = { message: 'TimeoutError: db: request time limit reached (20000 ms)', code: '' }
    expect(checkRead({ data: null, error }, 'test').ok).toBe(false)
  })

  it('reports the "no rows" code as a failure unless the caller treats it as nothing found', () => {
    const error = { message: 'no rows', code: 'PGRST116', details: 'The result contains 0 rows' }
    expect(checkRead({ data: null, error }, 'test')).toEqual({ ok: false, error })
    expect(checkRead({ data: null, error }, 'test', { noRowsIsEmpty: true })).toEqual({
      ok: true,
      data: null,
      count: null,
    })
  })

  it('still reports other errors when "no rows" is treated as nothing found', () => {
    const error = { message: 'permission denied', code: '42501' }
    expect(checkRead({ data: null, error }, 'test', { noRowsIsEmpty: true })).toEqual({ ok: false, error })
  })
})
