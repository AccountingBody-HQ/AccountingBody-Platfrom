import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compilePrompt, compileReviewerPrompt, isCompiled, runGate, type CompiledPrompt } from '@/lib/content-engine'
import type { QuestionSetOutput } from '@/lib/content-engine/types'
import { questionSetOutput } from '@/lib/content-engine/fixtures/outputs'
import { alreadyHasSetMessage } from '@/lib/question-publish-checks'
import { briefFor, type Choices } from './brief'
import { fakeClient, fakeDb, type FakeDb } from './fixtures/fake-db'
import { ETICPA_ROW, NOTE_ROW, TAX_ROW, noteOf } from './fixtures/notes'
import { WORDING } from './wording'

const state = vi.hoisted(() => ({
  signedIn: true,
  db: null as unknown,
  aiCalls: [] as { messages: { content: string }[] }[],
  aiAnswers: [] as string[],
  aiFails: false,
  reports: [] as unknown[][],
}))

vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, revalidateTag: () => {} }))
vi.mock('@/lib/admin-auth', () => ({
  isAuthenticated: async () => state.signedIn,
  signedOutResponse: () => NextResponse.json({ error: 'Signed out' }, { status: 401 }),
}))
vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: () => fakeClient(state.db as FakeDb) }))
vi.mock('@/lib/report-error', () => ({ reportServerError: (...args: unknown[]) => state.reports.push(args) }))
vi.mock('@/lib/mock-exam-pool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mock-exam-pool')>()),
  getAbMockPoolSize: async (category: string) => (category === 'economics' ? 0 : 100),
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (params: { messages: { content: string }[] }) => {
        state.aiCalls.push(params)
        if (state.aiFails) throw new Error('invented failure')
        return { content: [{ type: 'text', text: state.aiAnswers.shift() ?? '{}' }], stop_reason: 'end_turn', usage: {} }
      },
    }
  },
}))

import { handleCheck, handleGenerate, handlePlan, handlePrompt, MAX_BODY_CHARS } from './http'

