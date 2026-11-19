import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// vitest compiles .tsx with the classic JSX transform, which reads a global
// React (as lib/error-page.test.ts does); Next's own build does not need this.
;(globalThis as { React?: typeof React }).React = React

// ET-1 (owner decision D248): on EthioTax the brand name in these template
// texts becomes "EthioTax" and every other word stays the same; Accounting
// Body text is unchanged (only doubled title suffixes are reduced to one).
// Brand names come from lib/brand.ts. Changed JSX text is written as one
// template-literal text node, so Accounting Body HTML stays byte-identical.

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) =>
    createElement('a', { href, className }, children as never),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
vi.mock('@/components/PersonCheck', () => ({ default: () => null }))

import { ApplyButton } from '@/app/jobs/[slug]/ApplyButton'
import JobsHubClient from '@/app/jobs/JobsHubClient'
import JoinPage from '@/app/firms-freelancers/join/page'
import type { Job } from '@/lib/jobs'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('template text names the brand through lib/brand.ts', () => {
  const swaps: [string, string[], string[]][] = [
    ['components/layout/Footer.tsx',
      ['                Accounting Body — jobs, placement and practice for accounting and finance professionals.\n'],
      ['{`${brandName(isEthioTax)} — jobs, placement and practice for accounting and finance professionals.`}']],
    ['components/layout/Navigation.tsx',
      ['whitespace-nowrap">Accounting Body</span>'],
      ['<span className="font-display text-xl text-navy-950 whitespace-nowrap">{brandName(Boolean(isEthioTax))}</span>']],
    ['app/jobs/JobsHubClient.tsx',
      ["const platformName = 'Accounting Body'"],
      ['const platformName = brandName(isEthioTax)']],
    ['app/jobs/[slug]/ApplyButton.tsx',
      ["return 'Apply on Accounting Body'"],
      ['return `Apply on ${brandName(isEthioTax)}`', 'const label = getApplyLabel(job, isEthioTax)']],
    ['app/jobs/[slug]/ApplyBarWithSticky.tsx',
      ['<ApplyButton job={job} />', '<ApplyButton job={job} size="compact" />'],
      ['<ApplyButton job={job} isEthioTax={isEthioTax} />', '<ApplyButton job={job} isEthioTax={isEthioTax} size="compact" />']],
    ['app/jobs/[slug]/page.tsx',
      ['<ApplyBarWithSticky job={job} />'],
      ['<ApplyBarWithSticky job={job} isEthioTax={isEthioTax} />']],
    ['app/search/page.tsx',
      ['aria-label="Search Accounting Body"'],
      ['aria-label={`Search ${brandName(isEthioTax)}`}']],
    ['app/glossary/page.tsx',
      ['Every term on Accounting Body is written or'],
      ['{`The internet is full of accounting content written by people who have never sat an exam. Every term on ${platformName} is written or reviewed by a qualified accountant. We have been trusted by students since 2018.`}']],
    ['app/firms-freelancers/page.tsx',
      ["'Accounting Body manages the full client journey.", "'All work delivered through Accounting Body is subject", "'Accounting Body manages all client-facing communication'", "'Accounting Body handles billing and client management'"],
      ['`${platformName} manages the full client journey.', '`All work delivered through ${platformName} is subject', '`${platformName} manages all client-facing communication`', '`${platformName} handles billing and client management`']],
    ['app/firms-freelancers/join/page.tsx',
      ['>Accounting Body Professionals</span>', 'Acceptance into the Accounting Body professional network'],
      ['{`${platformName} Professionals`}', 'Acceptance into the ${platformName} professional network is subject to satisfactory completion of our vetting process.`}', 'isEthioTaxBrowser(document.cookie, window.location.hostname)']],
    ['app/contact/page.tsx',
      ["'Contact Accounting Body — Get in Touch'", 'with the Accounting Body team', "'Is Accounting Body really free?'", "'How do I engage Accounting Body for professional services?'", '>Contact Accounting Body</h1>'],
      ['`Contact ${name} — Get in Touch`', 'Get in touch with the ${name} team — we reply within 2 business days.`', '`Is ${name} really free?`', '`How do I engage ${name} for professional services?`', '{`Contact ${name}`}</h1>']],
    ['app/free-courses/[slug]/page.tsx',
      ['>Accounting Body Editorial Team</p>'],
      ['{`${name} Editorial Team`}</p>']],
    ['app/free-courses/[slug]/learn/[lessonSlug]/page.tsx',
      ['>Accounting Body Editorial Team</strong>'],
      ['{`${brandName(isEthioTax)} Editorial Team`}</strong>']],
    ['app/jobs/listings/structured-data.tsx',
      ["name: 'Accounting & Finance Jobs | Accounting Body'"],
      ['name: `Accounting & Finance Jobs | ${brandName(isEthioTax)}`']],
    ['app/jobs/listings/page.tsx',
      ['<JobListingsStructuredData />'],
      ['<JobListingsStructuredData isEthioTax={isEthioTax} />']],
    ['app/jobs/post-a-job/page.tsx',
      ["'Post a Job | AccountingBody — Accounting & Finance Recruitment'", 'vacancy on AccountingBody.'],
      ['`Post a Job | ${brand.compactName} — Accounting & Finance Recruitment`', 'vacancy on ${brand.compactName}.']],
  ]

  for (const [file, gone, present] of swaps) {
    it(`${file}: the fixed Accounting Body text is gone and the brand form is present`, () => {
      const src = read(file)
      for (const g of gone) expect(src, g).not.toContain(g)
      for (const p of present) expect(src, p).toContain(p)
    })
  }
})

