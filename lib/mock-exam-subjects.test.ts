import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import React, { type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('React', React)

// ME-1 S3: one list of the AB mock-exam subjects, and "Coming soon" for a
// subject whose question bank is under 50 questions: a card with no link on
// the hub, a "not open yet" intro on its page (same address, no redirect).

const P = vi.hoisted(() => ({ sizes: new Map<string, number | null>() }))
vi.mock('@/lib/mock-exam-pool', () => ({
  getAbMockPoolSize: vi.fn(async (category: string) => (P.sizes.has(category) ? P.sizes.get(category) : 500)),
  getEticpaMockPoolSize: vi.fn(async (_level: string, module: string) => (P.sizes.has(module) ? P.sizes.get(module) : 300)),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`) }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

import {
  MOCK_EXAM_OPEN_MIN, MOCK_EXAM_SUBJECTS, findMockExamSubject, getMockExamSubjectStates, getOpenEticpaModuleCount,
  getOpenMockExamSubjects, isOpenPool,
} from './mock-exam-subjects'
import HubPage from '@/app/mock-exams/page'
import SubjectPage from '@/app/mock-exams/[category]/page'

const EMPTY = ['financial-market', 'business-management', 'taxation', 'economics']
const ROOT = process.cwd()

beforeEach(() => {
  P.sizes.clear()
})

const hubHtml = async () => renderToStaticMarkup((await HubPage()) as ReactElement)
const subjectHtml = async (category: string) =>
  renderToStaticMarkup((await SubjectPage({ params: Promise.resolve({ category }) })) as ReactElement)

describe('one subject list', () => {
  it('holds the 8 subjects in the hub order', () => {
    expect(MOCK_EXAM_SUBJECTS.map(s => s.title)).toEqual([
      'Financial Accounting', 'Financial Management', 'Management Accounting', 'Financial Market',
      'Business Management', 'Audit and Assurance', 'Tax', 'Economics'])
    expect(new Set(MOCK_EXAM_SUBJECTS.map(s => s.slug)).size).toBe(8)
    expect(findMockExamSubject('taxation')?.title).toBe('Tax')
    expect(findMockExamSubject('acca')).toBeUndefined()
  })

  it('the hub, the subject page, the pages sitemap and llms.txt hold no copy of the subject slugs (git grep)', () => {
    const files = ['app/mock-exams/page.tsx', 'app/mock-exams/[category]/page.tsx', 'lib/llms-txt.ts', 'app/sitemaps/pages.xml/route.ts']
    for (const s of MOCK_EXAM_SUBJECTS) {
      let hits = ''
      try {
        hits = execFileSync('git', ['grep', '-l', '-F', `'${s.slug}'`, '--', ...files.map(f => `:(literal)${f}`)], { cwd: ROOT, encoding: 'utf8' })
      } catch (e) {
        // git grep exits 1 when nothing matches.
        expect((e as { status?: number }).status).toBe(1)
      }
      expect(hits, s.slug).toBe('')
    }
    // And the list itself is tracked.
    expect(execFileSync('git', ['ls-files', 'lib/mock-exam-subjects.ts'], { cwd: ROOT, encoding: 'utf8' }).trim()).toBe('lib/mock-exam-subjects.ts')
  })
})

describe('open or coming soon', () => {
  it('open at 50 questions or more; a failed read counts as open, as before', () => {
    expect(MOCK_EXAM_OPEN_MIN).toBe(50)
    expect(isOpenPool(50)).toBe(true)
    expect(isOpenPool(49)).toBe(false)
    expect(isOpenPool(0)).toBe(false)
    expect(isOpenPool(null)).toBe(true)
  })

  it('today: 4 open, 4 coming soon', async () => {
    for (const slug of EMPTY) P.sizes.set(slug, 0)
    const states = await getMockExamSubjectStates()
    expect(states.filter(s => !s.open).map(s => s.subject.slug)).toEqual(EMPTY)
    expect((await getOpenMockExamSubjects()).map(s => s.slug)).toEqual(
      ['financial-accounting', 'financial-management', 'management-accounting', 'audit-assurance'])
  })

  it('counts the open ETICPA modules', async () => {
    expect(await getOpenEticpaModuleCount()).toBe(5)
    P.sizes.set('cost-accounting', 12)
    P.sizes.set('introduction-to-accounting', null)
    expect(await getOpenEticpaModuleCount()).toBe(4)
  })
})

describe('the hub', () => {
  it('a subject under 50 questions is a Coming soon card with no link', async () => {
    for (const slug of EMPTY) P.sizes.set(slug, 0)
    P.sizes.set('audit-assurance', 49)
    const html = await hubHtml()
    const cards = Array.from(html.matchAll(/<div data-coming-soon="([a-z-]+)"[\s\S]*?<\/p><\/div><\/div>/g))
    expect(cards.map(m => m[1])).toEqual(['financial-market', 'business-management', 'audit-assurance', 'taxation', 'economics'])
    for (const [card] of cards) {
      expect(card).not.toContain('<a ')
      expect(card).toContain('Coming soon')
      expect(card).toContain('Questions are being added. This exam opens when the bank reaches 50 questions.')
      expect(card).not.toContain('Live')
      expect(card).not.toContain('per attempt')
      expect(card).not.toContain('Start mock exam')
    }
    // No link anywhere to a coming-soon subject; the open ones keep theirs.
    for (const slug of [...EMPTY, 'audit-assurance']) expect(html).not.toContain(`href="/mock-exams/${slug}"`)
    for (const slug of ['financial-accounting', 'financial-management', 'management-accounting']) {
      expect(html).toContain(`href="/mock-exams/${slug}"`)
    }
    expect(html.match(/>\s*Live\s*</g) ?? []).toHaveLength(3)
  })

  it('every subject is Live when its pool read fails (as before)', async () => {
    for (const s of MOCK_EXAM_SUBJECTS) P.sizes.set(s.category, null)
    const html = await hubHtml()
    expect(html).not.toContain('data-coming-soon')
    expect(html.match(/>\s*Live\s*</g) ?? []).toHaveLength(8)
  })
})

describe('the subject page', () => {
  it('an empty subject keeps its address and says it is not open yet', async () => {
    P.sizes.set('taxation', 0)
    const html = await subjectHtml('taxation')
    expect(html).toContain('This mock exam is not open yet. Questions are being added to this subject.')
    expect(html).toContain('Back to Mock Exams')
    expect(html).not.toContain('Start Mock Exam')
    expect(html).not.toContain('Pass mark')
    expect(html).not.toContain('50 questions randomly selected')
  })

  it('an open subject shows the usual intro', async () => {
    const html = await subjectHtml('financial-accounting')
    expect(html).toContain('50 questions randomly selected')
    expect(html).toContain('Start Mock Exam')
    expect(html).not.toContain('not open yet')
  })

  it('an unknown subject still goes back to the hub', async () => {
    await expect(subjectHtml('acca')).rejects.toThrow('NEXT_REDIRECT /mock-exams')
  })
})

describe('source', () => {
  it('the hub reads the subject states, not a list of its own', () => {
    const hub = readFileSync(join(ROOT, 'app/mock-exams/page.tsx'), 'utf8')
    expect(hub).toContain('getMockExamSubjectStates()')
    expect(hub).not.toMatch(/\{ slug: '/)
  })
})
