import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { personCheckSiteKey } from './person-check'

// The person-check widget: which site key it uses, and how every public form
// screen sends its token and gets a fresh one. The screens are checked by
// reading their source, as the repo has no browser test set-up.

const keys = { ethiotax: 'key-second-site', ab: 'key-main-site' }

describe('person check site key', () => {
  it('uses the main site key when the page is not marked for the second site', () => {
    expect(personCheckSiteKey('', undefined, keys)).toBe('key-main-site')
    expect(personCheckSiteKey('x-et-platform=ab; other=1', undefined, keys)).toBe('key-main-site')
  })

  it('uses the second site key when the page is marked for the second site', () => {
    expect(personCheckSiteKey('x-et-platform=ethiotax', undefined, keys)).toBe('key-second-site')
    expect(personCheckSiteKey('a=1; x-et-platform=ethiotax; b=2', undefined, keys)).toBe('key-second-site')
  })

  it('follows the server decision when the screen has one', () => {
    expect(personCheckSiteKey('', true, keys)).toBe('key-second-site')
    expect(personCheckSiteKey('x-et-platform=ethiotax', false, keys)).toBe('key-main-site')
  })

  it('gives an empty key when the key for that site is not set, as before', () => {
    expect(personCheckSiteKey('x-et-platform=ethiotax', undefined, { ab: 'key-main-site' })).toBe('')
    expect(personCheckSiteKey('', undefined, { ethiotax: 'key-second-site' })).toBe('')
  })
})

const root = join(__dirname, '..')
const source = (path: string) => readFileSync(join(root, path), 'utf8')

// Text of the block that starts at the first `{` at or after `from`.
function blockAfter(text: string, from: number): string {
  const open = text.indexOf('{', from)
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth += 1
    if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1)
  }
  throw new Error('unbalanced block')
}

// From the request to the end of the `catch` block that handles it.
function submitHandling(text: string, route: string): string {
  const start = text.indexOf(`fetch('${route}'`)
  expect(start, `request to ${route}`).toBeGreaterThan(-1)
  const catchAt = text.indexOf('catch', start)
  return text.slice(start, catchAt) + blockAfter(text, catchAt)
}

// The whole submit handler: from its `async` to the end of that `catch`.
function submitHandler(text: string, route: string): string {
  const start = text.indexOf(`fetch('${route}'`)
  return text.slice(text.lastIndexOf('async', start), start) + submitHandling(text, route)
}

type Screen = { path: string; routes: string[] }
const screens: Screen[] = [
  { path: 'app/contact/ContactForm.tsx', routes: ['/api/contact', '/api/subscribe'] },
  { path: 'components/EmailSignupForm.tsx', routes: ['/api/subscribe'] },
  { path: 'components/layout/Footer.tsx', routes: ['/api/subscribe'] },
  { path: 'app/firms-freelancers/join/page.tsx', routes: ['/api/firms-application'] },
  ...[
    'accounting-bookkeeping/page.tsx',
    'audit-assurance/page.tsx',
    'business-consulting/page.tsx',
    'financial-planning-advisory/page.tsx',
    'payroll-services/page.tsx',
    'tax-filing-compliance/page.tsx',
    'company-formation/_client.tsx',
  ].map((file) => ({ path: `app/get-help/${file}`, routes: ['/api/help-request'] })),
  { path: 'app/get-help/_service-page-client.tsx', routes: ['/api/help-request'] },
  { path: 'app/global-payroll/[slug]/page.tsx', routes: ['/api/help-request'] },
  { path: 'app/freelancing-pathways/FreelancingPathwaysClient.tsx', routes: ['/api/recruitment/job-seeker-apply'] },
  { path: 'app/jobs/find-work/FindWorkClient.tsx', routes: ['/api/recruitment/job-seeker-apply'] },
  { path: 'app/jobs/hire-talent/HireTalentClient.tsx', routes: ['/api/recruitment/employer-brief'] },
]

