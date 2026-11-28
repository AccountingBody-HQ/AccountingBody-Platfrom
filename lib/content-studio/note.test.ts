import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeClient, fakeDb, type FakeDb } from './fixtures/fake-db'
import { NOTE_ROW } from './fixtures/notes'

const state = vi.hoisted(() => ({ db: null as unknown, contexts: [] as string[], reports: [] as unknown[][] }))

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: (context: string) => {
    state.contexts.push(context)
    return fakeClient(state.db as FakeDb)
  },
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: (...args: unknown[]) => state.reports.push(args) }))

import { normaliseNoteId, readStudyNote } from './note'

let db: FakeDb
beforeEach(() => {
  db = fakeDb({ articles: [NOTE_ROW, { ...NOTE_ROW, content_id: 'AB-ART-00050', slug: 'draft-note', status: 'draft' }], question_sets: [] })
  state.db = db
  state.contexts = []
  state.reports = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('normaliseNoteId', () => {
  it('trims and upper-cases an AB-ART id', () => {
    expect(normaliseNoteId(' ab-art-00042 ')).toBe('AB-ART-00042')
    expect(normaliseNoteId('AB-ART-1')).toBe('AB-ART-1')
  })

  it('refuses anything else', () => {
    for (const v of [null, 5, '', 'AB-QZ-00001', 'AB-ART-', 'AB-ART-12345678901', 'AB-ART-12a', 'x AB-ART-1']) expect(normaliseNoteId(v)).toBeNull()
  })
})

describe('readStudyNote', () => {
  it('reads the whole published note with the admin client, and no set', async () => {
    const read = await readStudyNote('AB-ART-00042')
    expect(read).toEqual({
      kind: 'found',
      note: {
        contentId: 'AB-ART-00042', title: NOTE_ROW.title, slug: NOTE_ROW.slug, category: 'financial-accounting',
        categoryTitle: 'Financial Accounting', eticpaLevel: null, eticpaModule: null, html: NOTE_ROW.content, setTitle: null,
      },
    })
    expect(state.contexts).toEqual(['admin'])
    expect(db.reads).toEqual([
      'articles:content_id, title, slug, category, category_title, eticpa_level, eticpa_module, content',
      'question_sets:title',
    ])
  })

  it('finds an existing set of any status', async () => {
    db.tables.question_sets = [{ title: 'Invented set', article_slug: NOTE_ROW.slug, status: 'draft' }]
    const read = await readStudyNote('AB-ART-00042')
    expect(read.kind === 'found' && read.note.setTitle).toBe('Invented set')
  })

  it('does not find a draft, a missing note or a note without text', async () => {
    expect(await readStudyNote('AB-ART-00050')).toEqual({ kind: 'not-found' })
    expect(await readStudyNote('AB-ART-99999')).toEqual({ kind: 'not-found' })
    db.tables.articles = [{ ...NOTE_ROW, content: '  ' }]
    expect(await readStudyNote('AB-ART-00042')).toEqual({ kind: 'not-found' })
  })

  it('answers error when a read fails, with one report and no content in it', async () => {
    db.failing.add('articles')
    expect(await readStudyNote('AB-ART-00042')).toEqual({ kind: 'error' })
    expect(state.reports).toHaveLength(1)
    expect(state.reports[0][0]).toBe('content studio: study note')
    db.failing.clear()
    db.failing.add('question_sets')
    state.reports = []
    expect(await readStudyNote('AB-ART-00042')).toEqual({ kind: 'error' })
    expect(state.reports.map(r => r[0])).toEqual(['content studio: existing set'])
    expect(JSON.stringify(state.reports)).not.toContain(NOTE_ROW.title)
  })
})