describe('page titles carry one brand suffix (the root template adds it)', () => {
  const titleFiles = [
    'app/jobs/listings/page.tsx', 'app/practice-questions/page.tsx', 'app/practice-questions/[slug]/page.tsx',
    'app/study/page.tsx', 'app/study/[category]/page.tsx', 'app/study/[category]/[slug]/page.tsx',
    'app/free-courses/page.tsx', 'app/free-courses/[slug]/page.tsx', 'app/free-courses/[slug]/learn/[lessonSlug]/page.tsx',
    'app/glossary/page.tsx', 'app/dictionary/page.tsx', 'app/mock-exams/page.tsx', 'app/mock-exams/[category]/page.tsx',
    'app/study/mock-exams/page.tsx', 'app/jobs/guarantee/page.tsx', 'app/jobs/how-it-works/page.tsx',
    'app/jobs/find-work/manage/page.tsx', 'app/jobs/hire-talent/manage/page.tsx', 'app/jobs/manage-listing/page.tsx',
    'app/jobs/post-a-job/page.tsx', 'app/contact/page.tsx',
  ]
  const BARE_SUFFIX = /\| (Accounting Body|AccountingBody|EthioTax)['`"]/

  for (const file of titleFiles) {
    it(`${file}: no title literal ends with a hard-coded brand suffix, and no title hard-codes Accounting Body`, () => {
      const src = read(file)
      const titles = src.split('\n').filter((l) => /^\s*(title:|\? `|: '|: `)/.test(l) || /\btitle:\s/.test(l))
      for (const line of titles) {
        expect(line, line).not.toMatch(BARE_SUFFIX)
        expect(line, line).not.toMatch(/title:[^\n]*Accounting ?Body/)
      }
    })
  }

  const expected: [string, string][] = [
    ['app/jobs/listings/page.tsx', "title: 'Accounting & Finance Jobs',"],
    ['app/practice-questions/page.tsx', "title:       'Practice Questions',"],
    ['app/practice-questions/[slug]/page.tsx', 'title:       `${qset.title} | ${name} Practice Questions`,'],
    ['app/study/page.tsx', "title: 'Study Notes',"],
    ['app/study/[category]/page.tsx', 'title: `${meta.name} Study Notes`,'],
    ['app/study/[category]/[slug]/page.tsx', 'title:       article.title,'],
    ['app/free-courses/page.tsx', "title: 'Free Accounting Courses',"],
    ['app/free-courses/[slug]/page.tsx', "if (!course) return { title: 'Course Not Found' }"],
    ['app/free-courses/[slug]/page.tsx', 'title: course.title,'],
    ['app/free-courses/[slug]/learn/[lessonSlug]/page.tsx', "if (!data) return { title: 'Lesson Not Found' }"],
    ['app/free-courses/[slug]/learn/[lessonSlug]/page.tsx', 'title: `${data.lesson.title} — ${data.course.title}`,'],
    ['app/glossary/page.tsx', "title: 'Accounting Glossary',"],
    ['app/dictionary/page.tsx', 'title: `${title} — Accounting Dictionary`,'],
    ['app/dictionary/page.tsx', '? `Accounting Dictionary — ${letter}`'],
    ['app/dictionary/page.tsx', ": 'Accounting Dictionary & Glossary',"],
    ['app/mock-exams/page.tsx', "title: 'Mock Exams',"],
    ['app/mock-exams/[category]/page.tsx', 'title: `${title} Mock Exam`,'],
    ['app/study/mock-exams/page.tsx', "title: 'Mock Exams | ETICPA ATQ',"],
    ['app/jobs/guarantee/page.tsx', 'title: `Our Guarantee | ${name} Recruitment`,'],
    ['app/jobs/how-it-works/page.tsx', 'title: `How It Works | ${name} Recruitment`,'],
    ['app/jobs/find-work/manage/page.tsx', 'title: `Manage Your Candidate Profile | ${name} Recruitment`,'],
    ['app/jobs/hire-talent/manage/page.tsx', 'title: `Manage Your Hiring Brief | ${name} Recruitment`,'],
    ['app/jobs/manage-listing/page.tsx', "title: 'Manage Your Job Listing',"],
  ]
  for (const [file, line] of expected) {
    it(`${file}: ${line}`, () => {
      expect(read(file)).toContain(line)
    })
  }
})

describe('items left as they are (OUT of ET-1)', () => {
  it('keeps the Accounting Body footer legal line; EthioTax reads the D253 line (ET-2)', () => {
    const src = read('components/layout/Footer.tsx')
    expect(src).toContain('© {new Date().getFullYear()} AccountingBody Ltd. All rights reserved.{\' \'}')
    expect(src).toContain('Registered in England &amp; Wales.')
    expect(src).toContain('{isEthioTax ? `© ${new Date().getFullYear()} EthioTax. All rights reserved.` : (')
  })
  it('keeps the join-page declaration', () => {
    expect(read('app/firms-freelancers/join/page.tsx')).toContain('Accounting Body reserves the right to verify all credentials independently.')
  })
  it('keeps the jobs-listing JSON-LD address', () => {
    expect(read('app/jobs/listings/structured-data.tsx')).toContain("url: 'https://accountingbody.com/jobs/listings',")
  })
  it('keeps the Accounting Body find-work description that names both brands; EthioTax names EthioTax only (ET-2)', () => {
    const src = read('app/jobs/find-work/page.tsx')
    expect(src).toContain(": 'Register as a candidate with Accounting Body or EthioTax.")
    expect(src).toContain("? 'Register as a candidate with EthioTax. We place")
  })
  it('keeps every sending and contact address in the two e-mail routes', () => {
    const manage = read('app/api/jobs/manage/route.ts')
    const hook = read('app/api/jobs/employer/webhook/route.ts')
    expect(manage.split('noreply@accountingbody.com').length - 1).toBe(1)
    expect(manage.split('info@accountingbody.com').length - 1).toBe(1)
    expect(hook.split('noreply@accountingbody.com').length - 1).toBe(1)
  })
  it('keeps how the brand is decided: the root layout header and its title template', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain("headersList.get('x-et-platform') === 'ethiotax'")
    expect(layout).toContain("template: isEthioTax ? '%s | EthioTax' : '%s | Accounting Body',")
  })
})