const rendersWidget = (text: string) => text.includes('<PersonCheck ') || text.includes('turnstile.render(')
const resetCall = /(personCheck\.current\?\.reset\(\)|turnstile\??\.reset\(|resetWidgetInPlace\()/

describe.each(screens)('$path', ({ path, routes }) => {
  const text = source(path)

  it('shows the person check', () => {
    expect(rendersWidget(text)).toBe(true)
  })

  it.each(routes)('sends the person check with the request to %s', (route) => {
    const handler = submitHandler(text, route)
    expect(handler).toMatch(/'cf-turnstile-response':\s*\S/)
    if (text.includes('<PersonCheck ')) {
      expect(text).toContain('onToken={setPersonCheckToken}')
      expect(handler).toMatch(/'cf-turnstile-response': *personCheckToken|const token = personCheckToken[\s\S]*'cf-turnstile-response': *token\b/)
    }
  })

  it.each(routes)('asks for a fresh person check after any answer other than success from %s', (route) => {
    const handling = submitHandling(text, route)
    const errorPaths = Array.from(handling.matchAll(/set\w*\(\s*'error'\s*\)/g))
    expect(errorPaths.length).toBeGreaterThan(0)
    for (const found of errorPaths) {
      const rest = handling.slice(found.index ?? 0)
      expect(rest.slice(0, rest.indexOf('}'))).toMatch(resetCall)
    }
  })
})

describe('person check script', () => {
  const touched = [
    'components/PersonCheck.tsx',
    'app/firms-freelancers/join/page.tsx',
    'app/get-help/_service-page-client.tsx',
    'app/global-payroll/[slug]/page.tsx',
    'app/freelancing-pathways/FreelancingPathwaysClient.tsx',
    'app/jobs/find-work/FindWorkClient.tsx',
    'app/jobs/hire-talent/HireTalentClient.tsx',
  ]

  it('is loaded once, by the root layout', () => {
    expect(source('app/layout.tsx').split('turnstile/v0/api.js').length - 1).toBe(1)
  })

  it.each(touched)('is not loaded again by %s', (path) => {
    expect(source(path)).not.toContain('turnstile/v0/api.js')
  })
})

describe('person check widget', () => {
  const text = source('components/PersonCheck.tsx')

  it('gives each site its own site key', () => {
    expect(text).toMatch(/ethiotax: process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY,/)
    expect(text).toMatch(/ab: process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB,/)
  })

  it('keeps the same site choice as each screen had before', () => {
    const tag = (path: string) => source(path).match(/<PersonCheck [^>]*\/>/)?.[0] ?? ''
    for (const path of ['app/jobs/find-work/FindWorkClient.tsx', 'app/jobs/hire-talent/HireTalentClient.tsx']) {
      expect(tag(path)).toContain('isEthioTax={isEthioTax}')
    }
    for (const path of ['app/firms-freelancers/join/page.tsx', 'app/global-payroll/[slug]/page.tsx']) {
      expect(tag(path)).not.toContain('isEthioTax')
    }
  })

  it('renders into a plain container with the site key and token callbacks only', () => {
    expect(text).toContain('return <div ref={container} />')
    const options = blockAfter(text, text.indexOf('window.turnstile.render(container.current,'))
    expect(options.match(/^ {8}[\w'-]+:/gm)?.map((line) => line.trim())).toEqual(['sitekey:', 'callback:', "'expired-callback':"])
  })

  it('drops the token on reset and removes its widget when it goes away', () => {
    const reset = blockAfter(text, text.indexOf('reset() {'))
    expect(reset.indexOf("onTokenRef.current('')")).toBeGreaterThan(-1)
    expect(reset).toContain('window.turnstile.reset(id)')
    const cleanup = blockAfter(text, text.indexOf('return () => {'))
    expect(cleanup).toContain('removeWidget(id)')
    expect(cleanup).toContain("onTokenRef.current('')")
  })
})