let db: FakeDb
beforeEach(() => {
  state.signedIn = true
  state.aiCalls = []
  state.aiAnswers = []
  state.aiFails = false
  state.reports = []
  db = fakeDb({
    articles: [NOTE_ROW, TAX_ROW, ETICPA_ROW, { ...NOTE_ROW, content_id: 'AB-ART-00045', slug: 'invented-economics', category: 'economics', category_title: 'Economics' }],
    question_sets: [],
  })
  state.db = db
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

type Handler = (req: NextRequest) => Promise<NextResponse>

async function post(handler: Handler, body: unknown): Promise<{ status: number; json: Record<string, unknown>; res: NextResponse }> {
  const req = new NextRequest('http://localhost/api/test', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
  const res = await handler(req)
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, res }
}

async function get(query = ''): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await handlePlan(new NextRequest(`http://localhost/api/test${query}`))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

function compiledFor(row: typeof NOTE_ROW, choices: Choices): CompiledPrompt {
  const made = briefFor(noteOf(row), choices)
  if (!made.ok) throw new Error(made.message)
  const c = compilePrompt(made.brief)
  if (!isCompiled(c)) throw new Error('not compiled')
  return c
}

const TEN = { noteId: 'AB-ART-00042', level: 'aat', questionCount: 10 } as const
const TWENTY = { noteId: 'AB-ART-00042', level: 'aat', questionCount: 20 } as const

function halvesOf(c: CompiledPrompt): [string, string] {
  const whole: QuestionSetOutput = questionSetOutput(c)
  const qs = whole.questionSet.questions
  return [
    JSON.stringify({ ...whole, questionSet: { questions: qs.slice(0, 10) } }),
    JSON.stringify({ ...whole, questionSet: { questions: qs.slice(10) } }),
  ]
}

describe('every handler checks the session first', () => {
  it('answers 401 signed out, before any read or AI call', async () => {
    state.signedIn = false
    expect((await get()).status).toBe(401)
    for (const handler of [handlePrompt, handleCheck, handleGenerate]) {
      expect((await post(handler, { mode: 'find', noteId: 'AB-ART-00042' })).status).toBe(401)
      expect((await post(handler, { kind: 'questions', ...TEN, step: 0, earlier: [] })).status).toBe(401)
    }
    expect(db.reads).toEqual([])
    expect(state.aiCalls).toEqual([])
  })
})

describe('request bodies are read strictly', () => {
  it('refuses bad JSON, a non-object, an unknown mode, an unknown or missing field and a body that is too large', async () => {
    const bodies: unknown[] = [
      '{not json', '[1]', '"x"', 'null', {}, { mode: 'other' },
      { mode: 'find', noteId: 'AB-ART-00042', extra: 1 }, { mode: 'questions', noteId: 'AB-ART-00042', level: 'aat' },
      { mode: 'questions', ...TEN, questionCount: 15 },
      'x'.repeat(MAX_BODY_CHARS + 1),
    ]
    for (const handler of [handlePrompt, handleCheck, handleGenerate]) {
      for (const body of bodies) {
        const r = await post(handler, body)
        expect([r.status, r.json]).toEqual([400, { error: WORDING.somethingWrong }])
      }
    }
    expect(state.aiCalls).toEqual([])
    expect(state.reports).toEqual([])
  })

  it('answers with no-store', async () => {
    const r = await post(handlePrompt, { mode: 'find', noteId: 'AB-ART-00042' })
    expect(r.res.headers.get('Cache-Control')).toBe('no-store')
    const bad = await post(handlePrompt, '{')
    expect(bad.res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('reports an unexpected failure once and answers 500', async () => {
    state.db = null
    const r = await post(handlePrompt, { mode: 'find', noteId: 'AB-ART-00042' })
    expect([r.status, r.json]).toEqual([500, { error: WORDING.somethingWrong }])
    expect(state.reports.map(x => [x[0], x[2]])).toEqual([['admin content studio request failed', { area: 'admin' }]])
  })
})

describe('POST prompt', () => {
  it('finds a note and says what the screen shows', async () => {
    const r = await post(handlePrompt, { mode: 'find', noteId: ' ab-art-00042 ' })
    expect([r.status, r.json]).toEqual([200, {
      note: {
        contentId: 'AB-ART-00042', title: NOTE_ROW.title, subjectTitle: 'Financial Accounting', moduleLabel: 'Accounting Body',
        defaultLevel: 'acca', needsValidAsAt: false, setTitle: null, setMessage: null,
      },
    }])
    const et = await post(handlePrompt, { mode: 'find', noteId: 'AB-ART-00044' })
    expect(et.json.note).toMatchObject({ moduleLabel: 'Introduction to Accounting', defaultLevel: 'eticpa-atq' })
    const tax = await post(handlePrompt, { mode: 'find', noteId: 'AB-ART-00043' })
    expect(tax.json.note).toMatchObject({ needsValidAsAt: true })
  })

  it('gives the existing set message from the server', async () => {
    db.tables.question_sets = [{ title: 'Invented set', article_slug: NOTE_ROW.slug }]
    const r = await post(handlePrompt, { mode: 'find', noteId: 'AB-ART-00042' })
    expect(r.json.note).toMatchObject({ setTitle: 'Invented set', setMessage: alreadyHasSetMessage('Invented set') })
  })

  it('answers not found for a bad or unknown id, and 500 when the read fails', async () => {
    for (const noteId of ['nope', 'AB-ART-99999', 5]) {
      expect(await post(handlePrompt, { mode: 'find', noteId })).toMatchObject({ status: 404, json: { error: WORDING.notFound } })
    }
    db.failing.add('articles')
    expect(await post(handlePrompt, { mode: 'find', noteId: 'AB-ART-00042' })).toMatchObject({ status: 500, json: { error: WORDING.somethingWrong } })
  })

  it('compiles the prompt on the server, with its steps and estimate', async () => {
    const r = await post(handlePrompt, { mode: 'questions', ...TWENTY })
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 20 })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ text: c.text, promptId: c.promptId, promptVersion: c.promptVersion, steps: 2 })
    expect(r.json.estimate).toMatch(/^\$[0-9]+\.[0-9]{2}$/)
    const one = await post(handlePrompt, { mode: 'questions', ...TEN })
    expect(one.json.steps).toBe(1)
  })

  it('asks for the date of a tax note', async () => {
    const r = await post(handlePrompt, { mode: 'questions', ...TEN, noteId: 'AB-ART-00043' })
    expect([r.status, r.json]).toEqual([400, { error: WORDING.validAsAtNeeded }])
    const ok = await post(handlePrompt, { mode: 'questions', ...TEN, noteId: 'AB-ART-00043', validAsAt: '2026-04-06' })
    expect(ok.status).toBe(200)
  })

  it('builds the reviewer prompt only for an answer of the right shape', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 10 })
    const output = questionSetOutput(c)
    const r = await post(handlePrompt, { mode: 'review', ...TEN, answer: JSON.stringify(output) })
    const card = runGate(JSON.stringify(output), c)
    const reviewer = compileReviewerPrompt(c.brief, JSON.stringify(card.output))
    if (!isCompiled(reviewer)) throw new Error('not compiled')
    expect(r.status).toBe(200)
    expect(r.json.text).toBe(reviewer.text)
    expect(await post(handlePrompt, { mode: 'review', ...TEN, answer: '{"x": 1}' })).toMatchObject({ status: 400, json: { error: WORDING.notReady } })
    expect((await post(handlePrompt, { mode: 'review', ...TEN })).status).toBe(400)
    expect((await post(handlePrompt, { mode: 'review', ...TEN, answer: 'x', parts: ['x'] })).status).toBe(400)
  })
})