const job = (over: Partial<Job>) => ({ id: 'j1', title: 'T', apply_method: 'platform', application_url: null, application_email: null, company_name: 'C', ...over }) as unknown as Job

describe('rendered labels', () => {
  it('ApplyButton names the brand for a job applied for on the site', () => {
    expect(renderToStaticMarkup(createElement(ApplyButton, { job: job({}), isEthioTax: true }))).toContain('>Apply on EthioTax</span>')
    expect(renderToStaticMarkup(createElement(ApplyButton, { job: job({}), isEthioTax: false }))).toContain('>Apply on Accounting Body</span>')
  })
  it('ApplyButton keeps the employer and e-mail labels on both brands', () => {
    for (const isEthioTax of [true, false]) {
      expect(renderToStaticMarkup(createElement(ApplyButton, { job: job({ apply_method: 'external', application_url: 'https://example.com/a' }), isEthioTax }))).toContain('>Apply on C</span>')
      expect(renderToStaticMarkup(createElement(ApplyButton, { job: job({ apply_method: 'email', application_email: 'a@example.com' }), isEthioTax }))).toContain('>Email your application</span>')
    }
  })
  it('the jobs hub sentence names the brand', () => {
    const tail = ' sits in the middle of every placement. Neither side deals with the other directly — we manage every introduction, negotiation, and guarantee.'
    expect(renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: true, jobCount: 10 }))).toContain('EthioTax' + tail)
    const ab = renderToStaticMarkup(createElement(JobsHubClient, { isEthioTax: false, jobCount: 10 }))
    expect(ab).toContain('Accounting Body' + tail)
  })
  it('the join page first render keeps the Accounting Body wording exactly', () => {
    const html = renderToStaticMarkup(createElement(JoinPage))
    expect(html).toContain('>Accounting Body Professionals</span>')
    expect(html).toContain('>All applications are reviewed individually by our team. Acceptance into the Accounting Body professional network is subject to satisfactory completion of our vetting process.</p>')
    expect(html).not.toContain('EthioTax Professionals')
  })
})
