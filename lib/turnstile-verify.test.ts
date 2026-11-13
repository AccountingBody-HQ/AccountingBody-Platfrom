import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SITEVERIFY_TIME_LIMIT_MS, SITEVERIFY_URL, verifyHumanCheck } from './turnstile-verify'
import { HUMAN_CHECK_FAILED_TEXT } from './message-rules'

type Call = { url: string; init: RequestInit | undefined }
let calls: Call[] = []

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function answerWith(answer: (init: RequestInit | undefined) => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      return answer(init)
    }),
  )
}

// Never answers; gives up only when the request is aborted.
function hangingFetch(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })
}

let logs: string[] = []

beforeEach(() => {
  calls = []
  logs = []
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret-et')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-secret-ab')
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
    })
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('person check on the server', () => {
  it('passes when Cloudflare confirms the token', async () => {
    answerWith(async () => json({ success: true, 'error-codes': [] }))
    expect(await verifyHumanCheck('token-1', '203.0.113.9', false, 'contact')).toEqual({ ok: true })
    expect(logs).toEqual([])
  })

  it('sends one request to Cloudflare with the token, the site secret and the address', async () => {
    answerWith(async () => json({ success: true }))
    await verifyHumanCheck('token-1', '203.0.113.9', false, 'contact')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(SITEVERIFY_URL)
    expect(calls[0].init?.method).toBe('POST')
    expect(new Headers(calls[0].init?.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      secret: 'test-secret-ab',
      response: 'token-1',
      remoteip: '203.0.113.9',
    })
  })

  it('uses the second site key secret for the second site', async () => {
    answerWith(async () => json({ success: true }))
    await verifyHumanCheck('token-1', '', true, 'contact')
    expect(JSON.parse(String(calls[0].init?.body)).secret).toBe('test-secret-et')
  })

  it('does not pass when Cloudflare reports failure codes', async () => {
    answerWith(async () => json({ success: false, 'error-codes': ['invalid-input-response'] }))
    expect(await verifyHumanCheck('token-1', '', false, 'contact')).toEqual({ ok: false, reason: 'not-confirmed' })
    expect(logs).toEqual(['person check: contact not-confirmed'])
  })

  it('does not pass for a reused or expired token', async () => {
    answerWith(async () => json({ success: false, 'error-codes': ['timeout-or-duplicate'] }))
    expect((await verifyHumanCheck('token-1', '', false, 'contact')).ok).toBe(false)
  })

  it('does not pass when success is anything other than true', async () => {
    for (const success of ['true', 1, null, undefined]) {
      answerWith(async () => json({ success }))
      expect((await verifyHumanCheck('token-1', '', false, 'contact')).ok).toBe(false)
    }
  })

  it('does not pass when the reply cannot be read', async () => {
    answerWith(async () => new Response('<html>not json</html>', { status: 200 }))
    expect(await verifyHumanCheck('token-1', '', false, 'contact')).toEqual({ ok: false, reason: 'unreadable' })
    for (const body of ['null', '"yes"', '42']) {
      answerWith(async () => new Response(body, { status: 200 }))
      expect(await verifyHumanCheck('token-1', '', false, 'contact')).toEqual({ ok: false, reason: 'unreadable' })
    }
  })

  it('does not pass when Cloudflare cannot be reached, and does not try again', async () => {
    answerWith(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await verifyHumanCheck('token-1', '', false, 'contact')).toEqual({ ok: false, reason: 'unavailable' })
    expect(calls).toHaveLength(1)
    expect(logs).toEqual(['person check: contact unavailable'])
  })

  it('gives up after exactly 5 seconds without an answer, and does not try again', async () => {
    vi.useFakeTimers()
    answerWith(hangingFetch)
    let result: unknown = 'pending'
    const run = verifyHumanCheck('token-1', '', false, 'contact').then((r) => {
      result = r
    })
    await vi.advanceTimersByTimeAsync(SITEVERIFY_TIME_LIMIT_MS - 1)
    expect(result).toBe('pending')
    await vi.advanceTimersByTimeAsync(1)
    await run
    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(SITEVERIFY_TIME_LIMIT_MS).toBe(5000)
    expect(calls).toHaveLength(1)
  })

  it('gives up when the reply body stops arriving within the time limit', async () => {
    vi.useFakeTimers()
    answerWith(async (init) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body, { status: 200 })
    })
    const run = verifyHumanCheck('token-1', '', false, 'contact')
    await vi.advanceTimersByTimeAsync(SITEVERIFY_TIME_LIMIT_MS)
    expect(await run).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('does not pass without a token, and sends no request', async () => {
    answerWith(async () => json({ success: true }))
    for (const token of ['', undefined, null, 42, ['token-1'], { token: 'x' }]) {
      expect(await verifyHumanCheck(token, '', false, 'contact')).toEqual({ ok: false, reason: 'missing' })
    }
    expect(calls).toHaveLength(0)
  })

  it('does not pass when the site secret is not set, and sends no request', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY_AB', '')
    answerWith(async () => json({ success: true }))
    expect(await verifyHumanCheck('token-1', '', false, 'contact')).toEqual({ ok: false, reason: 'unavailable' })
    expect(calls).toHaveLength(0)
  })

  it('writes log lines with no token, secret, address or reply text', async () => {
    answerWith(async () => json({ success: false, 'error-codes': ['bad-request'], hostname: 'example.test' }))
    await verifyHumanCheck('token-secret-value', '203.0.113.9', false, 'contact')
    answerWith(async () => {
      throw new Error('connect ECONNREFUSED 203.0.113.9 token-secret-value')
    })
    await verifyHumanCheck('token-secret-value', '203.0.113.9', true, 'contact')
    const all = logs.join('\n')
    for (const hidden of ['token-secret-value', 'test-secret', '203.0.113.9', 'bad-request', 'example.test', 'ECONNREFUSED']) {
      expect(all).not.toContain(hidden)
    }
    expect(logs).toEqual(['person check: contact not-confirmed', 'person check: contact unavailable'])
  })

  it('keeps the visitor text free of site names and web addresses', () => {
    expect(HUMAN_CHECK_FAILED_TEXT).toBe(
      "We couldn't confirm the form was sent by a person. Please refresh the page and try again.",
    )
    expect(HUMAN_CHECK_FAILED_TEXT).not.toMatch(/accounting\s*body|ethio\s*tax|\.com\b|\.et\b|https?:|www\./i)
  })
})
