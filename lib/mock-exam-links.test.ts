import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import React, { type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('React', React)

// ME-1 S5: the links into the mock exams — the home page button goes
// straight to the hub, the /study Mock Exams card opens the brand's mock
// exams and counts the open ones, and every hub card finds its icon.

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`) }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getCategoryCounts: vi.fn(async () => ({})),
  getQuestionSetCount: vi.fn(async () => 181),
}))
const P = vi.hoisted(() => ({ sizes: new Map<string, number | null>() }))
vi.mock('@/lib/mock-exam-pool', () => ({
  getAbMockPoolSize: vi.fn(async (category: string) => (P.sizes.has(category) ? P.sizes.get(category) : 500)),
  getEticpaMockPoolSize: vi.fn(async () => 300),
}))

import { MOCK_EXAM_SUBJECTS } from '@/lib/mock-exam-subjects'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

beforeEach(() => {
  H.map.clear()
  P.sizes.clear()
  for (const slug of ['financial-market', 'business-management', 'taxation', 'economics']) P.sizes.set(slug, 0)
})

async function mockExamsCard(view: 'ab' | 'et'): Promise<string> {
  if (view === 'et') H.map.set('x-et-platform', 'ethiotax')
  // Loaded here, after React is set globally: the page builds its icons when loaded.
  const StudyPage = (await import('@/app/study/page')).default
  const html = renderToStaticMarkup((await StudyPage()) as ReactElement)
  const card = Array.from(html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*?<\/a>/g))
    .map(m => m[0]).filter(a => a.includes('>Mock Exams</h3>'))
  expect(card).toHaveLength(1)
  return card[0]
}

describe('home page', () => {
  it('no address in app/ points at /mock-exams/acca (git grep)', () => {
    let hits = ''
    try {
      hits = execFileSync('git', ['grep', '-l', '-F', '/mock-exams/acca', '--', 'app', ':(exclude)*.test.ts'], { cwd: ROOT, encoding: 'utf8' })
    } catch (e) {
      expect((e as { status?: number }).status).toBe(1)
    }
    expect(hits.split('\n').filter(Boolean)).toHaveLength(0)
  })

  it('"Try a mock exam →" goes straight to the hub', () => {
    expect(read('app/page.tsx')).toMatch(/href="\/mock-exams"\s+className="[^"]*"\s+style=\{\{ border: '2px solid #C9982A', color: '#88671c', background: 'transparent' \}\}\s*>\s*Try a mock exam →/)
  })
})

describe('/study Mock Exams card', () => {
  it('Accounting Body: opens /mock-exams, says "Start a mock exam", counts the open subjects', async () => {
    const card = await mockExamsCard('ab')
    expect(card).toMatch(/^<a [^>]*href="\/mock-exams"/)
    expect(card).toContain('Start a mock exam')
    expect(card).not.toContain('Browse question sets')
    expect(card).toMatch(/rounded-full shrink-0 mt-0\.5">4<\/span>/)
  })

  it('EthioTax: opens /study/mock-exams and counts the open modules', async () => {
    const card = await mockExamsCard('et')
    expect(card).toMatch(/^<a [^>]*href="\/study\/mock-exams"/)
    expect(card).toContain('Start a mock exam')
    expect(card).toMatch(/rounded-full shrink-0 mt-0\.5">5<\/span>/)
  })

  it('the description is unchanged', async () => {
    const card = await mockExamsCard('ab')
    expect(card).toContain('Full exam simulations to test your knowledge and build exam confidence.')
  })
})

describe('hub icons', () => {
  it('every subject icon key has an icon on the hub', () => {
    const hub = read('app/mock-exams/page.tsx')
    const block = hub.slice(hub.indexOf('const CATEGORY_ICONS'), hub.indexOf('const DEFAULT_ICON'))
    const keys = Array.from(block.matchAll(/^\s+'([a-z-]+)':/gm)).map(m => m[1])
    expect(keys).toHaveLength(8)
    for (const s of MOCK_EXAM_SUBJECTS) expect(keys, s.slug).toContain(s.icon)
    expect(new Set(MOCK_EXAM_SUBJECTS.map(s => s.icon)).size).toBe(8)
    // Audit and Assurance gets the shield, Tax the cash icon (they had the default book before).
    expect(MOCK_EXAM_SUBJECTS.find(s => s.slug === 'audit-assurance')?.icon).toBe('shield-check')
    expect(MOCK_EXAM_SUBJECTS.find(s => s.slug === 'taxation')?.icon).toBe('cash')
  })
})