describe('POST check', () => {
  it('scores a pasted answer and makes it ready to publish (Door 1)', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 10 })
    const output = questionSetOutput(c)
    const r = await post(handleCheck, { mode: 'questions', ...TEN, door: 'copy', answer: JSON.stringify(output) })
    expect(r.status).toBe(200)
    const card = r.json.card as Record<string, unknown>
    expect(card).toMatchObject({ ok: true, score: 100, problems: [], warnings: [] })
    expect((card.notChecked as string[]).length).toBe(3)
    const preview = r.json.preview as { questionText: string; correctIndex: number }[]
    expect(preview).toHaveLength(10)
    expect(preview[0]).toEqual({
      questionText: output.questionSet.questions[0].questionText,
      options: output.questionSet.questions[0].options,
      correctIndex: output.questionSet.questions[0].correctIndex,
      explanation: output.questionSet.questions[0].explanation,
    })
    expect(r.json.publish).toMatchObject({ articleSlug: 'AB-ART-00042', registry: { promptId: c.promptId, model: 'outside-ai', qualityScore: 100 } })
    expect(r.json.publishProblem).toBeNull()
  })

  it('asks for an answer when the paste is empty', async () => {
    expect(await post(handleCheck, { mode: 'questions', ...TEN, door: 'copy', answer: '  ' })).toMatchObject({ status: 400, json: { error: WORDING.pasteFirst } })
  })

  it('shows the gate problem when the note changed between prompt and check', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 10 })
    const answer = JSON.stringify(questionSetOutput(c))
    db.tables.articles = [{ ...NOTE_ROW, content: NOTE_ROW.content + '<p>An invented extra paragraph about accruals added later.</p>' }]
    const changed = compiledFor({ ...NOTE_ROW, content: db.tables.articles[0].content as string }, { level: 'aat', questionCount: 10 })
    const expected = runGate(answer, changed).findings.filter(f => f.check === 'envelope.prompt')
    expect(expected.length).toBeGreaterThan(0)
    const r = await post(handleCheck, { mode: 'questions', ...TEN, door: 'copy', answer })
    const card = r.json.card as { ok: boolean; problems: { message: string }[] }
    expect(card.ok).toBe(false)
    for (const f of expected) expect(card.problems.map(p => p.message)).toContain(f.message)
    expect(r.json.publish).toBeNull()
    expect(r.json.publishProblem).toBeNull()
  })

  it('joins the two steps of "Generate here" and scores them as one set', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 20 })
    const r = await post(handleCheck, { mode: 'questions', ...TWENTY, door: 'generate', parts: halvesOf(c) })
    expect(r.json.card).toMatchObject({ ok: true, score: 100 })
    expect((r.json.preview as unknown[]).length).toBe(20)
    expect(r.json.publish).toMatchObject({ registry: { model: 'claude-sonnet-4-6' } })
  })

  it('names the step whose answer has no JSON or no questions', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 20 })
    const [first] = halvesOf(c)
    const r = await post(handleCheck, { mode: 'questions', ...TWENTY, door: 'generate', parts: [first, 'no json here'] })
    expect(r.json.card).toMatchObject({ ok: false, score: 0, problems: [{ message: 'Step 2: No valid JSON object could be read from the answer.' }] })
    expect(r.json.preview).toBeNull()
    const s = await post(handleCheck, { mode: 'questions', ...TWENTY, door: 'generate', parts: [first, '{"a": 1}'] })
    expect(s.json.card).toMatchObject({ ok: false, problems: [{ message: 'Step 2: the answer has no question list.' }] })
  })

  it('refuses the wrong number of parts or the wrong door fields', async () => {
    expect((await post(handleCheck, { mode: 'questions', ...TWENTY, door: 'generate', parts: ['{}'] })).status).toBe(400)
    expect((await post(handleCheck, { mode: 'questions', ...TEN, door: 'generate', answer: '{}' })).status).toBe(400)
    expect((await post(handleCheck, { mode: 'questions', ...TEN, door: 'copy', parts: ['{}'] })).status).toBe(400)
    expect((await post(handleCheck, { mode: 'questions', ...TEN, door: 'other', answer: '{}' })).status).toBe(400)
  })

  it('reads the second opinion without applying it', async () => {
    const notes = [{ where: 'q1', problem: 'Invented problem.', suggestion: 'Invented suggestion.' }]
    expect(await post(handleCheck, { mode: 'review', reviewAnswer: JSON.stringify({ findings: notes }) })).toMatchObject({ status: 200, json: { ok: true, notes } })
    expect(await post(handleCheck, { mode: 'review', reviewAnswer: '{"x": 1}' })).toMatchObject({ status: 200, json: { ok: false, error: WORDING.reviewBadShape } })
    expect(await post(handleCheck, { mode: 'review', reviewAnswer: '' })).toMatchObject({ status: 400, json: { error: WORDING.pasteFirst } })
  })
})

