import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import type { ComponentType, ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// PRIV-3 S3 (PRIV-4; D352, D358): a short privacy note under the submit button of the 11 public forms,
// the new contact and footer sentence, and the new job-seeker tick and biography hint.
;(globalThis as { React?: typeof React }).React = React

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('notFound') },
}))

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const count = (s: string, sub: string) => s.split(sub).length - 1
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const NOTE = 'We use these details only to deal with your request. See our Privacy Policy.'
const CONTACT_LINE = 'See how we use your details in our Privacy Policy.'
const TICK = 'I have read the Privacy Policy. I understand you will share my profile with an employer only after telling me.'
const HINT = 'Please do not include health, religion or other sensitive details.'

// The 11 forms (STEP C list). Company formation is one form with a component per brand.
const FORM_FILES: Array<{ file: string; submit: string }> = [
  { file: 'components/EmailSignupForm.tsx', submit: "'Subscribe free'" },
  { file: 'app/get-help/accounting-bookkeeping/page.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/audit-assurance/page.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/business-consulting/page.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/financial-planning-advisory/page.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/payroll-services/page.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/tax-filing-compliance/page.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/company-formation/_client.tsx', submit: "'Submit Enquiry →'" },
  { file: 'app/get-help/_service-page-client.tsx', submit: "'Submit Service Brief →'" },
  { file: 'app/firms-freelancers/join/page.tsx', submit: "'Submit Application'" },
  { file: 'app/jobs/hire-talent/HireTalentClient.tsx', submit: "'Submit Hiring Brief'" },
  { file: 'app/jobs/post-a-job/PostAJobClient.tsx', submit: 'Post Job & Pay £9' },
]

describe('PRIV-3 S3: the privacy note component', () => {
  it('says the approved sentence, links "Privacy Policy" to /privacy-policy, and is server-safe', async () => {
    const { default: PrivacyNote, PRIVACY_NOTE_TEXT } = await import('@/components/PrivacyNote')
    expect(PRIVACY_NOTE_TEXT).toBe(NOTE)
    const html = renderToStaticMarkup(React.createElement(PrivacyNote))
    expect(text(html)).toBe(NOTE)
    expect(html).toMatch(/^<p class="text-xs text-slate-500 text-center">/)
    expect(html).toMatch(/<a [^>]*href="\/privacy-policy"[^>]*>Privacy Policy<\/a>\.<\/p>$/)
    expect(html).toContain('class="underline hover:text-navy-700 transition-colors"')
    const src = read('components/PrivacyNote.tsx')
    expect(src).not.toContain("'use client'")
    expect(src).not.toMatch(/\buse(State|Effect|Ref|Memo|Callback)\b|\bon[A-Z][a-zA-Z]+=/)
  })
})

describe('PRIV-3 S3: the note sits under the submit button of each of the 11 forms, once', () => {
  it.each(FORM_FILES)('$file', ({ file, submit }) => {
    const src = read(file)
    expect(count(src, "import PrivacyNote from '@/components/PrivacyNote'")).toBe(1)
    expect(count(src, '<PrivacyNote')).toBe(1)
    const button = src.indexOf(submit)
    const note = src.indexOf('<PrivacyNote')
    expect(button).toBeGreaterThan(-1)
    expect(note).toBeGreaterThan(button)
  })

  it('the forms not in the list have no note (contact, footer, job-seeker forms)', () => {
    for (const f of ['app/contact/ContactForm.tsx', 'components/layout/Footer.tsx', 'app/jobs/find-work/FindWorkClient.tsx', 'app/freelancing-pathways/FreelancingPathwaysClient.tsx']) {
      expect(read(f)).not.toContain('PrivacyNote')
    }
  })

  it('renders exactly once on the forms shown on first load (home sign-up, get-help pages, company formation on both brands)', async () => {
    const render = (C: ComponentType<Record<string, unknown>>, props: Record<string, unknown> = {}) =>
      text(renderToStaticMarkup(React.createElement(C, props) as ReactElement))
    const signup = (await import('@/components/EmailSignupForm')).default as ComponentType<Record<string, unknown>>
    for (const isEthioTax of [false, true]) expect(count(render(signup, { isEthioTax }), NOTE)).toBe(1)
    for (const slug of ['accounting-bookkeeping', 'audit-assurance', 'business-consulting', 'financial-planning-advisory', 'payroll-services', 'tax-filing-compliance']) {
      const Page = (await import(`@/app/get-help/${slug}/page`)).default as ComponentType<Record<string, unknown>>
      expect(count(render(Page), NOTE)).toBe(1)
    }
    const Et = (await import('@/app/get-help/company-formation/_client')).default as ComponentType<Record<string, unknown>>
    expect(count(render(Et), NOTE)).toBe(1)
    const Shared = (await import('@/app/get-help/_service-page-client')).default as ComponentType<Record<string, unknown>>
    for (const isEthioTax of [false, true]) expect(count(render(Shared, { params: { slug: 'company-formation' }, isEthioTax }), NOTE)).toBe(1)
  })

  it('the home sign-up keeps its dark-section look: the small print and the footer brand links', () => {
    const src = read('components/EmailSignupForm.tsx')
    expect(src).toContain('className="text-white/70 text-xs text-center"')
    expect(read('app/page.tsx')).toContain('<p className="text-white/70 text-xs text-center">')
    const link = "isEthioTax ? 'text-gold-400 underline hover:decoration-2' : 'text-[#C9982A] underline hover:text-[#e0b84e]'"
    expect(src).toContain(link)
    expect(read('components/layout/Footer.tsx')).toContain(link)
  })
})

