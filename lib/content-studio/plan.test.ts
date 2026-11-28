import { readdirSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_EXAM_SUBJECTS } from '@/lib/mock-exam-subjects'
import { fakeClient, fakeDb, type FakeDb } from './fixtures/fake-db'

const state = vi.hoisted(() => ({ db: null as unknown, sizes: {} as Record<string, number | null>, reports: [] as unknown[][] }))

vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, revalidateTag: () => {} }))
vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: () => fakeClient(state.db as FakeDb) }))
vi.mock('@/lib/report-error', () => ({ reportServerError: (...args: unknown[]) => state.reports.push(args) }))
vi.mock('@/lib/mock-exam-pool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mock-exam-pool')>()),
  getAbMockPoolSize: async (category: string) => (category in state.sizes ? state.sizes[category] : 100),
}))

import { ETICPA_ALL_MODULES, buildPlan, moduleTitleOf, planFrom } from './plan'

type Note = Parameters<typeof planFrom>[0][number]
let seq = 0
function note(category: string, extra: Partial<Note> = {}): Note {
  seq++
  return {
    content_id: `AB-ART-${String(seq).padStart(5, '0')}`,
    title: `Invented note ${seq}`,
    category,
    category_title: `${category} title`,
    eticpa_level: null,
    eticpa_module: null,
    created_at: `2026-01-${String(seq).padStart(2, '0')}`,
    slug: `invented-${seq}`,
    ...extra,
  }
}

function sizes(map: Record<string, number | null>): (number | null)[] {
  return MOCK_EXAM_SUBJECTS.map(s => (s.category in map ? map[s.category] : 100))
}

beforeEach(() => {
  seq = 0
  state.sizes = {}
  state.reports = []
})

describe('ETICPA_ALL_MODULES', () => {
  it('lists exactly the module pages of the site, then CPA', () => {
    const root = path.join(process.cwd(), 'app', 'study', 'eticpa', 'atq')
    const pages = ['level-1', 'level-2'].flatMap(level =>
      readdirSync(path.join(root, level), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => `${level}/${d.name}`).sort())
    expect(ETICPA_ALL_MODULES.filter(m => m.level !== 'level-3').map(m => `${m.level}/${m.module}`)).toEqual(pages)
    expect(ETICPA_ALL_MODULES[ETICPA_ALL_MODULES.length - 1]).toEqual({ level: 'level-3', module: '', title: 'CPA' })
    expect(moduleTitleOf('level-2', 'assurance-controls-ethics')).toBe('Assurance, Controls & Ethics')
    expect(moduleTitleOf('level-2', 'nothing')).toBeNull()
    expect(moduleTitleOf(null, 'cost-accounting')).toBeNull()
  })
})

describe('planFrom', () => {
  it('takes the empty subjects in hub order, one note of each in turn', () => {
    const fm = [note('financial-market'), note('financial-market'), note('financial-market')]
    const tax = [note('taxation')]
    const eco = [note('economics'), note('economics')]
    const other = [note('financial-accounting'), note('audit-assurance')]
    const all = [eco[0], fm[0], tax[0], other[0], fm[1], eco[1], other[1], fm[2]]
    const plan = planFrom(all, [], sizes({ 'financial-market': 0, taxation: 12, economics: 49 }))
    expect(plan.subjects).toEqual([
      { slug: 'financial-market', title: 'Financial Market', poolSize: 0, notesWithoutSet: 3 },
      { slug: 'taxation', title: 'Tax', poolSize: 12, notesWithoutSet: 1 },
      { slug: 'economics', title: 'Economics', poolSize: 49, notesWithoutSet: 2 },
    ])
    expect(plan.queue1.map(r => r.contentId)).toEqual([fm[0], tax[0], eco[0], fm[1], eco[1], fm[2]].map(n => n.content_id))
    expect(plan.queue2.map(r => r.contentId)).toEqual([other[0], other[1]].map(n => n.content_id))
    expect(plan.queue1[0]).toEqual({ contentId: fm[0].content_id, title: fm[0].title, subjectTitle: 'financial-market title' })
  })

  it('treats 50 questions as open and an unreadable pool as not empty', () => {
    const a = note('economics')
    const b = note('taxation')
    const plan = planFrom([a, b], [], sizes({ economics: 50, taxation: null }))
    expect(plan.subjects).toEqual([])
    expect(plan.queue1).toEqual([])
    expect(plan.queue2.map(r => r.contentId)).toEqual([a.content_id, b.content_id])
  })

  it('hides a note whose slug has a set of any status', () => {
    const a = note('economics')
    const b = note('economics')
    const plan = planFrom([a, b], [a.slug, null, ''], sizes({ economics: 0 }))
    expect(plan.subjects[0].notesWithoutSet).toBe(1)
    expect(plan.queue1.map(r => r.contentId)).toEqual([b.content_id])
  })

  it('skips an empty subject with no notes left', () => {
    const plan = planFrom([note('economics')], [], sizes({ taxation: 0, economics: 0 }))
    expect(plan.subjects.map(s => [s.slug, s.notesWithoutSet])).toEqual([['taxation', 0], ['economics', 1]])
    expect(plan.queue1).toHaveLength(1)
  })

  it('uses the category when there is no category title', () => {
    const plan = planFrom([note('economics', { category_title: null })], [], sizes({}))
    expect(plan.queue2[0].subjectTitle).toBe('economics')
  })

  it('lists the ETICPA modules without any published note, with or without a set', () => {
    const notes = [
      note('financial-accounting', { eticpa_level: 'level-1', eticpa_module: 'cost-accounting' }),
      note('financial-accounting', { eticpa_level: 'level-2', eticpa_module: 'financial-accounting' }),
      note('financial-accounting', { eticpa_level: 'level-1', eticpa_module: 'introduction-to-accounting' }),
    ]
    const plan = planFrom(notes, [notes[2].slug], sizes({}))
    expect(plan.eticpaMissing).toEqual([
      'Business Skills', 'Ethiopian Business Law', 'Assurance, Controls & Ethics', 'Ethiopian Public Sector Accounting',
      'Ethiopian Taxation', 'Management Accounting', 'CPA',
    ])
    const withCpa = planFrom([note('x', { eticpa_level: 'level-3', eticpa_module: 'anything' })], [], sizes({}))
    expect(withCpa.eticpaMissing).not.toContain('CPA')
  })
})

describe('buildPlan', () => {
  it('reads all published notes and every set, then plans', async () => {
    const a = { ...note('economics'), status: 'published' }
    const b = { ...note('economics'), status: 'draft' }
    const db = fakeDb({ articles: [a, b], question_sets: [] })
    state.db = db
    state.sizes = { economics: 0 }
    const built = await buildPlan()
    expect(built.ok && built.plan.queue1.map(r => r.contentId)).toEqual([a.content_id])
    expect(db.reads).toEqual([
      'articles:content_id, title, category, category_title, eticpa_level, eticpa_module, created_at, slug',
      'question_sets:article_slug',
    ])
  })

  it('answers not ok when a read fails, with one report', async () => {
    const db = fakeDb({ articles: [], question_sets: [] })
    db.failing.add('question_sets')
    state.db = db
    expect(await buildPlan()).toEqual({ ok: false })
    expect(state.reports.map(r => [r[0], r[2]])).toEqual([['admin content studio plan read failed', { area: 'admin' }]])
  })
})
