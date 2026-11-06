import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_SIGNED_OUT_EVENT, adminFetch } from './admin-fetch'
import { ADMIN_SIGNED_OUT_BODY } from './middleware-logic'

const ROUTE = '/api/example'
const JSON_TYPE = { 'content-type': 'application/json' }
const HTML_TYPE = { 'content-type': 'text/html; charset=utf-8' }
const ZIP_TYPE = { 'content-type': 'application/zip' }

type Reply = {
  body?: BodyInit | null
  status?: number
  headers?: Record<string, string>
  redirectedTo?: string
}

function reply({ body = null, status = 200, headers = {}, redirectedTo }: Reply): void {
  const res = new Response(body, { status, headers })
  if (redirectedTo) {
    Object.defineProperty(res, 'redirected', { value: true })
    Object.defineProperty(res, 'url', { value: redirectedTo })
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
}

let events: EventTarget
let notices: number

beforeEach(() => {
  events = new EventTarget()
  notices = 0
  events.addEventListener(ADMIN_SIGNED_OUT_EVENT, () => { notices++ })
  vi.stubGlobal('window', events)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a real success', () => {
  it('is reported on an ok status with a JSON body', async () => {
    reply({ body: '{"saved":true}', headers: JSON_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: true, status: 200, signedOut: false, error: null })
    expect(await res.json()).toEqual({ saved: true })
    expect(notices).toBe(0)
  })

  it('keeps the status of a created record', async () => {
    reply({ body: '{"slug":"a"}', status: 201, headers: JSON_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: true, status: 201 })
  })

  it('passes the address and options to fetch', async () => {
    reply({ body: '{}', headers: JSON_TYPE })
    const init = { method: 'POST', body: '{}' }
    await adminFetch(ROUTE, init)
    expect(fetch).toHaveBeenCalledWith(ROUTE, init)
  })

  it('accepts a JSON body after a redirect to another address', async () => {
    reply({ body: '{"saved":true}', headers: JSON_TYPE, redirectedTo: 'https://example.com/api/other' })
    expect((await adminFetch(ROUTE)).ok).toBe(true)
  })
})

describe('signed out', () => {
  it('is reported on a 401', async () => {
    reply({ body: JSON.stringify(ADMIN_SIGNED_OUT_BODY), status: 401, headers: JSON_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, status: 401, signedOut: true, error: 'Signed out' })
    expect(await res.json()).toEqual(ADMIN_SIGNED_OUT_BODY)
  })

  it('is reported on a 401 with a body that is not JSON', async () => {
    reply({ body: 'Unauthorized', status: 401 })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, signedOut: true })
    expect(await res.json()).toEqual(ADMIN_SIGNED_OUT_BODY)
  })

  it('is reported on a redirect to the sign-in page', async () => {
    reply({ body: '<html></html>', headers: HTML_TYPE, redirectedTo: 'https://example.com/test-admin-area-login' })
    expect(await adminFetch(ROUTE)).toMatchObject({ ok: false, signedOut: true })
  })

  it('is reported on a redirect to the sign-in page whatever the body says', async () => {
    reply({ body: '{"saved":true}', headers: JSON_TYPE, redirectedTo: 'https://example.com/test-admin-area-login' })
    expect(await adminFetch(ROUTE)).toMatchObject({ ok: false, signedOut: true })
  })

  it('is reported on a page where JSON was expected', async () => {
    reply({ body: '<html></html>', headers: HTML_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, signedOut: true })
    expect(await res.json()).toEqual(ADMIN_SIGNED_OUT_BODY)
  })

  it('shows the notice once for each failed call', async () => {
    reply({ status: 401 })
    await adminFetch(ROUTE)
    expect(notices).toBe(1)
  })

  it('works without a window', async () => {
    vi.stubGlobal('window', undefined)
    reply({ status: 401 })
    expect((await adminFetch(ROUTE)).signedOut).toBe(true)
  })
})

describe('other failures', () => {
  it('is failed on an ok status with a body that is not JSON', async () => {
    reply({ body: 'partial reply', headers: { 'content-type': 'text/plain' } })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, signedOut: false, error: 'partial reply' })
    expect(notices).toBe(0)
  })

  it('is failed on an ok status with an empty body', async () => {
    reply({ body: '', headers: JSON_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, signedOut: false, error: 'Request failed (200)' })
  })

  it('keeps the error and fields a route sent', async () => {
    reply({ body: '{"error":"In use","count":3}', status: 409, headers: JSON_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, status: 409, signedOut: false, error: 'In use' })
    expect(await res.json()).toEqual({ error: 'In use', count: 3 })
  })

  it('always gives an error text, even when a route sent none', async () => {
    reply({ body: '{"ok":false}', status: 500, headers: JSON_TYPE })
    const res = await adminFetch(ROUTE)
    expect(await res.json()).toEqual({ ok: false, error: 'Request failed (500)' })
  })

  it('reports a gateway error page by its status', async () => {
    reply({ body: '<html>Bad gateway</html>', status: 502, headers: HTML_TYPE })
    const res = await adminFetch(ROUTE)
    expect(res).toMatchObject({ ok: false, signedOut: false, error: 'Request failed (502)' })
  })

  it('passes on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(adminFetch(ROUTE)).rejects.toThrow('Failed to fetch')
  })

  it('has no file to read', async () => {
    reply({ body: '{"error":"In use"}', status: 409, headers: JSON_TYPE })
    await expect((await adminFetch(ROUTE)).blob()).rejects.toThrow('In use')
  })
})

describe('routes that answer with a file', () => {
  const asFile = { expect: 'file' } as const

  it('is a success with the file', async () => {
    reply({ body: 'zip-bytes', headers: ZIP_TYPE })
    const res = await adminFetch(ROUTE, undefined, asFile)
    expect(res).toMatchObject({ ok: true, signedOut: false })
    expect(await (await res.blob()).text()).toBe('zip-bytes')
  })

  it.each([
    ['a 401', { status: 401 }],
    ['a page', { body: '<html></html>', headers: HTML_TYPE }],
    ['a redirect to the sign-in page', { body: '<html></html>', headers: ZIP_TYPE, redirectedTo: 'https://example.com/a-login' }],
  ])('is signed out on %s', async (_label, answer) => {
    reply(answer)
    expect(await adminFetch(ROUTE, undefined, asFile)).toMatchObject({ ok: false, signedOut: true })
  })

  it('is failed on JSON in place of the file', async () => {
    reply({ body: '{"error":"No chapters"}', headers: JSON_TYPE })
    const res = await adminFetch(ROUTE, undefined, asFile)
    expect(res).toMatchObject({ ok: false, signedOut: false, error: 'No chapters' })
  })

  it('reports the error a route sent', async () => {
    reply({ body: '{"error":"No chapters"}', status: 400, headers: JSON_TYPE })
    const res = await adminFetch(ROUTE, undefined, asFile)
    expect(await res.json()).toEqual({ error: 'No chapters' })
  })
})
