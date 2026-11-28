import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Question, QuestionSet } from './db'
import { NOTE_QUESTION_COUNT, notePracticeQuiz, type NotePracticeQuiz } from './note-practice'
import QuizRenderer from '@/components/QuizRenderer'
import { buildQuizJson } from './quiz-data'

;(globalThis as { React?: typeof React }).React = React

// PQB-4 (D351 D-4 A, wording approved then): five questions from the study
// note's own practice set at the bottom of the note.

const db = vi.hoisted(() => ({
  set: null as unknown,
  questions: [] as unknown[],
  failSet: false,
  failQuestions: false,
  setCalls: [] as string[],
  questionCalls: [] as string[],
}))

const reports = vi.hoisted(() => [] as unknown[][])
vi.mock('@/lib/report-error', () => ({ reportServerError: (...args: unknown[]) => { reports.push(args) } }))

vi.mock('@/lib/db', () => ({
  getPublicQuestionSetBySlug: async (slug: string) => {
    db.setCalls.push(slug)
    if (db.failSet) throw new Error('read failed')
    return db.set
  },
  getPublicQuestionsBySetId: async (id: string) => {
    db.questionCalls.push(id)
    if (db.failQuestions) throw new Error('read failed')
    return db.questions
  },
}))


const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const SET: QuestionSet = { id: 'set-id-1', title: 'T', slug: 'set-one', question_type: 'multiple-choice' }
const question = (n: number): Question => ({
  id: `id-${n}`, set_id: SET.id, question_order: n, type: 'multiple-choice',
  question_text: `Question ${n}`, option_a: 'A', option_b: 'B', option_c: 'C', option_d: null,
  correct_index: n % 3, explanation: `Why ${n}`, primary_topic: 'Topic',
})

const block = (mcqUrl: unknown): Promise<NotePracticeQuiz | null> => notePracticeQuiz(mcqUrl)

beforeEach(() => {
  db.set = SET
  db.questions = Array.from({ length: 12 }, (_, i) => question(i + 1))
  db.failSet = false
  db.failQuestions = false
  db.setCalls = []
  db.questionCalls = []
  reports.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the block under a study note', () => {
  it('shows the first five questions of the linked set, with the approved words and a link to the whole set', async () => {
    const p = (await block('/practice-questions/set-one'))!
    expect(p.heading).toBe('Practice questions on this topic')
    expect(p.intro).toBe('Try 5 questions from the practice set for this study note.')
    expect(p.moreHref).toBe('/practice-questions/set-one')
    expect(p.moreLabel).toBe('Practise all 12 questions →')
    expect(Object.keys(p).sort()).toEqual(['heading', 'intro', 'moreHref', 'moreLabel', 'quizJson'])
    const data = JSON.parse(p.quizJson)
    expect(NOTE_QUESTION_COUNT).toBe(5)
    expect(data.questions.map((q: { question: string }) => q.question)).toEqual(['Question 1', 'Question 2', 'Question 3', 'Question 4', 'Question 5'])
    expect(data.cases).toEqual([])
    expect(db.setCalls).toEqual(['set-one'])
    expect(db.questionCalls).toEqual(['set-id-1'])
  })

  it('reads the set named by a full address too (linkedSetSlug)', async () => {
    expect((await block('https://www.accountingbody.com/practice-questions/set-one/?x=1'))?.moreHref).toBe('/practice-questions/set-one')
  })

  it('hides itself when the note names no set', async () => {
    for (const url of [null, undefined, '', 'https://example.com/other', 42]) expect(await block(url)).toBeNull()
    expect(db.setCalls).toEqual([])
    expect(reports).toEqual([])
  })

  it('hides itself for a missing set, a scenario set or fewer than five questions', async () => {
    db.set = null
    expect(await block('/practice-questions/set-one')).toBeNull()
    db.set = { ...SET, question_type: 'scenario' }
    expect(await block('/practice-questions/set-one')).toBeNull()
    db.set = SET
    db.questions = db.questions.slice(0, 4)
    expect(await block('/practice-questions/set-one')).toBeNull()
    db.questions = Array.from({ length: 5 }, (_, i) => question(i + 1))
    expect((await block('/practice-questions/set-one'))?.moreLabel).toBe('Practise all 5 questions →')
  })

  it('a failed read hides the block, logs its code only, reports it and never fails the note', async () => {
    db.failSet = true
    expect(await block('/practice-questions/set-one')).toBeNull()
    db.failSet = false
    db.failQuestions = true
    expect(await block('/practice-questions/set-one')).toBeNull()
    expect(vi.mocked(console.error).mock.calls).toEqual([['notePracticeQuiz error:', 'unknown'], ['notePracticeQuiz error:', 'unknown']])
    expect(reports.map(r => [r[0], (r[1] as Error).message, r[2]])).toEqual([
      ['note practice questions read failed', 'read failed', { area: 'public' }],
      ['note practice questions read failed', 'read failed', { area: 'public' }],
    ])
  })
})

