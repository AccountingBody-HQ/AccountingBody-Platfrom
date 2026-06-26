'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Question {
  questionText: string
  options: string[]
  correctIndex: number
  explanation?: string
  difficulty?: string
  topic: string
}

interface Props {
  level: string
  module: string
  moduleName: string
  backHref: string
  apiPath?: string
}

type Phase = 'intro' | 'exam' | 'results'

export default function MockExamClient({ level, module, moduleName, backHref, apiPath = '/api/eticpa/mock-exam' }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // poolTotal removed
  const [secondsLeft, setSecondsLeft] = useState(50 * 90) // 90s per question
  const [reviewIdx, setReviewIdx] = useState<number | null>(null)

  const loadExam = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${apiPath}?level=${level}&module=${module}&count=50`, { cache: 'no-store' })
      const data = await res.json()
      if (data.error || !data.questions?.length) { setError(data.error || 'No questions available yet.'); setLoading(false); return }
      setQuestions(data.questions)
      // poolTotal not needed
      setAnswers({})
      setCurrent(0)
      setSecondsLeft(Math.min(data.questions.length, 50) * 90)
      setPhase('exam')
    } catch {
      setError('Could not load the exam. Please try again.')
    }
    setLoading(false)
  }, [level, module])

  useEffect(() => {
    if (phase !== 'exam') return
    if (secondsLeft <= 0) { setPhase('results'); return }
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase, secondsLeft])

  const answered = Object.keys(answers).length
  const handleSubmit = () => {
    const unanswered = questions.length - answered
    if (unanswered > 0) {
      const ok = window.confirm(
        `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Unanswered questions are marked incorrect. Submit anyway?`
      )
      if (!ok) return
    }
    setPhase('results')
  }
  const score = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0)
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  const GREEN = '#1A4731'
  const GOLD = '#C9982A'

  // ── INTRO ──
  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: backHref === "/mock-exams" ? "#0C1A3D" : GREEN }}>
            <svg className="w-8 h-8" fill="none" stroke={GOLD} viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h1 className="font-display text-2xl md:text-3xl text-navy-950 mb-3">{moduleName} Mock Exam</h1>
          <p className="text-slate-500 leading-relaxed mb-8">50 questions randomly selected and balanced across all topics. You have 75 minutes. Every attempt gives you a fresh set.</p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[{ v: '50', l: 'Questions' }, { v: '75', l: 'Minutes' }, { v: '60%', l: 'Pass mark' }].map(s => (
              <div key={s.l} className="rounded-xl p-4" style={{ backgroundColor: '#f0f7f4' }}>
                <p className="font-display text-2xl" style={{ color: GREEN }}>{s.v}</p>
                <p className="text-xs text-slate-400 mt-1">{s.l}</p>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{error}</p>}
          <button onClick={loadExam} disabled={loading}
            className="w-full h-12 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: GREEN }}>
            {loading ? 'Preparing your exam…' : 'Start Mock Exam'}
          </button>
          <Link href={backHref} className="inline-block mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors">← {backHref === "/mock-exams" ? "Back to Mock Exams" : "Back to module"}</Link>
        </div>
      </div>
    )
  }

  // ── RESULTS ──
  if (phase === 'results') {
    const passed = pct >= 60
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 md:p-10 mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Exam Complete</p>
          <div className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center border-4"
            style={{ borderColor: passed ? GREEN : GOLD }}>
            <span className="font-display text-3xl" style={{ color: passed ? GREEN : GOLD }}>{pct}%</span>
          </div>
          <h1 className="font-display text-2xl text-navy-950 mb-2">{passed ? 'Well done — you passed!' : 'Keep practising'}</h1>
          <p className="text-slate-500 mb-6">You scored {score} out of {questions.length} ({answered} answered)</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={loadExam} className="h-11 px-6 rounded-lg text-sm font-semibold transition-colors" style={{ backgroundColor: GREEN, color: 'white' }}>Take a fresh exam</button>
            <Link href={backHref} className="h-11 px-6 rounded-lg text-sm font-semibold border-2 inline-flex items-center justify-center transition-colors" style={{ borderColor: GREEN, color: GREEN }}>Back to module</Link>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-lg text-navy-950 mb-4">Review your answers</h2>
          {questions.map((q, i) => {
            const userAns = answers[i]
            const correct = userAns === q.correctIndex
            const open = reviewIdx === i
            return (
              <div key={i} className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: correct ? '#bbf7d0' : '#fecaca' }}>
                <button onClick={() => setReviewIdx(open ? null : i)} className="w-full flex items-start gap-3 px-5 py-4 text-left">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white" style={{ backgroundColor: correct ? '#16a34a' : '#dc2626' }}>
                    {correct ? '✓' : '✗'}
                  </span>
                  <span className="flex-1 text-sm font-medium text-navy-950">{i + 1}. {q.questionText}</span>
                  <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {open && (
                  <div className="px-5 pb-5 space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="text-sm px-3 py-2 rounded-lg border"
                        style={oi === q.correctIndex ? { backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }
                          : oi === userAns ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }
                          : { borderColor: '#e2e8f0', color: '#64748b' }}>
                        {oi === q.correctIndex && <span className="font-bold mr-1">✓</span>}
                        {oi === userAns && oi !== q.correctIndex && <span className="font-bold mr-1">✗</span>}
                        {opt}
                      </div>
                    ))}
                    {q.explanation && <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100 mt-3">{q.explanation}</p>}
                    <p className="text-xs text-slate-400 pt-1">Topic: {q.topic}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── EXAM ──
  const q = questions[current]
  return (
    <div className="max-w-3xl mx-auto">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-50 py-3 z-10">
        <span className="text-sm font-semibold text-navy-950">Question {current + 1} of {questions.length}</span>
        <span className="text-sm font-bold px-3 py-1 rounded-lg" style={{ backgroundColor: secondsLeft < 300 ? '#fef2f2' : '#f0f7f4', color: secondsLeft < 300 ? '#dc2626' : GREEN }}>
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </div>

      {/* Progress */}
      <div className="w-full h-1.5 bg-slate-200 rounded-full mb-8 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%`, backgroundColor: GREEN }} />
      </div>

      {/* Question */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: GOLD }}>{q.topic}</p>
        <h2 className="font-display text-lg md:text-xl text-navy-950 leading-snug mb-6">{q.questionText}</h2>
        <div className="space-y-3">
          {q.options.map((opt, oi) => {
            const sel = answers[current] === oi
            return (
              <button key={oi} onClick={() => setAnswers(a => ({ ...a, [current]: oi }))}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left text-sm transition-all"
                style={sel ? { borderColor: GREEN, backgroundColor: '#f0f7f4' } : { borderColor: '#e2e8f0' }}>
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                  style={sel ? { borderColor: GREEN, backgroundColor: GREEN, color: 'white' } : { borderColor: '#cbd5e1', color: '#94a3b8' }}>
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className={sel ? 'text-navy-950 font-medium' : 'text-slate-600'}>{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
          className="h-11 px-5 rounded-lg text-sm font-semibold border-2 transition-colors disabled:opacity-30"
          style={{ borderColor: GREEN, color: GREEN }}>← Previous</button>
        <span className="text-xs text-slate-400">{answered} of {questions.length} answered</span>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
            className="h-11 px-5 rounded-lg text-sm font-semibold transition-colors" style={{ backgroundColor: GREEN, color: 'white' }}>Next →</button>
        ) : (
          <button onClick={handleSubmit}
            className="h-11 px-5 rounded-lg text-sm font-semibold transition-colors" style={{ backgroundColor: GOLD, color: GREEN }}>Submit Exam</button>
        )}
      </div>
      {/* Always-available submit */}
      <div className="mt-4 text-center">
        <button onClick={handleSubmit}
          className="h-11 px-6 rounded-lg text-sm font-semibold border-2 transition-colors"
          style={{ borderColor: GOLD, color: GREEN }}>Finish &amp; submit exam</button>
        <p className="text-xs text-slate-400 mt-2">{answered} of {questions.length} answered — you can submit at any time.</p>
      </div>

      {/* Question grid */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Jump to question</p>
        <div className="flex flex-wrap gap-2">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-9 h-9 rounded-lg text-xs font-semibold transition-colors"
              style={i === current ? { backgroundColor: GREEN, color: 'white' }
                : answers[i] !== undefined ? { backgroundColor: '#d1e8db', color: GREEN }
                : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
