import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ET-1 (owner decision D248): the listing-withdrawn and refund e-mails name
// the job's own brand. EthioTax-only jobs say "EthioTax"; every other job
// (Accounting Body, shared, empty or unknown platform) keeps today's text
// byte for byte. The sending addresses never change. Nothing is sent: the
// e-mail client and the data layer are replaced by recorders.

const state = vi.hoisted(() => ({
  emails: [] as Record<string, unknown>[],
  job: null as Record<string, unknown> | null,
  selects: [] as string[],
}))

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
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('@/lib/jobEmails', () => ({
  sendJobConfirmationEmail: async () => {},
  sendAdminJobNotificationEmail: async () => {},
}))
vi.mock('@/lib/jobs', () => ({
  getJobByManageToken: async () => ({ ...state.job, status: 'active' }),
  closeJobByManageToken: async () => ({ ...state.job, status: 'closed' }),
  markJobPaid: async () => null,
}))
vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: () => ({
    from: () => {
      const chain = {
        update: () => chain,
        eq: () => chain,
        select: (columns: string) => {
          state.selects.push(columns)
          return chain
        },
        single: async () => ({ data: state.job, error: null }),
      }
      return chain
    },
  }),
}))

import { POST as managePost } from '@/app/api/jobs/manage/route'
import { POST as webhook } from '@/app/api/jobs/employer/webhook/route'

const WEBHOOK_TEST_VALUE = 'webhook-test-value'
const JOB = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  title: 'Senior Accountant',
  company_name: 'Example Ltd',
  employer_email: 'employer@example.com',
  employer_name: 'Sam Example',
}

function withPlatform(platform: unknown): Record<string, unknown> {
  const job: Record<string, unknown> = { ...JOB }
  if (platform !== undefined) job.platform = platform
  return job
}

async function withdraw() {
  const req = new NextRequest('https://accountingbody.com/api/jobs/manage', {
    method: 'POST',
    body: JSON.stringify({ token: 'manage-token-1', action: 'close' }),
    headers: { 'content-type': 'application/json' },
  })
  const res = await managePost(req)
  expect(res.status).toBe(200)
}

async function refund() {
  const raw = JSON.stringify({ meta: { custom_data: { job_id: JOB.id } } })
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_TEST_VALUE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const req = new NextRequest('https://accountingbody.com/api/jobs/employer/webhook', {
    method: 'POST',
    body: raw,
    headers: { 'X-Signature': signature, 'X-Event-Name': 'order_refunded' },
  })
  const res = await webhook(req)
  expect(res.status).toBe(200)
}

beforeEach(() => {
  state.emails = []
  state.selects = []
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', WEBHOOK_TEST_VALUE)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const AB_WITHDRAWN = {
  from: 'Accounting Body <noreply@accountingbody.com>',
  to: 'employer@example.com',
  subject: 'Your job listing has been withdrawn — AccountingBody',
  html: '<p>Your listing for Senior Accountant at Example Ltd has been withdrawn from AccountingBody.</p><p>If this was a mistake, please contact us at info@accountingbody.com.</p>',
}

describe('listing-withdrawn e-mail', () => {
  it('names EthioTax for an EthioTax job; the addresses stay', async () => {
    state.job = withPlatform(['et'])
    await withdraw()
    expect(state.emails).toEqual([
      {
        from: 'EthioTax <noreply@accountingbody.com>',
        to: 'employer@example.com',
        subject: 'Your job listing has been withdrawn — EthioTax',
        html: '<p>Your listing for Senior Accountant at Example Ltd has been withdrawn from EthioTax.</p><p>If this was a mistake, please contact us at info@accountingbody.com.</p>',
      },
    ])
  })

  for (const [label, platform] of [
    ['Accounting Body', ['ab']],
    ['shared', ['ab', 'et']],
    ['empty', []],
    ['missing', undefined],
    ['unknown', 'xx'],
  ] as const) {
    it(`keeps today's text exactly for a ${label} platform`, async () => {
      state.job = withPlatform(platform)
      await withdraw()
      expect(state.emails).toEqual([AB_WITHDRAWN])
    })
  }
})

const refundBody = '<p>Dear Sam,</p><p>Your payment for the listing "Senior Accountant" at Example Ltd has been refunded, and the listing has been closed.</p><p>If you believe this is an error, please contact us.</p>'

describe('refund e-mail', () => {
  it('reads the job platform with the refunded row', async () => {
    state.job = withPlatform(['et'])
    await refund()
    expect(state.selects).toEqual(['employer_email, employer_name, title, company_name, platform'])
  })

  it('uses the EthioTax sender name for an EthioTax job; address, subject and body unchanged', async () => {
    state.job = withPlatform(['et'])
    await refund()
    expect(state.emails).toEqual([
      { from: 'EthioTax <noreply@accountingbody.com>', to: 'employer@example.com', subject: 'Your job listing has been refunded', html: refundBody },
    ])
  })

  for (const [label, platform] of [
    ['Accounting Body', ['ab']],
    ['shared', ['ab', 'et']],
    ['missing', undefined],
  ] as const) {
    it(`keeps today's e-mail exactly for a ${label} platform`, async () => {
      state.job = withPlatform(platform)
      await refund()
      expect(state.emails).toEqual([
        { from: 'Accounting Body <noreply@accountingbody.com>', to: 'employer@example.com', subject: 'Your job listing has been refunded', html: refundBody },
      ])
    })
  }
})
