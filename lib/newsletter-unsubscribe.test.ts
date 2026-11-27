import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SignJWT, decodeJwt } from 'jose'
import { NextRequest } from 'next/server'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-1: unsubscribing, with a link or by asking for one.

// vitest compiles the page with the classic JSX transform, which reads a
// global React; Next's own build does not need this (as lib/error-page.test.ts).
;(globalThis as { React?: typeof React }).React = React

type Mail = { from: string; to: string; subject: string; html: string }
const mail = vi.hoisted(() => ({ sent: [] as Mail[], fail: false }))
const brand = vi.hoisted(() => ({ et: false }))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Mail) => {
        mail.sent.push(message)
        return mail.fail
          ? { data: null, error: { name: 'application_error', statusCode: null }, headers: null }
          : { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('@/lib/brand-server', () => ({
  getRequestBrand: async () => ({ isEthioTax: brand.et, name: brand.et ? 'EthioTax' : 'Accounting Body' }),
}))

import * as route from '@/app/api/unsubscribe/route'
import UnsubscribePage from '@/app/unsubscribe/page'
import { fakeTables, type FakeTables, type Row } from './test-helpers/fake-rest-tables'
import { addressKey, clearUnsubscribeLimits } from './newsletter-unsubscribe'
import { signUnsubscribeToken } from './newsletter-tokens'
import { PUBLIC_API_SEGMENTS, PUBLIC_PAGE_SEGMENTS } from './sentry-browser-privacy'

const DB_URL = 'https://example.supabase.co'
const SITE = 'https://accountingbody.com'
const SECRET = 'jwt-test-value-0123456789abcdef'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const OTHER_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const EARLIER = '2026-04-01T00:00:00.000Z'

let db: FakeTables
let personOk = true
let personChecks = 0
let logs: string[] = []

function setup(rows: Row[] = []) {
  db = fakeTables(DB_URL, { email_subscribers: rows })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('https://challenges.cloudflare.com/')) {
        personChecks += 1
        return new Response(JSON.stringify({ success: personOk }), { headers: { 'content-type': 'application/json' } })
      }
      return db.fetch(input, init)
    }),
  )
}

const row = (fields: Row = {}): Row => ({
  id: ID,
  email: 'ada@example.com',
  platform: 'ab',
  status: 'subscribed',
  unsubscribed_at: null,
  confirmation_token: null,
  ...fields,
})

