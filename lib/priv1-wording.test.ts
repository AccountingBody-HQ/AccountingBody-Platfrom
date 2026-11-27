import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-1 (S5): every new visible sentence, exactly as the owner approved it,
// for both sites.

// vitest compiles the page with the classic JSX transform (as lib/error-page.test.ts).
;(globalThis as { React?: typeof React }).React = React

const brand = vi.hoisted(() => ({ et: false }))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('@/lib/brand-server', () => ({
  getRequestBrand: async () => ({ isEthioTax: brand.et, name: brand.et ? 'EthioTax' : 'Accounting Body' }),
}))

import UnsubscribePage from '@/app/unsubscribe/page'
import { fakeTables } from './test-helpers/fake-rest-tables'
import { getServerSupabase } from './supabase-server'
import { confirmationEmailHtml, newsletterBrand, type NewsletterMailer } from './newsletter-signup'
import { clearUnsubscribeLimits, requestUnsubscribeLink } from './newsletter-unsubscribe'
import { signUnsubscribeToken } from './newsletter-tokens'

const SITES = [
  ['ab', 'Accounting Body', 'accountingbody.com', false],
  ['et', 'EthioTax', 'ethiotax.com', true],
] as const

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const page = async (et: boolean, token?: string) => {
  brand.et = et
  return renderToStaticMarkup(await UnsubscribePage({ searchParams: Promise.resolve(token === undefined ? {} : { token }) }))
}

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'jwt-test-value-0123456789abcdef')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  clearUnsubscribeLimits()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PRIV-1 wording', () => {
  it('contact form: the box is unticked, its label unchanged, and the success line is exact', () => {
    const source = read('app/contact/ContactForm.tsx')
    expect(source).not.toContain('defaultChecked')
    expect(source).toContain('Also subscribe me to the free weekly email — exam tips and study guides written by qualified accountants.')
    expect(source).toContain('Check your inbox to confirm your newsletter sign-up.')
  })

  it.each(SITES)('%s: confirmation e-mail sentence', (platform, _name, domain) => {
    const html = confirmationEmailHtml(newsletterBrand(platform), 'https://' + domain + '/api/confirm-subscription?token=x')
    expect(text(html)).toContain(
      `One last step - click below to confirm your subscription. No spam. You can unsubscribe at any time at ${domain}/unsubscribe.`,
    )
    expect(html).not.toContain('Unsubscribe any time.')
  })

  it.each(SITES)('%s: /unsubscribe without a link', async (_p, _name, _domain, et) => {
    const html = await page(et)
    expect(html).toContain('>Unsubscribe from our e-mails</h1>')
    expect(html).toContain('Enter your e-mail address and we will send you a link to unsubscribe.')
    expect(html).toContain('>Send me the link</button>')
  })

  it.each(SITES)('%s: /unsubscribe with a link', async (platform, _name, _domain, et) => {
    const html = await page(et, await signUnsubscribeToken({ id: '0f8fad5b-d9cb-469f-a165-70867728950e', platform }))
    expect(html).toContain('>Stop receiving our newsletter e-mails?</h1>')
    expect(html).toContain('>Unsubscribe</button>')
  })

  it.each(SITES)('%s: /unsubscribe with a bad link', async (_p, _name, _domain, et) => {
    const html = await page(et, 'not-a-real-token')
    expect(html).toContain('This link is not valid or has expired. You can ask for a new one below.')
  })

  it('/unsubscribe after the click and after the request', () => {
    const client = read('app/unsubscribe/UnsubscribeForms.tsx')
    expect(client).toContain('You are unsubscribed. We will not send you newsletter e-mails again.')
    expect(client).toContain('If this address is on our list, we have sent you a link. Please check your inbox.')
  })

  it.each(SITES)('%s: unsubscribe-link e-mail', async (platform, name) => {
    const db = fakeTables('https://example.supabase.co', {
      email_subscribers: [{ id: '0f8fad5b-d9cb-469f-a165-70867728950e', email: 'ada@example.com', platform, status: 'subscribed' }],
    })
    vi.stubGlobal('fetch', vi.fn(db.fetch))
    const sent: { subject: string; html: string }[] = []
    const mailer: NewsletterMailer = {
      emails: { send: async (m) => (sent.push(m), { data: { id: 'e' }, error: null }) },
    }
    await requestUnsubscribeLink({ supabase: getServerSupabase('publicWrite'), resend: mailer, email: 'ada@example.com', platform, ip: '203.0.113.7' })
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toBe(`Your unsubscribe link - ${name}`)
    const body = text(sent[0].html)
    expect(body).toContain('Unsubscribe from our e-mails.')
    expect(body).toContain('Click below to stop receiving our newsletter e-mails.')
    expect(sent[0].html).toMatch(/>Unsubscribe<\/a>/)
    expect(body).toContain('If you did not ask for this, you can ignore this e-mail and nothing will change.')
  })

  it('footer legal bar: Unsubscribe after Cookie Policy', () => {
    const source = read('components/layout/Footer.tsx')
    expect(source).toMatch(/\{ label: 'Cookie Policy',\s+href: '\/cookie-policy' \},\n\s+\{ label: 'Unsubscribe',\s+href: '\/unsubscribe' \},/)
  })

  it('the four existing "unsubscribe any time" promises are unchanged (now true)', () => {
    expect(read('components/layout/Footer.tsx')).toContain(
      "'ERCA deadlines, ETICPA news, new practice question releases and finance job alerts. No spam, unsubscribe any time.'",
    )
    expect(read('components/layout/Footer.tsx')).toContain(
      "'New accounting and finance job alerts, managed placement updates, and weekly exam tips. No spam, unsubscribe any time.'",
    )
    expect(read('app/page.tsx')).toContain('Join accounting and finance professionals. Unsubscribe any time.')
    expect(read('app/page.tsx')).toContain('Join the EthioTax community. Unsubscribe any time.')
    expect(read('app/contact/ContactForm.tsx')).toContain('No spam, ever. Unsubscribe any time.')
  })
})