describe('the shared quiz data (lib/quiz-data.ts)', () => {
  it('is the practice set page\'s data, byte for byte', () => {
    const q = question(1)
    const w: Question = { ...question(2), type: 'writing', writing_model_answer: '<p>m</p>', writing_explanation: null, case_id: 'c1' }
    expect(buildQuizJson(undefined, [q, w], [{ id: 'x', set_id: SET.id, case_id: 'c1', title: 'Case', exhibit_html: '<p>e</p>', created_at: '' }])).toBe(
      '{"question_type":"multiple-choice","questions":[' +
      '{"id":"q1","type":"multiple-choice","question":"Question 1","options":[{"label":"A","value":"A"},{"label":"B","value":"B"},{"label":"C","value":"C"}],"correctIndex":1,"correct":"B","explanation":"Why 1","meta":{"primaryTopic":"Topic"}},' +
      '{"id":"q2","type":"writing","question":"Question 2","options":[{"label":"A","value":"A"},{"label":"B","value":"B"},{"label":"C","value":"C"}],"correctIndex":2,"correct":"C","explanation":"Why 2","writing":{"model_answer_html":"<p>m</p>","explanation_html":""},"case_id":"c1","meta":{"primaryTopic":"Topic"}}],' +
      '"cases":[{"case_id":"c1","title":"Case","exhibit_html":"<p>e</p>"}]}',
    )
  })

  it('the practice set page uses it, still with its setSlug', () => {
    const page = read('app/practice-questions/[slug]/page.tsx')
    expect(page).toContain("import { buildQuizJson } from '@/lib/quiz-data'")
    expect(page).toContain('  const quizJson = buildQuizJson(qset.question_type, questions, cases)')
    expect(page).not.toContain('JSON.stringify')
    expect(page).toContain('<QuizRenderer quizJson={post.quizJson} setSlug={post.slug} />')
  })
})

describe('QuizRenderer with the note props', () => {
  const src = read('components/QuizRenderer.tsx')
  it('first render is the same "Loading quiz…" markup as today', () => {
    const quizJson = buildQuizJson('multiple-choice', [question(1)], [])
    const today = '<div class="p-6 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-sm text-center">Loading quiz…</div>'
    expect(renderToStaticMarkup(createElement(QuizRenderer, { quizJson, heading: 'H', intro: 'I', moreHref: '/practice-questions/set-one', moreLabel: 'M' }))).toBe(today)
  })

  it('the heading, the intro line and the after-submit link; the set page keeps its own words', () => {
    expect(src).toContain("<h2 className=\"font-display text-2xl text-navy-950\">{heading ?? 'Practice Questions'}</h2>")
    expect(src).toContain('{intro && <p className="text-sm text-slate-600 -mt-3 mb-6">{intro}</p>}')
    expect(src).toContain("{moreLabel ?? 'Browse more questions'}")
    expect(src).toContain('<a href="/practice-questions" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}')
    expect(src).toContain('if (heading) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); else window.scrollTo({ top: 0, behavior: "smooth" });')
    expect(src).toContain('<div ref={rootRef} className="mt-10 pt-10 border-t border-slate-200">')
  })

  it('answers still show only after "Submit answers"; no new storage', () => {
    expect(src).toContain('{submitted && q.explanation && (')
    expect(src).not.toContain('localStorage')
    expect((src.match(/saveSetScore\(/g) || []).length).toBe(1)
  })
})

describe('where the block sits', () => {
  it('study note: after the author box, before the "Continue Learning" link', () => {
    const page = read('app/study/[category]/[slug]/page.tsx')
    expect(page).toContain("import { notePracticeQuiz } from '@/lib/note-practice'")
    expect(page).toContain("import QuizRenderer from '@/components/QuizRenderer'")
    expect(page).toContain('  if (eticpaTarget) permanentRedirect(eticpaTarget)\n  const notePractice = await notePracticeQuiz(article.mcq_url)\n')
    expect(page).toContain('              <AuthorBio article={article} />\n              {notePractice && <QuizRenderer {...notePractice} />}\n              <QuestionButtons article={article} />')
    expect(page.split('<QuizRenderer').length - 1).toBe(1)
  })

  it('article page: after the article text, before the "Test your knowledge" box', () => {
    const page = read('app/articles/[slug]/page.tsx')
    expect(page).toContain("import { notePracticeQuiz } from '@/lib/note-practice'")
    expect(page).toContain("import QuizRenderer from '@/components/QuizRenderer'")
    expect(page).toContain('  if (!article) return null\n  const notePractice = await notePracticeQuiz(article.mcq_url)\n')
    expect(page).toContain("<HtmlRenderer html={article.content ?? ''} stripLeadingH1 />\n\n              {notePractice && <QuizRenderer {...notePractice} />}\n\n              {/* Test your knowledge — bottom of article */}")
    expect(page.split('<QuizRenderer').length - 1).toBe(1)
  })

  it('the study note bottom link opens in the same tab; its two labels are slate-500', () => {
    const page = read('app/study/[category]/[slug]/page.tsx')
    const buttons = page.slice(page.indexOf('function QuestionButtons'), page.indexOf('// ── Page'))
    expect(buttons).not.toContain('target=')
    expect(buttons).not.toContain('rel=')
    expect(buttons).toContain('<p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-5">Continue Learning</p>')
    expect(buttons).toContain('<p className="text-xs text-slate-500">{btn.sublabel}</p>')
    expect(buttons).not.toContain('text-slate-400')
  })

  it('the hidden labels (JSON-LD) are unchanged: no quiz schema on the note pages', () => {
    for (const f of ['app/study/[category]/[slug]/page.tsx', 'app/articles/[slug]/page.tsx']) {
      expect(read(f)).not.toContain('quizSchema')
    }
  })
})