describe('PRIV-3 S3: contact and footer sentence', () => {
  it('the contact form small print is exact, with the same link', async () => {
    const src = read('app/contact/ContactForm.tsx')
    expect(src).toContain('See how we use your details in our{" "}\n                <a href="/privacy-policy" className="underline hover:text-navy-700 transition-colors">Privacy Policy</a>.')
    const Contact = (await import('@/app/contact/ContactForm')).default as ComponentType<Record<string, unknown>>
    for (const isEthioTax of [false, true]) {
      const t = text(renderToStaticMarkup(React.createElement(Contact, { isEthioTax }) as ReactElement))
      expect(count(t, CONTACT_LINE)).toBe(1)
      expect(t).not.toContain('By submitting this form you agree to our')
    }
  })

  it('the footer newsletter small print is exact, with the brand link classes kept', () => {
    const src = read('components/layout/Footer.tsx')
    expect(src).toContain("See how we use your details in our{' '}\n            <Link href=\"/privacy-policy\" className={isEthioTax ? 'text-gold-400 underline hover:decoration-2' : 'text-[#C9982A] underline hover:text-[#e0b84e]'}>Privacy Policy</Link>.")
    expect(src).not.toContain('By subscribing you agree to our')
  })

  it('"you agree to our Privacy Policy" appears nowhere in app/ or components/ outside tests', () => {
    const files = execFileSync('git', ['ls-files', '--', 'app', 'components'], { encoding: 'utf8' }).split('\n')
      .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.test\.(tsx?|jsx?)$/.test(f))
    expect(files.length).toBeGreaterThan(100)
    const hits = files.filter((f) => /agree to our\s*(\{["'] ["']\}\s*)?(<[^>]+>\s*)?Privacy Policy/.test(read(f)) || read(f).includes('you agree to our'))
    expect(hits).toStrictEqual([])
  })
})

describe('PRIV-3 S3: job-seeker tick and biography hint', () => {
  const FORMS = ['app/jobs/find-work/FindWorkClient.tsx', 'app/freelancing-pathways/FreelancingPathwaysClient.tsx']
  it.each(FORMS)('%s: the new tick label, the hint under the biography box, the Terms tick unchanged', (file) => {
    const src = read(file)
    const flat = src.replace(/\{' '\}\s*/g, ' ').replace(/<Link [^>]*>([^<]*)<\/Link>/g, '$1').replace(/\s+/g, ' ')
    expect(count(flat, TICK)).toBe(1)
    expect(src).toContain('<Link href="/privacy-policy" className="underline text-navy-700 hover:text-gold-600">Privacy Policy</Link>. I understand')
    expect(src).not.toContain('I consent to')
    expect(src).not.toContain('holding and processing my personal data')
    // the state names stay
    expect(src).toContain('checked={dataConsent}')
    expect(src).toMatch(/data_consent: +dataConsent,/)
    // the hint, directly under the textarea, in the form's help-text classes
    expect(count(src, `<p className="text-sm text-slate-500">${HINT}</p>`)).toBe(1)
    const textarea = src.indexOf('<textarea aria-labelledby={ids.id(\'biography\')}')
    const close = src.indexOf('/>', textarea)
    const hint = src.indexOf(HINT)
    expect(textarea).toBeGreaterThan(-1)
    expect(src.slice(close + 2, hint).trim()).toBe('<p className="text-sm text-slate-500">')
    // the Terms tick is unchanged
    expect(src).toContain("I confirm that I have read and agree to the{' '}")
    expect(src).toMatch(/<Link href="\/terms" className="underline text-navy-700 hover:text-gold-600">(Job Seeker Registration Terms|Terms of Service)<\/Link>\./)
    expect(src).toMatch(/terms_agreed: +termsAgreed,/)
  })
})
