import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Sentry from '@sentry/nextjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'

// SEC-1 (#27, #24, #26): robots.txt no longer lists the admin area (it stays
// protected by its login); the admin links in staff e-mails are built from the
// admin path setting instead of a written name, and no e-mail to a visitor
// carries one; the backup texts name only the public area; server request
// errors reach Sentry through the existing privacy filter. Nothing is sent:
// the e-mail client and the data layer are replaced by recorders.

const ROOT = process.cwd()

const state = vi.hoisted(() => ({ emails: [] as Record<string, unknown>[] }))

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: Record<string, unknown>) => {
        state.emails.push(message)
        return { data: { id: 'email' }, error: null, headers: {} }
      },
    }
  },
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: () => {} }))
vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: () => ({
    from: () => {
      const chain = { update: () => chain, eq: async () => ({ error: null }) }
      return chain
    },
  }),
}))

import robots from '@/app/robots'
import { sendAdminJobNotificationEmail } from './jobEmails'
import { maybeSendProviderAlert } from './provider-alerts'
import * as instrumentation from '@/instrumentation'

// The admin folder name, read from the file system: the one top-level app
// folder whose layout calls requireAdmin. It is never written in this file
// and never shown in a message.
function adminName(): string {
  const app = join(ROOT, 'app')
  const found = readdirSync(app).filter((dir) => {
    const layout = join(app, dir, 'layout.tsx')
    return existsSync(layout) && readFileSync(layout, 'utf8').includes('requireAdmin')
  })
  expect(found.length, 'exactly one admin layout').toBe(1)
  return found[0]
}

const NAME = adminName()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')
const holdsName = (text: string) => text.toLowerCase().includes(NAME.toLowerCase())

afterEach(() => {
  vi.unstubAllEnvs()
  state.emails = []
})

describe('G1 robots.txt', () => {
  const result = robots()
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules]

  it('the * rule disallows exactly the other six areas, in the same order', () => {
    const star = rules.find((rule) => rule.userAgent === '*')
    expect(star?.allow).toBe('/')
    expect(star?.disallow).toEqual(['/api/', '/studio/', '/_next/', '/dashboard/', '/account/', '/private/'])
  })
  it('the four AI bot rules are unchanged', () => {
    expect(rules.filter((rule) => rule.userAgent !== '*')).toEqual([
      { userAgent: 'GPTBot', disallow: ['/'] },
      { userAgent: 'ChatGPT-User', disallow: ['/'] },
      { userAgent: 'CCBot', disallow: ['/'] },
      { userAgent: 'PerplexityBot', disallow: ['/'] },
    ])
    expect(rules.length).toBe(5)
  })
  it('sitemap and host are unchanged', () => {
    expect(result.sitemap).toBe('https://accountingbody.com/sitemap.xml')
    expect(result.host).toBe('https://accountingbody.com')
  })
  it('no rule, value, sitemap or host names the admin area', () => {
    expect(holdsName(JSON.stringify(result)), 'robots output names the admin area').toBe(false)
    expect(holdsName(read('app/robots.ts')), 'app/robots.ts names the admin area').toBe(false)
  })
})

// Each send call is the text from one `emails.send(` to the next one (or the
// end of the file); in the routes the recipient and the HTML are written
// inside the call. In the two lib files the HTML is built in the function
// that sends it, so the unit there is the function.
const STAFF = /^(\s*)("info@accountingbody\.com"|adminEmail\(\)|ALERT_RECIPIENT),?$/

function recipient(segment: string): string {
  const match = /\bto:\s*([^\n]+)/.exec(segment)
  return (match?.[1] ?? '?').trim().replace(/,$/, '')
}

function sendCalls(text: string): string[] {
  return text.split('emails.send(').slice(1)
}

function functions(text: string): string[] {
  return text.split(/\n(?=(?:export )?(?:async )?function )/).slice(1)
}

const ROUTES = [
  'app/api/confirm-subscription/route.ts',
  'app/api/recruitment/confirm-brief/route.ts',
  'app/api/recruitment/update-candidate/route.ts',
  'app/api/recruitment/update-employer/route.ts',
  'app/api/recruitment/verify-email/route.ts',
]
const LIBS = ['lib/jobEmails.ts', 'lib/provider-alerts.ts']

