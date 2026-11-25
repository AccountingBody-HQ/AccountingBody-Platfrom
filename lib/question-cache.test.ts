import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ tags: [] as string[], fails: null as Error | null, reports: [] as unknown[][] }))

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => {
    if (state.fails) throw state.fails
    state.tags.push(tag)
  },
}))
vi.mock('./report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))

import { refreshQuestionCaches } from './question-cache'

beforeEach(() => {
  Object.assign(state, { tags: [], fails: null, reports: [] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('refreshQuestionCaches', () => {
  it('always refreshes the broad tags', () => {
    refreshQuestionCaches()
    expect(state.tags).toEqual(['question-sets', 'questions'])
  })

  it('also refreshes every known set, id and article, once each', () => {
    refreshQuestionCaches({ slugs: ['old', 'new', 'new'], setIds: ['id-1'], articleSlugs: ['leases'] })
    expect(state.tags).toEqual([
      'question-sets',
      'questions',
      'question-set:old',
      'question-set:new',
      'question-set-id:id-1',
      'article:leases',
    ])
  })

  it('leaves out unknown names', () => {
    refreshQuestionCaches({ slugs: [null, undefined, ''], setIds: [undefined], articleSlugs: [null] })
    expect(state.tags).toEqual(['question-sets', 'questions'])
  })

  it('never throws; a failure is reported', () => {
    state.fails = new Error('no cache')
    expect(() => refreshQuestionCaches({ slugs: ['a'] })).not.toThrow()
    expect(state.reports).toEqual([['admin question cache refresh failed', state.fails, { area: 'admin' }]])
  })

  it('uses the tags the public reads are stored under', () => {
    const source = readFileSync(join(process.cwd(), 'lib/db.ts'), 'utf8')
    for (const tags of [
      "tags: ['question-sets', `question-set:${slug}`]",
      "tags: ['question-sets', `question-set-id:${setId}`]",
      "tags: ['question-sets', 'question-sets-list']",
      "tags: ['counts', 'questions']",
      "tags: ['articles', `article:${slug}`]",
    ]) {
      expect(source).toContain(tags)
    }
  })
})