const postJson = (body: unknown, headers: Record<string, string> = {}) =>
  route.POST(
    new NextRequest(SITE + '/api/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    }),
  )
const oneClick = (token: string, body = 'List-Unsubscribe=One-Click') =>
  route.POST(
    new NextRequest(SITE + '/api/unsubscribe?token=' + encodeURIComponent(token), {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  )
const answer = async (response: Response) => ({ status: response.status, body: await response.json() })
const writes = () => db.requests.filter((r) => r.method !== 'GET')
const ask = (email: string, headers: Record<string, string> = {}) =>
  postJson({ email, 'cf-turnstile-response': 'token' }, headers)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('JWT_SECRET', SECRET)
  logs = []
  const logged = (...args: unknown[]) => logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  vi.spyOn(console, 'error').mockImplementation(logged)
  vi.spyOn(console, 'warn').mockImplementation(logged)
  mail.sent.length = 0
  mail.fail = false
  personOk = true
  personChecks = 0
  brand.et = false
  clearUnsubscribeLimits()
  setup()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('unsubscribe API with a link', () => {
  it('has no GET handler, so opening the address changes nothing (405)', () => {
    expect('GET' in route).toBe(false)
    expect(Object.keys(route).sort()).toEqual(['POST', 'dynamic', 'fetchCache'])
  })

  it('unsubscribes the row the link names, on that site only', async () => {
    setup([row(), row({ id: OTHER_ID, platform: 'et' })])
    const token = await signUnsubscribeToken({ id: ID, platform: 'ab' })
    expect(await answer(await postJson({ token }))).toEqual({ status: 200, body: { success: true } })
    const update = writes()
    expect(update).toHaveLength(1)
    expect(update[0].method).toBe('PATCH')
    expect(update[0].params).toEqual(
      expect.arrayContaining([['id', `eq.${ID}`], ['platform', 'eq.ab'], ['status', 'in.(subscribed,pending)']]),
    )
    expect(db.tables.email_subscribers[0]).toMatchObject({
      status: 'unsubscribed',
      unsubscribed_at: '2026-06-01T09:00:00.000Z',
      confirmation_token: null,
    })
    expect(db.tables.email_subscribers[1].status).toBe('subscribed')
    expect(personChecks).toBe(0)
  })

  it('a pending row is unsubscribed too', async () => {
    setup([row({ status: 'pending', confirmation_token: 'a'.repeat(64) })])
    await postJson({ token: await signUnsubscribeToken({ id: ID, platform: 'ab' }) })
    expect(db.tables.email_subscribers[0]).toMatchObject({ status: 'unsubscribed', confirmation_token: null })
  })

  it('an already unsubscribed or missing row gets the same answer and keeps its first date', async () => {
    setup([row({ status: 'unsubscribed', unsubscribed_at: EARLIER })])
    const token = await signUnsubscribeToken({ id: ID, platform: 'ab' })
    expect(await answer(await postJson({ token }))).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.email_subscribers[0].unsubscribed_at).toBe(EARLIER)
    const missing = await signUnsubscribeToken({ id: OTHER_ID, platform: 'ab' })
    expect(await answer(await postJson({ token: missing }))).toEqual({ status: 200, body: { success: true } })
  })

  it.each([
    ['a forged link', () => new SignJWT({ sid: ID, p: 'ab', purpose: 'unsubscribe' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode('another-secret-0123456789abcdef'))],
    ['a link for another purpose', () => new SignJWT({ sid: ID, p: 'ab', purpose: 'confirm' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(SECRET))],
    ['an old confirmation link', () => new SignJWT({ email: 'ada@example.com', platform: 'ab' }).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(SECRET))],
    ['garbage', async () => 'not-a-real-token'],
    ['a number', async () => 42 as unknown as string],
  ])('%s is refused with invalid-link and changes nothing', async (_name, make) => {
    setup([row()])
    expect(await answer(await postJson({ token: await make() }))).toEqual({ status: 400, body: { error: 'invalid-link' } })
    expect(db.requests).toEqual([])
    expect(db.tables.email_subscribers[0].status).toBe('subscribed')
  })

  it('one-click from a mail program works with the form body', async () => {
    setup([row({ platform: 'et' })])
    const token = await signUnsubscribeToken({ id: ID, platform: 'et' })
    expect(await answer(await oneClick(token))).toEqual({ status: 200, body: { success: true } })
    expect(db.tables.email_subscribers[0].status).toBe('unsubscribed')
  })

  it('a form post without the one-click body is refused', async () => {
    setup([row()])
    const token = await signUnsubscribeToken({ id: ID, platform: 'ab' })
    expect((await oneClick(token, 'something=else')).status).toBe(400)
    expect(db.requests).toEqual([])
  })

  it('a database problem is not reported as success, and logs the code only', async () => {
    setup([row()])
    db.problem = () => 'fail'
    const result = await answer(await postJson({ token: await signUnsubscribeToken({ id: ID, platform: 'ab' }) }))
    expect(result.status).toBe(500)
    expect(result.body.success).toBeUndefined()
    expect(logs).toEqual(['unsubscribe: save failed 22P02'])
  })
})

describe('unsubscribe API without a link', () => {
  const OK = { status: 200, body: { success: true } }

  it('needs the person check, with the same refusal as the newsletter sign-up', async () => {
    personOk = false
    expect(await answer(await ask('ada@example.com'))).toEqual({
      status: 400,
      body: {
        error: "We couldn't verify your request. If you're using an ad blocker or privacy extension, please disable it for this page and try again.",
        code: 'turnstile_failed',
      },
    })
    expect(await answer(await postJson({ email: 'ada@example.com' }))).toMatchObject({ status: 400, body: { code: 'turnstile_failed' } })
    vi.stubEnv('TURNSTILE_SECRET_KEY_AB', '')
    expect(await answer(await ask('ada@example.com'))).toMatchObject({ status: 503, body: { code: 'turnstile_unreachable' } })
    expect(db.requests).toEqual([])
    expect(mail.sent).toEqual([])
  })

  it('an address on the list gets one e-mail with a link that holds no address', async () => {
    setup([row()])
    expect(await answer(await ask('Ada@Example.com'))).toEqual(OK)
    expect(mail.sent).toHaveLength(1)
    const sent = mail.sent[0]
    expect(sent).toMatchObject({
      from: 'Accounting Body <noreply@accountingbody.com>',
      to: 'Ada@Example.com',
      subject: 'Your unsubscribe link - Accounting Body',
    })
    const link = /href="(https:\/\/accountingbody\.com\/unsubscribe\?token=[^"]+)"/.exec(sent.html)?.[1] ?? ''
    expect(link).not.toBe('')
    expect(link.toLowerCase()).not.toContain('ada')
    expect(link).not.toContain('%40')
    expect(decodeJwt(new URL(link).searchParams.get('token') ?? '')).toEqual({ sid: ID, p: 'ab', purpose: 'unsubscribe' })
    expect(writes()).toEqual([])
  })

  it('an EthioTax request looks up the EthioTax row and links to ethiotax.com', async () => {
    setup([row({ platform: 'et' })])
    await ask('ada@example.com', { 'x-et-platform': 'ethiotax' })
    expect(mail.sent[0].from).toBe('EthioTax <noreply@accountingbody.com>')
    expect(mail.sent[0].subject).toBe('Your unsubscribe link - EthioTax')
    expect(mail.sent[0].html).toContain('https://ethiotax.com/unsubscribe?token=')
  })

  it('every case gives the same answer; only an on-list, unlimited address gets an e-mail', async () => {
    setup([row(), row({ id: OTHER_ID, email: 'already@example.com', status: 'unsubscribed' })])
    expect(await answer(await ask('nobody@example.com'))).toEqual(OK)
    expect(await answer(await ask('already@example.com'))).toEqual(OK)
    expect(mail.sent).toHaveLength(0)
    expect(await answer(await ask('ada@example.com'))).toEqual(OK)
    expect(mail.sent).toHaveLength(1)
    // Second request for the same address within the hour (4th from this IP): limited.
    expect(await answer(await ask('ADA@example.com '))).toEqual(OK)
    expect(mail.sent).toHaveLength(1)
  })

  it('per IP address: 5 requests in 10 minutes, then the same answer and nothing looked up', async () => {
    setup([row()])
    for (let i = 0; i < 5; i += 1) expect(await answer(await ask(`person${i}@example.com`))).toEqual(OK)
    const lookups = db.requests.length
    expect(await answer(await ask('ada@example.com'))).toEqual(OK)
    expect(db.requests.length).toBe(lookups)
    expect(mail.sent).toEqual([])
  })

  it('a failed send or lookup gives the same answer, logged by code only', async () => {
    setup([row()])
    mail.fail = true
    expect(await answer(await ask('ada@example.com'))).toEqual(OK)
    expect(logs).toEqual(['email: send failed (unsubscribe link) application_error'])
    db.problem = () => 'fail'
    expect(await answer(await ask('other@example.com'))).toEqual(OK)
    expect(logs[1]).toBe('unsubscribe request: lookup failed 22P02')
    for (const line of logs) expect(line).not.toContain('@')
  })

  it('the address limit is keyed on a hash of the lower-cased address', () => {
    expect(addressKey(' Ada@Example.com ')).toBe(addressKey('ada@example.com'))
    expect(addressKey('ada@example.com')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('unsubscribe page', () => {
  const page = async (token?: string) =>
    renderToStaticMarkup(await UnsubscribePage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) }))
  const count = (html: string, text: string) => html.split(text).length - 1

  it('without a link: one h1, the request form and its words', async () => {
    const html = await page()
    expect(count(html, '<h1')).toBe(1)
    expect(count(html, 'Unsubscribe from our e-mails</h1>')).toBe(1)
    expect(html).toContain('Enter your e-mail address and we will send you a link to unsubscribe.')
    expect(html).toContain('Send me the link')
    expect(html).toMatch(/<label for="unsubscribe-email"[^>]*>Email address<\/label>/)
    expect(html).not.toContain('This link is not valid')
    expect(html).not.toContain('Stop receiving')
  })

  it('with a bad link: the bad-link line above the form', async () => {
    const html = await page('not-a-real-token')
    expect(count(html, '<h1')).toBe(1)
    expect(html).toContain('Unsubscribe from our e-mails</h1>')
    expect(html.indexOf('This link is not valid or has expired. You can ask for a new one below.')).toBeGreaterThan(-1)
    expect(html.indexOf('This link is not valid')).toBeLessThan(html.indexOf('Send me the link'))
    expect(html).not.toContain('Stop receiving our newsletter e-mails?')
  })

  it('with a valid link: the question and the gold Unsubscribe button, no form, no database call', async () => {
    const token = await signUnsubscribeToken({ id: ID, platform: 'ab' })
    const html = await page(token)
    expect(count(html, '<h1')).toBe(1)
    expect(html).toContain('Stop receiving our newsletter e-mails?</h1>')
    expect(html).toMatch(/<button type="button" class="[^"]*bg-gold-500 text-navy-950[^"]*">Unsubscribe<\/button>/)
    expect(html).not.toContain('Send me the link')
    expect(db.requests).toEqual([])
  })

  it('renders for EthioTax too', async () => {
    brand.et = true
    const html = await page()
    expect(html).toContain('Unsubscribe from our e-mails</h1>')
  })

  it('is not indexed and makes no database call when opened', () => {
    const source = readFileSync(join(process.cwd(), 'app/unsubscribe/page.tsx'), 'utf8')
    expect(source).toContain("robots: { index: false, follow: false }")
    expect(source).toContain("title: 'Unsubscribe'")
    const client = readFileSync(join(process.cwd(), 'app/unsubscribe/UnsubscribeForms.tsx'), 'utf8')
    for (const text of [source, client]) {
      expect(text).not.toMatch(/supabase|getServerSupabase/i)
    }
    expect(client).toContain('You are unsubscribed. We will not send you newsletter e-mails again.')
    expect(client).toContain('If this address is on our list, we have sent you a link. Please check your inbox.')
    expect(client).toMatch(/aria-live="polite"/)
  })
})

describe('where the unsubscribe address appears', () => {
  it('the footer legal bar lists it after Cookie Policy, for both sites', () => {
    const source = readFileSync(join(process.cwd(), 'components/layout/Footer.tsx'), 'utf8')
    const legal = /const legalLinks = \[([\s\S]*?)\]/.exec(source)?.[1] ?? ''
    const labels = Array.from(legal.matchAll(/label: '([^']+)'/g), (m) => m[1])
    expect(labels).toEqual(['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Unsubscribe', 'Disclaimer', 'Accessibility'])
    expect(legal).toContain("{ label: 'Unsubscribe',       href: '/unsubscribe' }")
    // One list rendered for both sites.
    expect(source.match(/legalLinks\.map/g)).toHaveLength(1)
  })

  it('the error-report address lists include it', () => {
    expect(PUBLIC_PAGE_SEGMENTS).toContain('unsubscribe')
    expect(PUBLIC_API_SEGMENTS).toContain('unsubscribe')
  })

  it('it is in no sitemap and not in llms.txt', () => {
    for (const file of ['app/sitemaps/pages.xml/route.ts', 'app/et-sitemap/route.ts', 'app/sitemap.xml/route.ts', 'lib/llms-txt.ts', 'lib/sitemap-chunks.ts']) {
      expect([file, readFileSync(join(process.cwd(), file), 'utf8').includes('unsubscribe')]).toEqual([file, false])
    }
  })
})