describe('G2 e-mail sources', () => {
  it('no e-mail file writes the admin name; each builds its admin link from getAdminPath()', () => {
    for (const file of [...ROUTES, ...LIBS]) {
      const text = read(file)
      expect(holdsName(text), `${file} names the admin area`).toBe(false)
      expect(text, file).toMatch(/^import \{ getAdminPath \} from ['"](@\/lib|\.)\/middleware-logic['"]$/m)
      expect(text.split('getAdminPath()').length - 1, `${file}: one admin link`).toBe(1)
    }
  })

  it('route send calls: recipient -> admin link in its HTML', () => {
    const table = ROUTES.map((file) =>
      sendCalls(read(file)).map((call) => `${recipient(call)} -> ${call.includes('getAdminPath()') ? 'admin link' : 'none'}`),
    )
    expect(table).toEqual([
      ['"info@accountingbody.com" -> admin link'],
      ['data.contact_email -> none', '"info@accountingbody.com" -> admin link'],
      ['"info@accountingbody.com" -> admin link'],
      ['"info@accountingbody.com" -> admin link'],
      ['data.email -> none', '"info@accountingbody.com" -> admin link'],
    ])
  })

  it('job e-mails: only the function that sends to adminEmail() carries the admin link', () => {
    const table = functions(read('lib/jobEmails.ts'))
      .filter((fn) => fn.includes('emails.send('))
      .map((fn) => {
        const name = /function (\w+)/.exec(fn)?.[1]
        const calls = sendCalls(fn)
        expect(calls.length, `${name}: one send`).toBe(1)
        return `${name}: ${recipient(calls[0])} -> ${fn.includes('getAdminPath()') ? 'admin link' : 'none'}`
      })
    expect(table).toEqual([
      'sendJobConfirmationEmail: job.employer_email -> none',
      'sendAdminJobNotificationEmail: adminEmail() -> admin link',
      'sendJobApprovalEmail: job.employer_email -> none',
      'sendJobRejectionEmail: job.employer_email -> none',
      'sendJobExpiryWarningEmail: job.employer_email -> none',
      'sendJobExpiredEmail: job.employer_email -> none',
    ])
  })

  it('provider alerts: the admin link is built only for the one send, to ALERT_RECIPIENT', () => {
    const text = read('lib/provider-alerts.ts')
    const calls = sendCalls(text)
    expect(calls.length).toBe(1)
    expect(recipient(calls[0])).toBe('ALERT_RECIPIENT')
    const builder = functions(text).find((fn) => fn.startsWith('function buildAlertEmail('))
    expect(builder?.includes('getAdminPath()')).toBe(true)
    // buildAlertEmail is defined once and called once, inside the function that sends.
    expect(text.split('buildAlertEmail(').length - 1).toBe(2)
    const sender = functions(text).find((fn) => fn.startsWith('export async function maybeSendProviderAlert('))
    expect(sender?.includes('buildAlertEmail(')).toBe(true)
    expect(sender?.includes('emails.send(')).toBe(true)
  })

  it('every staff recipient is a staff address', () => {
    for (const r of ['"info@accountingbody.com"', 'adminEmail()', 'ALERT_RECIPIENT']) expect(STAFF.test(r)).toBe(true)
    for (const r of ['data.email', 'data.contact_email', 'job.employer_email']) expect(STAFF.test(r)).toBe(false)
  })
})

// Today's HTML (origin/main 5e3fbc2), rendered with the same inputs, with the
// written admin name replaced by TEST_ADMIN_PATH, then hashed.
const TODAY = {
  jobAb: '99fc2262157e728c9f5eca6811e920e14c4fa0fda4d2381dfacc5a48bd6a5e38',
  jobEt: '0b08da4bb3591a668e6ca44b768f16cdf62d9a1d45d48bbef04aba079e3ba507',
  providerZeroFetch: '23a9f375b4480fbe908172256b9f66de8234f5959673e06c85fc624935f6bbd4',
  providerPaused: 'be0267103c2e61de8c197a2d430ce0517d27d4be1c04c2053697c45c45f186f7',
}

const JOB = {
  title: 'Senior Accountant',
  company_name: 'Example Ltd',
  location_text: 'London',
  employment_type: 'full_time',
  employer_name: 'Sam Example',
  employer_email: 'employer@example.com',
  employer_company: 'Example Ltd',
}
const PROVIDER = {
  id: 'p1',
  slug: 'example-provider',
  name: 'Example Provider',
  status: 'active',
  last_alert_state: 'ok',
  health_status: 'degraded',
  last_relevance_rate: null,
  last_error_message: null,
}

function onlyEmail(): string {
  expect(state.emails.length).toBe(1)
  return String(state.emails[0].html)
}

describe('G3 rendered staff e-mails', () => {
  it.each([
    ['ab', 'https://accountingbody.com', TODAY.jobAb],
    ['et', 'https://ethiotax.com', TODAY.jobEt],
  ])('job pending approval (%s): link from the setting, the rest byte-identical', async (platform, host, today) => {
    vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
    await sendAdminJobNotificationEmail({ ...JOB, platform: [platform] } as never)
    const html = onlyEmail()
    expect(html).toContain(`<a href="${host}/${TEST_ADMIN_PATH}/jobs?status=pending_approval" `)
    expect(html.split(TEST_ADMIN_PATH).length - 1).toBe(1)
    expect(holdsName(html)).toBe(false)
    expect(sha256(html)).toBe(today)
  })

  it.each([
    ['zero_fetch', 0, false, TODAY.providerZeroFetch],
    ['failing', 3, true, TODAY.providerPaused],
  ] as const)('provider alert (%s): link from the setting, the rest byte-identical', async (alert, failures, paused, today) => {
    vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
    await maybeSendProviderAlert(PROVIDER as never, alert, failures, paused)
    const html = onlyEmail()
    expect(html).toContain(`<a href="https://accountingbody.com/${TEST_ADMIN_PATH}/providers/example-provider" `)
    expect(html.split(TEST_ADMIN_PATH).length - 1).toBe(1)
    expect(holdsName(html)).toBe(false)
    expect(sha256(html)).toBe(today)
  })
})

// The backup banner of scripts/backup-supabase.sh is the heredoc between
// `cat <<'BANNER'` and `BANNER`; every line outside it must be byte-identical.
function outsideBanner(text: string): string {
  const out: string[] = []
  let inside = false
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  for (const line of lines) {
    if (!inside && line === "cat <<'BANNER'") {
      inside = true
      continue
    }
    if (inside && line === 'BANNER') {
      inside = false
      continue
    }
    if (!inside) out.push(line + '\n')
  }
  return out.join('')
}

// The removed areas by name, and `ab` / `et` written as area (schema) names.
const REMOVED_AREAS = /hrlake|birrbank|`(ab|et)`/i

describe('G4 backup texts', () => {
  it('the runbook and the backup banner no longer name the removed areas', () => {
    for (const file of ['docs/RUNBOOK.md', 'scripts/backup-supabase.sh']) {
      expect(read(file), file).not.toMatch(REMOVED_AREAS)
    }
    expect(read('docs/RUNBOOK.md')).toContain('`public` (articles, practice questions, courses, jobs, recruitment and contact submissions, subscribers, and the rest), and any new project area that appears;')
    expect(read('scripts/backup-supabase.sh')).toContain('Supabase sign-in records (none today)')
  })
  it('the backup script still parses and only its banner text changed', () => {
    execFileSync('bash', ['-n', join(ROOT, 'scripts/backup-supabase.sh')])
    expect(sha256(outsideBanner(read('scripts/backup-supabase.sh')))).toBe('813d6156849a166163f46de0fb577138ed3140c4cb1c6c015c3c4e3634e5efa8')
  })
  it('the restore script and the connection helper are unchanged in this job', () => {
    expect(sha256(read('scripts/restore-supabase.sh'))).toBe('32d2f6de317b853e99923b766f5f53b380ee48ab348dff28dc5f78b0cf5b7842')
    expect(sha256(read('scripts/lib/backup-connect.sh'))).toBe('2d6d6f60fa307b0ad7e5b45246cebb18fcdf6d9fa5222a77922a16df4b87f4b7')
  })
})

const REGISTER = `export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
`

describe('G5 Sentry request errors', () => {
  it('instrumentation.ts hands request errors to Sentry.captureRequestError', () => {
    expect(instrumentation.onRequestError).toBe(Sentry.captureRequestError)
    const text = read('instrumentation.ts')
    expect(text).toMatch(/^import \* as Sentry from '@sentry\/nextjs'$/m)
    expect(text).toMatch(/^export const onRequestError = Sentry\.captureRequestError$/m)
  })
  it('register() is unchanged', () => {
    expect(read('instrumentation.ts')).toContain(REGISTER)
    expect(typeof instrumentation.register).toBe('function')
  })
  it('the server and edge configs still pass every report through the privacy filter', () => {
    for (const file of ['sentry.server.config.ts', 'sentry.edge.config.ts']) {
      const text = read(file)
      expect(text, file).toContain("import { filterServerEvent, filterServerSpan, filterServerTransaction } from './lib/sentry-privacy'")
      expect(text, file).toContain('beforeSend: filterServerEvent,')
      expect(text, file).not.toMatch(/sendDefaultPii/)
    }
  })
})

describe('G6 nothing else changed', () => {
  it.each([
    // BP-2 (B): getAdminPath treats an empty ADMIN_PATH like unset.
    ['lib/middleware-logic.ts', 'e0378e7b89ad5007cf928664444f0d322620a534051d96fcb63421854f130612'],
    ['middleware.ts', 'd93412b73d16b115b288ab6d78999e2f3982a3485ada3c135a7c70122b14e92c'],
    ['vercel.json', 'c333bf786950054aca5ae357e5a9a48d9e475e724603a97e8d2a79b005bb299a'],
    // B2 (D320): two redirects for the one course with a new address.
    ['next.config.mjs', 'e31f74a28cdcad170ae1e458a19a11fc7136a71ec3038cd192d09e3b4d6e030f'],
    ['sentry.server.config.ts', '7606957e849e77260a359d7166ab7e42b71e4ef8a505e7d84a84897c7fe016ae'],
    ['sentry.edge.config.ts', 'efe89985aee63f30fb79756e54b67bbaf129eac738a3f49cebeb4b41b616bfc1'],
    ['sentry.client.config.ts', '531cbd1f11d15db6585d27e71059f011a04d7ea9083dadcdb72173c7c0b39006'],
    ['lib/sentry-privacy.ts', '55f1f03c3d36d8eaa8035004dc564ba58f2fb0c22a3535aac8cfaf01d8e4221d'],
    ['app/api/ingest/[slug]/route.test.ts', '99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627'],
  ])('%s is byte-identical', (file, hash) => {
    expect(sha256(readFileSync(join(ROOT, file)))).toBe(hash)
  })
})
