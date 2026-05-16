'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import QuizProgress from './QuizProgress'
import ExplanationRenderer from './ExplanationRenderer'

interface QuizOption { label: string; value: string }

interface QuizQuestion {
  id?:          string
  key?:         string
  type?:        string
  question:     string
  options?:     QuizOption[]
  correct?:     string | number
  correctIndex?: number
  explanation?: string
  case_id?:     string
  meta?:        { primaryTopic?: string }
  writing?: {
    prompt?:           string
    model_answer_html?: string
    explanation_html?: string
    key_points?:       string[]
  }
}

interface QuizCase {
  case_id:      string
  title?:       string
  exhibit_html?: string
}

interface QuizData {
  question_type?: string
  questions:      QuizQuestion[]
  cases?:         QuizCase[]
}

interface Props { quizJson: string }

const SPECIAL = ['all of the above','all of these','all of the given','none of the above']
const isSpecial = (t: string) => SPECIAL.includes(t.trim().toLowerCase())
const hasBothAB = (opts: QuizOption[]) => opts.some(o => /\bboth\s+[a-z]\s+and\s+[a-z]\b/i.test(o.label))

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pinSpecial(opts: QuizOption[]): QuizOption[] {
  const normals  = opts.filter(o => !isSpecial(o.label))
  const specials = opts.filter(o =>  isSpecial(o.label))
  return [...normals, ...specials]
}

function normaliseOptions(q: QuizQuestion): QuizOption[] {
  if (!q.options?.length) return [{ label: 'True', value: 'True' }, { label: 'False', value: 'False' }]
  return q.options.map(o => typeof o === 'string' ? { label: o as string, value: o as string } : o)
}

function getCorrectLabel(q: QuizQuestion, opts: QuizOption[]): string {
  if (q.correctIndex !== undefined) return opts[q.correctIndex]?.label ?? ''
  if (q.correct !== undefined) {
    const c = String(q.correct)
    // Try label/value match FIRST — prevents numeric labels like "3" being
    // misread as array index 3
    const found = opts.find(o => o.value === c || o.label === c)
    if (found) return found.label
    // Fall back to numeric index only if no label match found
    if (!isNaN(Number(c))) return opts[Number(c)]?.label ?? c
    return c
  }
  return ''
}

function qId(q: QuizQuestion, idx: number): string {
  return q.id?.trim() || q.key?.trim() || String(idx)
}

