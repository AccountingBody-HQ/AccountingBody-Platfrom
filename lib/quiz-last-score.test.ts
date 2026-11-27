import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QuizRenderer from '@/components/QuizRenderer'
import { lastScoreLine, lastSetScore, saveSetScore, type StorageLike } from './practice-store'

;(globalThis as { React?: typeof React }).React = React

// PQB-3 S3 (D351, D347): a practice set remembers its last score on the
// visitor's device. Practice set pages only (setSlug); no other caller changes.

class FakeStorage implements StorageLike {
  map = new Map<string, string>()
  get length() { return this.map.size }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null }
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null }
  setItem(k: string, v: string) { this.map.set(k, v) }
  removeItem(k: string) { this.map.delete(k) }
}

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const src = read('components/QuizRenderer.tsx')
const page = read('app/practice-questions/[slug]/page.tsx')

describe('wording', () => {
  it('"Your last score on this device: {score} of {total} ({pct}%)."', () => {
    expect(lastScoreLine({ score: 7, total: 10, pct: 70 })).toBe('Your last score on this device: 7 of 10 (70%).')
  })
})

describe('the flow with a fake device store', () => {
  it('a submit saves the score; the next visit reads it', () => {
    const s = new FakeStorage()
    expect(lastSetScore(s, 'set-a')).toBeNull()
    expect(saveSetScore(s, 'set-a', { score: 8, total: 10, pct: 80 }, Date.UTC(2026, 10, 27))).toBe(true)
    const last = lastSetScore(s, 'set-a')
    expect(last && lastScoreLine(last)).toBe('Your last score on this device: 8 of 10 (80%).')
  })
})

describe('first render (no storage read yet) is unchanged', () => {
  const quizJson = JSON.stringify({ question_type: 'multiple-choice', questions: [{ id: 'q1', question: 'Q', options: [{ label: 'a', value: 'a' }, { label: 'b', value: 'b' }], correctIndex: 0 }] })
  it('with and without setSlug the server markup is the same as today ("Loading quiz…")', () => {
    const today = '<div class="p-6 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-sm text-center">Loading quiz…</div>'
    expect(renderToStaticMarkup(createElement(QuizRenderer, { quizJson }))).toBe(today)
    expect(renderToStaticMarkup(createElement(QuizRenderer, { quizJson, setSlug: 'set-a' }))).toBe(today)
  })
})

describe('QuizRenderer source rules', () => {
  it('optional setSlug prop; only the practice set page passes it, with the set slug', () => {
    expect(src).toContain('interface Props { quizJson: string; setSlug?: string }')
    expect(src).toContain('export default function QuizRenderer({ quizJson, setSlug }: Props) {')
    expect(page).toContain('<QuizRenderer quizJson={post.quizJson} setSlug={post.slug} />')
    expect(page).toContain('slug: qset.slug,')
  })

  it('reads after mount (and after "Try a new set") only when setSlug is given', () => {
    const effect = src.slice(src.indexOf('const savedSessionRef'), src.indexOf('const handleRetry'))
    expect(effect).toMatch(/useEffect\(\(\) => \{\s+if \(!setSlug\) return\s+const store = deviceStorage\(\)\s+setLastScore\(store \? lastSetScore\(store, setSlug\) : null\)\s+\}, \[setSlug, session\]\)/)
    expect(src).not.toContain('localStorage')
  })

  it('saves once per submit, only with graded questions, with the banner\'s numbers', () => {
    const effect = src.slice(src.indexOf('const savedSessionRef'), src.indexOf('const handleRetry'))
    expect(effect).toContain('if (!submitted || !setSlug || savedSessionRef.current === session) return')
    expect(effect).toContain('const { correct, gradedTotal } = gradeSelected(selected, answers)')
    expect(effect).toContain('if (gradedTotal === 0) return')
    expect(effect.indexOf('savedSessionRef.current = session')).toBeLessThan(effect.indexOf('saveSetScore('))
    expect(effect).toContain('saveSetScore(store, setSlug, { score: correct, total: gradedTotal, pct: Math.round((correct / gradedTotal) * 100) }, Date.now())')
    expect(src).toContain('const { correct, gradedTotal } = gradeSelected(selected, answers)\n  const pct = gradedTotal > 0 ? Math.round((correct / gradedTotal) * 100) : 0')
    expect((src.match(/saveSetScore\(/g) || []).length).toBe(1)
  })

  it('the line sits under the heading row, before the progress bar, and only before submitting', () => {
    const line = '{!submitted && lastScore && <p className="text-sm text-slate-500 -mt-3 mb-6">{lastScoreLine(lastScore)}</p>}'
    expect(src).toContain(line)
    expect(src.indexOf('Practice Questions</h2>')).toBeLessThan(src.indexOf(line))
    expect(src.indexOf(line)).toBeLessThan(src.indexOf('<QuizProgress'))
  })

  it('unchanged: scenario options never shuffled, the By Topic table, one live region', () => {
    expect(src).toContain("const groupKeys = shuffle(Object.keys(groups))")
    expect(src).toContain('By Topic')
    expect((src.match(/aria-live=/g) || []).length).toBe(1)
  })
})