describe('POST generate', () => {
  it('sends exactly the copied prompt for a one-step set (same prompt both doors)', async () => {
    const prompt = await post(handlePrompt, { mode: 'questions', ...TEN })
    state.aiAnswers = ['{"answer": "invented"}']
    const r = await post(handleGenerate, { kind: 'questions', ...TEN, step: 0, earlier: [] })
    expect([r.status, r.json]).toEqual([200, { raw: '{"answer": "invented"}', step: 0, steps: 1 }])
    expect(state.aiCalls).toHaveLength(1)
    expect(state.aiCalls[0].messages[0].content).toBe(prompt.json.text)
  })

  it('lists the earlier step\'s questions in step 2 of 2', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 20 })
    const [first] = halvesOf(c)
    const r = await post(handleGenerate, { kind: 'questions', ...TWENTY, step: 1, earlier: [first] })
    expect(r.json).toMatchObject({ step: 1, steps: 2 })
    const text = state.aiCalls[0].messages[0].content
    expect(text.startsWith(c.text + '\n\nSTEP 2 OF 2')).toBe(true)
    for (let i = 1; i <= 10; i++) expect(text).toContain(`  - [q${i}] `)
  })

  it('refuses a step that does not fit the plan', async () => {
    for (const extra of [{ step: 1, earlier: [] }, { step: 2, earlier: ['{}', '{}'] }, { step: 0, earlier: ['{}'] }, { step: 0.5, earlier: [] }, { step: 1, earlier: [5] }]) {
      expect((await post(handleGenerate, { kind: 'questions', ...TWENTY, ...extra })).status).toBe(400)
    }
    expect(state.aiCalls).toEqual([])
  })

  it('answers 502 when the AI fails, and nothing else', async () => {
    state.aiFails = true
    expect(await post(handleGenerate, { kind: 'questions', ...TEN, step: 0, earlier: [] })).toMatchObject({ status: 502, json: { error: WORDING.aiFailed } })
  })

  it('asks the AI for the second opinion with the reviewer prompt', async () => {
    const c = compiledFor(NOTE_ROW, { level: 'aat', questionCount: 10 })
    const answer = JSON.stringify(questionSetOutput(c))
    const prompt = await post(handlePrompt, { mode: 'review', ...TEN, answer })
    state.aiAnswers = ['{"findings": []}']
    const r = await post(handleGenerate, { kind: 'review', ...TEN, answer })
    expect([r.status, r.json]).toEqual([200, { raw: '{"findings": []}' }])
    expect(state.aiCalls[0].messages[0].content).toBe(prompt.json.text)
  })
})

describe('GET plan', () => {
  it('answers the first page of both lists', async () => {
    const r = await get()
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ queue1Total: 1, queue2Total: 3 })
    expect((r.json.subjects as { slug: string }[]).map(s => s.slug)).toEqual(['economics'])
    expect((r.json.queue1 as { contentId: string }[])[0].contentId).toBe('AB-ART-00045')
    expect(Array.isArray(r.json.eticpaMissing)).toBe(true)
  })

  it('answers one page of one list from an offset', async () => {
    const r = await get('?group=2&offset=1')
    expect(r.json).toMatchObject({ group: '2', offset: 1, total: 3 })
    expect((r.json.rows as unknown[]).length).toBe(2)
  })

  it('refuses bad paging and says when the plan cannot be read', async () => {
    for (const q of ['?group=3&offset=0', '?group=1', '?offset=0', '?group=1&offset=-1', '?group=1&offset=x', '?other=1']) {
      expect(await get(q)).toEqual({ status: 400, json: { error: WORDING.somethingWrong } })
    }
    db.failing.add('articles')
    expect(await get()).toEqual({ status: 500, json: { error: WORDING.planFailed } })
  })
})