export default function QuizRenderer({ quizJson }: Props) {
  const [quiz, setQuiz]           = useState<QuizData | null>(null)
  const [error, setError]         = useState('')
  const [selected, setSelected]   = useState<{ orig: number; q: QuizQuestion; opts: QuizOption[]; correctLabel: string }[]>([])
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [writing, setWriting]     = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [revealed, setRevealed]   = useState<Record<string, boolean>>({})
  const [session, setSession]     = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const actionBarRef = useRef<HTMLDivElement>(null)

  const buildSession = useCallback((data: QuizData) => {
    const qtype = (data.question_type ?? 'mcq').toLowerCase()
    const qs    = data.questions ?? []
    if (qtype === 'scenario') {
      setSelected(qs.map((q, i) => { const opts = normaliseOptions(q); return { orig: i, q, opts, correctLabel: getCorrectLabel(q, opts) } }))
    } else {
      const indices = shuffle(qs.map((_, i) => i)).slice(0, Math.min(10, qs.length))
      const entries = shuffle(indices).map(i => {
        const q          = qs[i]
        const opts       = normaliseOptions(q)
        const correctLabel = getCorrectLabel(q, opts)
        const shuf       = !hasBothAB(opts) ? shuffle(opts) : opts
        return { orig: i, q, opts: pinSpecial(shuf), correctLabel }
      })
      setSelected(entries)
    }
    setAnswers({})
    setWriting({})
    setSubmitted(false)
    setRevealed({})
  }, [])

  useEffect(() => {
    try {
      const data = JSON.parse(quizJson) as QuizData
      if (!data.questions?.length) { setError('No questions found in this quiz.'); return }
      setQuiz(data)
      buildSession(data)
    } catch {
      setError('Quiz data could not be loaded.')
    }
  }, [quizJson, buildSession, session])

  const handleRetry = () => setSession(s => s + 1)

  const handleSubmitClick = () => {
    if (allAnswered) {
      setSubmitted(true)
    } else {
      setShowWarning(true)
    }
  }

  const setAnswer = (id: string, val: string) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [id]: val }))
  }

  const answeredCount = selected.filter(({ q, orig }) => {
    const id = qId(q, orig)
    const type = (q.type ?? 'single').toLowerCase()
    if (type === 'writing') return !!writing[id]?.trim()
    return !!answers[id]
  }).length

  const allAnswered = answeredCount === selected.length

  if (error) return (
    <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
  )
  if (!quiz || !selected.length) return (
    <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-sm text-center">Loading quiz…</div>
  )

  const qtype   = (quiz.question_type ?? 'mcq').toLowerCase()
  const caseMap = Object.fromEntries((quiz.cases ?? []).map(c => [String(c.case_id), c]))

  // Score
  let correct = 0; let gradedTotal = 0
  selected.forEach(({ q, orig, opts, correctLabel }) => {
    const type = (q.type ?? 'single').toLowerCase()
    if (type === 'writing') return
    gradedTotal++
    const id       = qId(q, orig)
    const userVal  = answers[id]
    const userLabel    = opts.find(o => o.value === userVal)?.label ?? userVal ?? ''
    if (userLabel && correctLabel && userLabel.trim().toLowerCase() === correctLabel.trim().toLowerCase()) correct++
  })
  const pct = gradedTotal > 0 ? Math.round((correct / gradedTotal) * 100) : 0

  // Topic breakdown
  const topicMap: Record<string, { correct: number; total: number }> = {}
  if (submitted) {
    selected.forEach(({ q, orig, opts, correctLabel }) => {
      const type  = (q.type ?? 'single').toLowerCase()
      if (type === 'writing') return
      const topic = q.meta?.primaryTopic ?? 'General'
      if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0 }
      topicMap[topic].total++
      const id           = qId(q, orig)
      const userLabel    = opts.find(o => o.value === answers[id])?.label ?? answers[id] ?? ''
      if (userLabel.trim().toLowerCase() === correctLabel.trim().toLowerCase()) topicMap[topic].correct++
    })
  }

  // Scenario grouping
  const scenarioGroups: { caseObj: QuizCase | null; entries: typeof selected }[] = []
  if (qtype === 'scenario') {
    const groups: Record<string, typeof selected> = {}
    selected.forEach(entry => {
      const cid = entry.q.case_id != null ? String(entry.q.case_id) : '_none'
      if (!groups[cid]) groups[cid] = []
      groups[cid].push(entry)
    })
    Object.entries(groups).forEach(([cid, entries]) => {
      scenarioGroups.push({ caseObj: caseMap[cid] ?? null, entries })
    })
  }

  return (
    <div className="mt-10 pt-10 border-t border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-navy-950">Practice Questions</h2>
        {qtype !== 'scenario' && (
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-navy-50 text-navy-700 border border-navy-200">
            {selected.length} questions
          </span>
        )}
      </div>

      {!submitted && (
        <QuizProgress current={answeredCount} total={selected.length} answered={answeredCount} />
      )}

      {/* SCORE BANNER */}
      {submitted && gradedTotal > 0 && (
        <div className={`mb-8 p-6 rounded-xl border ${pct >= 70 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className={`font-display text-3xl font-bold ${pct >= 70 ? 'text-teal-700' : 'text-red-700'}`}>
                {correct}/{gradedTotal} correct — {pct}%
              </p>
              <p className={`text-sm mt-1 ${pct >= 70 ? 'text-teal-600' : 'text-red-600'}`}>
                {pct >= 70 ? 'Well done — you passed this set.' : 'Keep practising — review the explanations below.'}
              </p>
            </div>
            <button onClick={handleRetry} className="h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
              Try a new set
            </button>
          </div>
        </div>
      )}

      {/* TOPIC BREAKDOWN */}
      {submitted && Object.keys(topicMap).length > 1 && (
        <div className="mb-8 rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">By Topic</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2 text-slate-500 font-medium">Topic</th>
                <th className="text-right px-5 py-2 text-slate-500 font-medium">Score</th>
                <th className="text-right px-5 py-2 text-slate-500 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(topicMap).map(([topic, data]) => (
                <tr key={topic} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-2 text-navy-950 font-medium">{topic}</td>
                  <td className="px-5 py-2 text-right text-slate-600">{data.correct}/{data.total}</td>
                  <td className="px-5 py-2 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${Math.round((data.correct/data.total)*100) >= 70 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                      {Math.round((data.correct / data.total) * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* QUESTIONS */}
      <div className="space-y-6">
        {qtype === 'scenario' ? (
          scenarioGroups.map(({ caseObj, entries }, gi) => (
            <div key={gi} className="rounded-xl border border-slate-200 overflow-hidden">
              {caseObj?.title && (
                <div className="bg-navy-950 px-6 py-4">
                  <h3 className="font-display text-white text-lg">{caseObj.title}</h3>
                </div>
              )}
              {caseObj?.exhibit_html && (
                <div className="bg-navy-50 border-b border-slate-200 px-6 py-5">
                  <p className="text-xs font-semibold text-navy-500 uppercase tracking-widest mb-3">Case Exhibit</p>
                  <div className="text-sm text-slate-700 leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{ __html: caseObj.exhibit_html }} />
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {entries.map((entry, ei) => (
                  <QuestionItem key={ei} entry={entry} index={ei} submitted={submitted} answers={answers} writing={writing} revealed={revealed} setAnswer={setAnswer} setWriting={(id, val) => setWriting(prev => ({ ...prev, [id]: val }))} setRevealed={(id) => setRevealed(prev => ({ ...prev, [id]: true }))} correctLabel={entry.correctLabel} />
                ))}
              </div>
            </div>
          ))
        ) : (
          selected.map((entry, i) => (
            <QuestionItem key={i} entry={entry} index={i} submitted={submitted} answers={answers} writing={writing} revealed={revealed} setAnswer={setAnswer} setWriting={(id, val) => setWriting(prev => ({ ...prev, [id]: val }))} setRevealed={(id) => setRevealed(prev => ({ ...prev, [id]: true }))} correctLabel={entry.correctLabel} />
          ))
        )}
      </div>

      {/* STICKY ACTION BAR */}
      {!submitted && (
        <>
          {/* Warning dialog */}
          {showWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-navy-950">Unanswered questions</p>
                    <p className="text-sm text-slate-500">{selected.length - answeredCount} question{selected.length - answeredCount !== 1 ? 's' : ''} left unanswered.</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-6">You can still submit, but unanswered questions will be marked as incorrect. Are you sure you want to continue?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWarning(false)}
                    className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-navy-300 transition-colors"
                  >
                    Go back
                  </button>
                  <button
                    onClick={() => { setShowWarning(false); setSubmitted(true) }}
                    className="flex-1 h-10 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors"
                  >
                    Submit anyway
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={actionBarRef} className="sticky bottom-0 z-30 mt-8 -mx-4 px-4 py-4 bg-white border-t border-slate-200 shadow-lg">
            <div className="container-site flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                {answeredCount < selected.length
                  ? <span><span className="font-semibold text-navy-950">{selected.length - answeredCount}</span> question{selected.length - answeredCount !== 1 ? 's' : ''} remaining</span>
                  : <span className="text-teal-600 font-medium">All questions answered — ready to submit!</span>}
              </p>
              <button
                onClick={handleSubmitClick}
                className="h-11 px-7 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors whitespace-nowrap"
              >
                Submit answers
              </button>
            </div>
          </div>
        </>
      )}

      {submitted && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button onClick={handleRetry} className="h-11 px-7 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">
            Try a new set
          </button>
          <a href="/practice-questions" className="h-11 px-7 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors flex items-center">
            Browse more questions
          </a>
        </div>
      )}
    </div>
  )
}

function QuestionItem({ entry, index, submitted, answers, writing, revealed, setAnswer, setWriting, setRevealed, correctLabel }: {
  entry:       { orig: number; q: QuizQuestion; opts: QuizOption[] }
  index:       number
  submitted:   boolean
  answers:     Record<string, string>
  writing:     Record<string, string>
  revealed:    Record<string, boolean>
  setAnswer:   (id: string, val: string) => void
  setWriting:  (id: string, val: string) => void
  setRevealed: (id: string) => void
  correctLabel: string
}) {
  const { q, orig, opts } = entry
  const id     = qId(q, orig)
  const type   = (q.type ?? 'single').toLowerCase()
  const isWriting  = type === 'writing'
  const userVal    = answers[id]
  const userLabel    = opts.find(o => o.value === userVal)?.label ?? userVal ?? ''
  const isCorrect    = submitted && !isWriting && userLabel.trim().toLowerCase() === correctLabel.trim().toLowerCase()
  const isWrong      = submitted && !isWriting && !!userVal && !isCorrect

  return (
    <div className={`p-6 rounded-xl border transition-all ${
      !submitted ? 'bg-white border-slate-200' :
      isWriting  ? 'bg-white border-slate-200' :
      isCorrect  ? 'bg-teal-50 border-teal-200' :
      isWrong    ? 'bg-red-50 border-red-200' :
      'bg-white border-slate-200'
    }`}>
      {/* Question number + text */}
      <div className="flex items-start gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-navy-950 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {index + 1}
        </span>
        <p className="text-sm font-semibold text-navy-950 leading-snug flex-1">{q.question}</p>
      </div>

      {/* WRITING TYPE */}
      {isWriting && (
        <div className="ml-10">
          {q.writing?.prompt && (
            <p className="text-sm text-slate-600 mb-3 italic">{q.writing.prompt}</p>
          )}
          <textarea
            rows={5}
            value={writing[id] ?? ''}
            onChange={e => setWriting(id, e.target.value)}
            disabled={revealed[id]}
            placeholder="Type your answer here…"
            className="w-full text-sm border border-slate-200 rounded-lg px-4 py-3 resize-y focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
          />
          {!revealed[id] && (
            <button
              onClick={() => setRevealed(id)}
              disabled={!writing[id]?.trim()}
              className="mt-3 h-9 px-5 rounded-lg text-xs font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reveal model answer
            </button>
          )}
          {revealed[id] && (
            <div className="mt-4 space-y-3">
              {q.writing?.model_answer_html && (
                <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-widest mb-2">Model Answer</p>
                  <div className="text-sm text-teal-800 leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{ __html: q.writing.model_answer_html }} />
                </div>
              )}
              {q.writing?.explanation_html && (
                <div className="p-4 rounded-lg bg-navy-50 border border-navy-200">
                  <p className="text-xs font-semibold text-navy-500 uppercase tracking-widest mb-2">Explanation</p>
                  <div className="text-sm text-navy-800 leading-relaxed prose max-w-none" dangerouslySetInnerHTML={{ __html: q.writing.explanation_html }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MCQ / SCENARIO OPTIONS */}
      {!isWriting && (
        <div className="ml-10 space-y-2">
          {opts.map((opt, oi) => {
            const isSelected  = userVal === opt.value
            const isThisRight = submitted && opt.label.trim().toLowerCase() === correctLabel.trim().toLowerCase()
            const isThisWrong = submitted && isSelected && !isThisRight
            return (
              <button
                key={oi}
                onClick={() => setAnswer(id, opt.value)}
                disabled={submitted}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                  isThisRight  ? 'bg-teal-50 border-teal-400 text-teal-800 font-semibold' :
                  isThisWrong  ? 'bg-red-50 border-red-400 text-red-800' :
                  isSelected   ? 'bg-navy-50 border-navy-400 text-navy-900 font-medium' :
                  'bg-white border-slate-200 text-slate-700 hover:border-navy-300 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold ${
                    isThisRight ? 'bg-teal-500 border-teal-500 text-white' :
                    isThisWrong ? 'bg-red-500 border-red-500 text-white' :
                    isSelected  ? 'bg-navy-950 border-navy-950 text-white' :
                    'border-slate-300'
                  }`}>
                    {isThisRight ? '✓' : isThisWrong ? '✗' : String.fromCharCode(65 + oi)}
                  </span>
                  {opt.label}
                </span>
              </button>
            )
          })}

          {/* Explanation */}
          {submitted && q.explanation && (
            <ExplanationRenderer explanation={q.explanation} dark={false} />
          )}

          {/* No answer warning */}
          {submitted && !userVal && (
            <p className="text-xs text-slate-400 mt-2 italic">Not answered — correct answer: {correctLabel}</p>
          )}
        </div>
      )}
    </div>
  )
}
