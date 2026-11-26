import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// SEO-1 S3 (owner decisions D348 item 1, D350 D): /llms.txt, one file per
// brand, on a fake network.

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
}))
const C = vi.hoisted(() => ({ articles: 2017, sets: 181, questions: 3963, courses: [7, 103] as [number, number], fail: false }))
vi.mock('@/lib/db', () => ({
  getCachedPublishedArticleCount: vi.fn(async () => C.articles),
  getQuestionSetCount: vi.fn(async () => C.sets),
  getPublishedQuestionCount: vi.fn(async () => C.questions),
}))
vi.mock('@/lib/coursesNew', () => ({
  getPublishedCoursesOrThrow: vi.fn(async () => {
    if (C.fail) throw new Error('read failed')
    const [n, lessons] = C.courses
    return Array.from({ length: n }, (_, i) => ({ lessonCount: i === 0 ? lessons : 0 }))
  }),
}))

import { GET } from './route'
import * as db from '@/lib/db'

const ROOT = process.cwd()

async function get(view: 'ab' | 'et') {
  H.map.clear()
  if (view === 'et') H.map.set('x-et-platform', 'ethiotax')
  const res = await GET()
  return { res, text: await res.text() }
}

const links = (text: string) => Array.from(text.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)/gm)).map(m => [m[1], m[2]] as const)
const headings = (text: string) => text.split('\n').filter(l => l.startsWith('#'))

// A path is a real page when every segment matches a folder (or a [param]
// folder) and the last folder holds a page or route file.
function isRealPage(path: string): boolean {
  let dir = join(ROOT, 'app')
  for (const seg of path.split('/').filter(Boolean)) {
    if (existsSync(join(dir, seg))) { dir = join(dir, seg); continue }
    const param = readdirSync(dir).find(n => n.startsWith('[') && !n.startsWith('[['))
    if (!param) return false
    dir = join(dir, param)
  }
  return ['page.tsx', 'route.ts'].some(f => existsSync(join(dir, f)))
}

beforeEach(() => {
  C.articles = 2017; C.sets = 181; C.questions = 3963; C.courses = [7, 103]; C.fail = false
  vi.mocked(db.getCachedPublishedArticleCount).mockClear()
})

describe('Accounting Body /llms.txt', () => {
  it('plain text, never in a shared cache, varies by brand', async () => {
    const { res } = await get('ab')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('private, max-age=3600')
    expect(res.headers.get('vary')).toBe('x-et-platform')
  })

  it('exact opening: H1, summary, the live counts sentence', async () => {
    const { text } = await get('ab')
    expect(text.split('\n').slice(0, 6)).toEqual([
      '# Accounting Body',
      '',
      '> Free study notes, practice questions, mock exams and courses for accounting students preparing for ACCA, CIMA, AAT and ICAEW exams, plus accounting and finance jobs, a network of firms and freelancers, and professional help for businesses. All learning is free and needs no account.',
      '',
      "Accounting Body publishes 2,017 study articles written or reviewed by qualified accountants, 181 practice question sets with 3,963 exam-style questions and worked explanations, timed mock exams, and 7 free courses with 103 lessons. Course progress is kept in the learner's own browser.",
      '',
    ])
    expect(db.getCachedPublishedArticleCount).toHaveBeenCalledWith('ab')
  })

  it('exact sections and links, all on accountingbody.com, all real public pages', async () => {
    const { text } = await get('ab')
    expect(headings(text)).toEqual(['# Accounting Body', '## Study by qualification', '## Practice questions', '## Mock exams', '## Free courses',
      '## Dictionary and glossary', '## Calculators', '## Jobs', '## Firms and freelancers', '## Get help', '## About and contact', '## Optional'])
    const paths = links(text).map(([, url]) => url)
    expect(paths).toHaveLength(36)
    for (const url of paths) {
      expect(url.startsWith('https://accountingbody.com/')).toBe(true)
      const path = url.slice('https://accountingbody.com'.length)
      expect(path).not.toMatch(/^\/api\//)
      expect(isRealPage(path), path).toBe(true)
    }
    expect(paths.filter(u => u.includes('/mock-exams/'))).toHaveLength(8)
    expect(text).toContain('- [Practice questions](https://accountingbody.com/practice-questions): 181 free question sets with instant marking and explanations')
    expect(text).toContain('- [Free courses](https://accountingbody.com/free-courses): 7 structured courses, 103 lessons, no registration')
    // EthioTax-owned pages are in EthioTax's file only.
    expect(text).not.toMatch(/ethiotax\.com|\/faq\)|\/how-it-works\)|\/get-help\/|eticpa/i)
    expect(text.split('\n').length).toBeLessThanOrEqual(120)
    expect(text.endsWith('\n')).toBe(true)
  })

  it('failed count reads: the sentences keep no number', async () => {
    C.articles = 0; C.sets = 0; C.questions = 0; C.fail = true
    const { res, text } = await get('ab')
    expect(res.status).toBe(200)
    expect(text.split('\n')[4]).toBe("Accounting Body publishes study articles written or reviewed by qualified accountants, practice question sets with exam-style questions and worked explanations, timed mock exams, and free courses. Course progress is kept in the learner's own browser.")
    expect(text).toContain('- [Practice questions](https://accountingbody.com/practice-questions): free question sets with instant marking and explanations')
    expect(text).toContain('- [Free courses](https://accountingbody.com/free-courses): structured courses, no registration')
    expect(text).not.toMatch(/\b0 /)
  })
})

describe('EthioTax /llms.txt', () => {
  it('its own file: EthioTax pages only, on ethiotax.com, no database read', async () => {
    const { res, text } = await get('et')
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(text.split('\n').slice(0, 3)).toEqual([
      '# EthioTax',
      '',
      '> Accounting, tax and business consulting for the Ethiopian community in the UK and worldwide, plus free ETICPA study notes and mock exams. All learning is free and needs no account.',
    ])
    expect(headings(text)).toEqual(['# EthioTax', '## Services', '## ETICPA study', '## Firms and freelancers', '## About', '## Optional'])
    const all = links(text)
    expect(all.map(([name]) => name)).toEqual(['Get help', 'Tax filing and compliance', 'Accounting and bookkeeping', 'Business consulting', 'Payroll services',
      'Company formation', 'Audit and assurance', 'Financial planning and advisory', 'How it works', 'ETICPA', 'ATQ Level 1', 'ATQ Level 2', 'CPA',
      'Mock exams', 'Firms and freelancers', 'Apply to join', 'About EthioTax', 'FAQ', 'Terms'])
    for (const [, url] of all) {
      expect(url.startsWith('https://ethiotax.com/')).toBe(true)
      expect(isRealPage(url.slice('https://ethiotax.com'.length)), url).toBe(true)
    }
    expect(text).not.toContain('accountingbody.com')
    expect(db.getCachedPublishedArticleCount).not.toHaveBeenCalled()
    expect(text.split('\n').length).toBeLessThanOrEqual(120)
  })
})

describe('the route is listed as a public segment', () => {
  it('llms.txt is in PUBLIC_PAGE_SEGMENTS', async () => {
    const { PUBLIC_PAGE_SEGMENTS } = await import('@/lib/sentry-browser-privacy')
    expect(PUBLIC_PAGE_SEGMENTS).toContain('llms.txt')
  })
})
