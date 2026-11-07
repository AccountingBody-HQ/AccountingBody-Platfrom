import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  guardCachedRead, resetCacheGuard, cacheGuardSize, cacheGuardKey,
  HOLD_MS, BACKOFF_MS, MAX_KEYS, MAX_LAST_GOOD_AGE_MS, LAST_GOOD_VALUE_LOG,
} from './cache-guard'

// A scripted stand-in for the function unstable_cache returns: each call
// takes the next scripted outcome and records its arguments.
type Outcome = { value: unknown } | { error: Error } | { pending: true }
function scripted(outcomes: Outcome[]) {
  const calls: unknown[][] = []
  const pending: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []
  const read = vi.fn(async (...args: unknown[]) => {
    calls.push(args)
    const next = outcomes.shift() ?? { value: 'default' }
    if ('pending' in next) {
      return new Promise((resolve, reject) => pending.push({ resolve, reject }))
    }
    if ('error' in next) throw next.error
    return next.value
  })
  return { read, calls, pending }
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('guardCachedRead — settings', () => {
  it('uses the documented constants', () => {
    expect(HOLD_MS).toBe(30_000)
    expect(BACKOFF_MS).toBe(30_000)
    expect(MAX_KEYS).toBe(500)
    expect(MAX_LAST_GOOD_AGE_MS).toBe(24 * 60 * 60 * 1000)
  })
})

describe('guardCachedRead — one refresh at a time', () => {
  it('runs one refresh for many concurrent callers and gives each the same value', async () => {
    const { read, pending } = scripted([{ pending: true }])
    const guarded = guardCachedRead(['reader'], read)

    const callers = Array.from({ length: 25 }, () => guarded('x'))
    expect(read).toHaveBeenCalledTimes(1)
    pending[0].resolve({ n: 1 })

    const results = await Promise.all(callers)
    expect(results).toEqual(Array.from({ length: 25 }, () => ({ n: 1 })))
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('gives every concurrent caller the same error when the refresh fails with no earlier value', async () => {
    const { read, pending } = scripted([{ pending: true }])
    const guarded = guardCachedRead(['reader'], read)

    const callers = Array.from({ length: 5 }, () => guarded('x').catch((e: Error) => e.message))
    pending[0].reject(new Error('boom'))
    expect(await Promise.all(callers)).toEqual(['boom', 'boom', 'boom', 'boom', 'boom'])
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('guardCachedRead — values', () => {
  it('returns the value unchanged, including null, 0 and empty lists', async () => {
    for (const value of [null, 0, [], { a: [1, 2], b: 'x' }, 'text']) {
      resetCacheGuard()
      const { read } = scripted([{ value }])
      expect(await guardCachedRead(['reader'], read)('x')).toEqual(value)
    }
  })

  it('passes the arguments through unchanged', async () => {
    const { read, calls } = scripted([{ value: 1 }])
    await guardCachedRead(['reader'], read)('ab', { limit: 20 })
    expect(calls).toEqual([['ab', { limit: 20 }]])
  })

  it('gives each caller its own copy, so one caller cannot change what another sees', async () => {
    const { read } = scripted([{ value: { list: [1] } }])
    const guarded = guardCachedRead(['reader'], read)

    const first = (await guarded('x')) as { list: number[] }
    first.list.push(2)
    expect(await guarded('x')).toEqual({ list: [1] })
  })
})

describe('guardCachedRead — hold after a good refresh', () => {
  it('does not call again within HOLD_MS', async () => {
    const { read } = scripted([{ value: 1 }, { value: 2 }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded('x')).toBe(1)
    vi.advanceTimersByTime(HOLD_MS - 1)
    expect(await guarded('x')).toBe(1)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('refreshes on the next call once HOLD_MS has passed', async () => {
    const { read } = scripted([{ value: 1 }, { value: 2 }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded('x')).toBe(1)
    vi.advanceTimersByTime(HOLD_MS)
    expect(await guarded('x')).toBe(2)
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('guardCachedRead — last good value', () => {
  it('returns the last good value when a refresh fails, and logs one fixed line', async () => {
    const { read } = scripted([{ value: 7 }, { error: new Error('db down') }])
    const guarded = guardCachedRead(['countReader', 'part'], read)

    expect(await guarded()).toBe(7)
    vi.advanceTimersByTime(HOLD_MS)
    expect(await guarded()).toBe(7)
    expect(read).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(`${LAST_GOOD_VALUE_LOG} (countReader)`)
  })

  it('rethrows the error when there is no earlier value', async () => {
    const { read } = scripted([{ error: new Error('db down') }])
    await expect(guardCachedRead(['reader'], read)('x')).rejects.toThrow('db down')
    expect(warn).not.toHaveBeenCalled()
  })

  it('stops serving a last good value older than MAX_LAST_GOOD_AGE_MS and rethrows instead', async () => {
    const { read } = scripted([{ value: 7 }, { error: new Error('late failure') }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded()).toBe(7)
    vi.advanceTimersByTime(MAX_LAST_GOOD_AGE_MS + 1)
    await expect(guarded()).rejects.toThrow('late failure')
  })

  it('still serves a last good value exactly MAX_LAST_GOOD_AGE_MS old', async () => {
    const { read } = scripted([{ value: 7 }, { error: new Error('failure') }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded()).toBe(7)
    vi.advanceTimersByTime(MAX_LAST_GOOD_AGE_MS)
    expect(await guarded()).toBe(7)
  })

  it('stops serving the last good value during the pause once it passes MAX_LAST_GOOD_AGE_MS', async () => {
    const { read } = scripted([{ value: 7 }, { error: new Error('failure') }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded()).toBe(7)
    vi.advanceTimersByTime(MAX_LAST_GOOD_AGE_MS - 1)
    expect(await guarded()).toBe(7)
    vi.advanceTimersByTime(2)
    await expect(guarded()).rejects.toThrow('failure')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('serves a fresh value again after a later refresh succeeds', async () => {
    const { read } = scripted([{ value: 1 }, { error: new Error('down') }, { value: 3 }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded()).toBe(1)
    vi.advanceTimersByTime(HOLD_MS)
    expect(await guarded()).toBe(1)
    vi.advanceTimersByTime(BACKOFF_MS)
    expect(await guarded()).toBe(3)
  })
})

describe('guardCachedRead — pause after a failed refresh', () => {
  it('does not refresh within BACKOFF_MS and rethrows the saved error when there is no value', async () => {
    const { read } = scripted([{ error: new Error('first') }, { value: 'ok' }])
    const guarded = guardCachedRead(['reader'], read)

    await expect(guarded('x')).rejects.toThrow('first')
    vi.advanceTimersByTime(BACKOFF_MS - 1)
    await expect(guarded('x')).rejects.toThrow('first')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('does not refresh within BACKOFF_MS and keeps serving the last good value', async () => {
    const { read } = scripted([{ value: 5 }, { error: new Error('down') }, { value: 6 }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded()).toBe(5)
    vi.advanceTimersByTime(HOLD_MS)
    expect(await guarded()).toBe(5)
    vi.advanceTimersByTime(BACKOFF_MS - 1)
    expect(await guarded()).toBe(5)
    expect(read).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('refreshes again once BACKOFF_MS has passed', async () => {
    const { read } = scripted([{ error: new Error('first') }, { value: 'ok' }])
    const guarded = guardCachedRead(['reader'], read)

    await expect(guarded('x')).rejects.toThrow('first')
    vi.advanceTimersByTime(BACKOFF_MS)
    expect(await guarded('x')).toBe('ok')
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('guardCachedRead — keys', () => {
  it('keeps different arguments in different entries', async () => {
    const { read } = scripted([{ value: 'ab' }, { value: 'et' }])
    const guarded = guardCachedRead(['reader'], read)

    expect(await guarded('ab')).toBe('ab')
    expect(await guarded('et')).toBe('et')
    expect(await guarded('ab')).toBe('ab')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps readers with different key parts apart even for the same arguments', async () => {
    const a = guardCachedRead(['readerA'], scripted([{ value: 'A' }]).read)
    const b = guardCachedRead(['readerB'], scripted([{ value: 'B' }]).read)

    expect(await a('x')).toBe('A')
    expect(await b('x')).toBe('B')
  })

  it('builds keys that cannot be confused by commas or nesting', () => {
    expect(cacheGuardKey(['a,b'], [])).not.toBe(cacheGuardKey(['a', 'b'], []))
    expect(cacheGuardKey(['a'], ['b'])).not.toBe(cacheGuardKey(['a', 'b'], []))
    expect(cacheGuardKey(['a'], [{ x: 1 }])).not.toBe(cacheGuardKey(['a'], [{ x: 2 }]))
    expect(cacheGuardKey(['a'], ['1'])).not.toBe(cacheGuardKey(['a'], [1]))
    expect(cacheGuardKey(['a'], [{ x: 1 }])).toBe(cacheGuardKey(['a'], [{ x: 1 }]))
  })
})

describe('guardCachedRead — memory bound', () => {
  it('keeps at most MAX_KEYS keys, removing the oldest first', async () => {
    const read = vi.fn(async (n: number) => n)
    const guarded = guardCachedRead(['reader'], read)

    for (let i = 0; i < MAX_KEYS + 50; i++) await guarded(i)
    expect(cacheGuardSize()).toBe(MAX_KEYS)

    read.mockClear()
    await guarded(MAX_KEYS + 49) // newest: still held
    expect(read).not.toHaveBeenCalled()
    await guarded(0) // oldest: was removed, so it is read again
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('never removes a key whose refresh is running', async () => {
    let release: (v: string) => void = () => {}
    const slow = guardCachedRead(['slow'], () => new Promise<string>(resolve => { release = resolve }))
    const fast = guardCachedRead(['fast'], async (n: number) => n)

    const running = slow() // oldest key, refresh still running
    for (let i = 0; i < MAX_KEYS + 10; i++) await fast(i)
    expect(cacheGuardSize()).toBe(MAX_KEYS)

    // A second caller still joins the same running refresh.
    const joined = slow()
    release('done')
    expect(await running).toBe('done')
    expect(await joined).toBe('done')
  })

  it('does not drop a running refresh even when every key has one running', async () => {
    const releases: Array<() => void> = []
    const guarded = guardCachedRead(['reader'], (n: number) => new Promise<number>(resolve => releases.push(() => resolve(n))))

    const calls = Array.from({ length: MAX_KEYS + 3 }, (_, i) => guarded(i))
    expect(cacheGuardSize()).toBe(MAX_KEYS + 3)
    releases.forEach(r => r())
    expect(await Promise.all(calls)).toEqual(Array.from({ length: MAX_KEYS + 3 }, (_, i) => i))

    const next = guarded(-1)
    expect(cacheGuardSize()).toBeLessThanOrEqual(MAX_KEYS)
    releases[releases.length - 1]()
    expect(await next).toBe(-1)
  })
})
