'use client'
import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SanityQuestion {
  id:                  string
  type:                'multiple-choice' | 'writing' | 'scenario'
  questionText:        string
  options?:            string[]
  correctIndex?:       number
  explanation?:        string
  writingModelAnswer?: string
  writingExplanation?: string
  caseId?:             string
  primaryTopic?:       string
  difficulty?:         'beginner' | 'intermediate' | 'advanced'
  timeTargetMinutes?:  number
  points?:             number
}

interface SanityCase {
  caseId:       string
  title:        string
  exhibitHtml?: string
}

export interface QuizBankData {
  _id?:          string
  title:         string
  showTimer:     boolean
  showMap:       boolean
  theme:         'light' | 'dark'
  cases?:        SanityCase[]
  quizQuestions: SanityQuestion[]
  rawJson?:      string
}

interface Props { data: QuizBankData }

// ── Raw JSON parser ───────────────────────────────────────────────────────────
// Maps the bulk JSON format (produced externally) to SanityQuestion shape.
// Handles both field naming conventions so old and new JSON both work.

interface RawQuestion {
  id?:           string
  question?:     string       // bulk JSON uses "question"
  questionText?: string       // structured Sanity uses "questionText"
  type?:         string
  options?:      string[]
  answer?:       number       // bulk JSON uses "answer" for correct index
  correctIndex?: number       // structured uses "correctIndex"
  explanation?:  string
  meta?: {
    primary_topic?:       string
    difficulty?:          string
    time_target_minutes?: number
  }
  primaryTopic?:        string
  difficulty?:          string
  timeTargetMinutes?:   number
  writingModelAnswer?:  string
  writingExplanation?:  string
  caseId?:              string
  points?:              number
}

function parseRawJson(raw: string): SanityQuestion[] {
  try {
    const parsed = JSON.parse(raw)
    const qs: RawQuestion[] = Array.isArray(parsed)
      ? parsed
      : parsed.questions ?? []
    return qs.map((q, i): SanityQuestion => ({
      id:                 q.id ?? String(i),
      type:               (q.type as SanityQuestion['type']) ?? 'multiple-choice',
      questionText:       q.question ?? q.questionText ?? '',
      options:            q.options ?? [],
      correctIndex:       q.correctIndex ?? q.answer ?? 0,
      explanation:        q.explanation,
      writingModelAnswer: q.writingModelAnswer,
      writingExplanation: q.writingExplanation,
      caseId:             q.caseId,
      primaryTopic:       q.meta?.primary_topic ?? q.primaryTopic,
      difficulty:         (q.meta?.difficulty?.toLowerCase() as SanityQuestion['difficulty']) ?? (q.difficulty as SanityQuestion['difficulty']),
      timeTargetMinutes:  q.meta?.time_target_minutes ?? q.timeTargetMinutes,
      points:             q.points ?? 1,
    }))
  } catch {
    return []
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

const DIFF_LABEL: Record<string, string> = {
  beginner: 'Easy', intermediate: 'Medium', advanced: 'Hard',
}
const DIFF_CLS_LIGHT: Record<string, string> = {
  beginner:     'bg-teal-50 text-teal-700 border border-teal-200',
  intermediate: 'bg-gold-50 text-gold-600 border border-gold-200',
  advanced:     'bg-crimson-50 text-crimson-600 border border-crimson-200',
}
const DIFF_CLS_DARK: Record<string, string> = {
  beginner:     'bg-teal-900/40 text-teal-300 border border-teal-700',
  intermediate: 'bg-gold-900/30 text-gold-300 border border-gold-700',
  advanced:     'bg-crimson-900/30 text-crimson-300 border border-crimson-700',
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuizBankRenderer({ data }: Props) {
  const { title, showTimer, showMap, theme, quizQuestions, cases } = data
  const safeQuestions = quizQuestions ?? []
  const safeCases = cases ?? []
  const dark = theme === 'dark'

  const [currentIdx, setCurrentIdx]   = useState(0)
  const [answers, setAnswers]         = useState<Record<string, string>>({})
  const [writing, setWriting]         = useState<Record<string, string>>({})
  const [submitted, setSubmitted]     = useState(false)
  const [revealed, setRevealed]       = useState<Record<string, boolean>>({})
  const [elapsed, setElapsed]         = useState(0)
  const [timerActive, setTimerActive] = useState(true)

  // Use rawJson if present (bulk workflow), otherwise use structured questions
  const parsedRaw  = data.rawJson ? parseRawJson(data.rawJson) : []
  const questions  = parsedRaw.length > 0 ? parsedRaw : safeQuestions
  const caseMap   = Object.fromEntries(safeCases.map(c => [c.caseId, c]))
  const total     = questions.length
  const q         = questions[currentIdx]

  // Timer
  useEffect(() => {
    if (!showTimer || submitted || !timerActive) return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [showTimer, submitted, timerActive])

  useEffect(() => { if (submitted) setTimerActive(false) }, [submitted])

  if (!q || total === 0) return (
    <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-sm text-center">
      No questions found in this quiz.
    </div>
  )

  // ── Answer state helpers ──────────────────────────────────────────────────

  const isAnswered = (idx: number) => {
    const qq = questions[idx]
    if (!qq) return false
    return qq.type === 'writing' ? !!(writing[qq.id]?.trim()) : !!answers[qq.id]
  }

  const answeredCount = questions.filter((_, i) => isAnswered(i)).length
  const allAnswered   = answeredCount === total

  // ── Score & topic breakdown ───────────────────────────────────────────────

  let correct = 0; let gradedTotal = 0
  const topicMap: Record<string, { correct: number; total: number }> = {}

  if (submitted) {
    questions.forEach(qq => {
      if (qq.type === 'writing') return
      gradedTotal++
      const topic = qq.primaryTopic ?? 'General'
      if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0 }
      topicMap[topic].total++
      const correctLabel = qq.options?.[qq.correctIndex ?? 0] ?? ''
      const userLabel    = answers[qq.id] ?? ''
      if (userLabel.trim().toLowerCase() === correctLabel.trim().toLowerCase()) {
        correct++; topicMap[topic].correct++
      }
    })
  }

  const pct = gradedTotal > 0 ? Math.round((correct / gradedTotal) * 100) : 0

  // ── Question map ─────────────────────────────────────────────────────────

  type MapState = 'current' | 'correct' | 'wrong' | 'answered' | 'unanswered'

  const mapState = (idx: number): MapState => {
    if (idx === currentIdx) return 'current'
    const qq = questions[idx]
    if (!qq || qq.type === 'writing') return isAnswered(idx) ? 'answered' : 'unanswered'
    if (!submitted) return isAnswered(idx) ? 'answered' : 'unanswered'
    const correctLabel = qq.options?.[qq.correctIndex ?? 0] ?? ''
    const userLabel    = answers[qq.id] ?? ''
    if (!userLabel) return 'unanswered'
    return userLabel.trim().toLowerCase() === correctLabel.trim().toLowerCase() ? 'correct' : 'wrong'
  }

  const mapCellCls = (state: MapState): string => {
    if (dark) {
      switch (state) {
        case 'current':    return 'bg-gold-500 text-navy-950 font-bold ring-2 ring-gold-400 ring-offset-1 ring-offset-navy-950'
        case 'correct':    return 'bg-teal-600 text-white'
        case 'wrong':      return 'bg-crimson-600 text-white'
        case 'answered':   return 'bg-navy-600 text-white'
        case 'unanswered': return 'bg-navy-800 text-white/40 border border-white/10'
      }
    } else {
      switch (state) {
        case 'current':    return 'bg-navy-950 text-white font-bold ring-2 ring-navy-300 ring-offset-1'
        case 'correct':    return 'bg-teal-500 text-white'
        case 'wrong':      return 'bg-crimson-500 text-white'
        case 'answered':   return 'bg-navy-200 text-navy-950'
        case 'unanswered': return 'bg-slate-100 text-slate-400 border border-slate-200'
      }
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setAnswers({}); setWriting({}); setSubmitted(false)
    setRevealed({}); setCurrentIdx(0); setElapsed(0); setTimerActive(true)
  }

  // ── Question result state ─────────────────────────────────────────────────

  const qCorrectLabel = q.options?.[q.correctIndex ?? 0] ?? ''
  const qUserLabel    = answers[q.id] ?? ''
  const qIsCorrect    = submitted && q.type !== 'writing' && !!qUserLabel &&
    qUserLabel.trim().toLowerCase() === qCorrectLabel.trim().toLowerCase()
  const qIsWrong      = submitted && q.type !== 'writing' && !!qUserLabel && !qIsCorrect

  // ── Theme tokens ──────────────────────────────────────────────────────────

  const T = {
    wrap:      dark ? 'bg-navy-950 border border-white/10 shadow-2xl' : 'bg-white border border-slate-200 shadow-md',
    header:    dark ? 'bg-navy-900/70 border-b border-white/10'        : 'bg-slate-50 border-b border-slate-200',
    mapWrap:   dark ? 'bg-navy-900/60 border border-white/10'          : 'bg-slate-50 border border-slate-200',
    mapDiv:    dark ? 'border-white/10'                                : 'border-slate-200',
    qCard:     dark ? 'bg-navy-900 border border-white/10'             : 'bg-white border border-slate-200 shadow-sm',
    qMeta:     dark ? 'bg-white/5 border-b border-white/10'            : 'bg-slate-50/80 border-b border-slate-100',
    navBtn:    dark ? 'border border-white/20 text-white/80 hover:bg-white/10 disabled:opacity-25' : 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-30',
    label2xs:  dark ? 'text-white/40'  : 'text-slate-400',
    bodyText:  dark ? 'text-white'     : 'text-navy-950',
    bodyMuted: dark ? 'text-white/60'  : 'text-slate-500',
    explain:   dark ? 'bg-white/5 border border-white/10'              : 'bg-navy-50 border border-navy-200',
    explainTxt:dark ? 'text-white/70'  : 'text-navy-800',
    explainHd: dark ? 'text-white/40'  : 'text-navy-500',
    counter:   dark ? 'bg-white/10 text-white/70 border-transparent'   : 'bg-navy-50 text-navy-600 border border-navy-200',
    timer:     dark ? 'bg-white/10 text-white border-transparent'      : 'bg-navy-50 text-navy-700 border border-navy-200',
  }

  return (
    <div className={`my-10 rounded-2xl overflow-hidden ${T.wrap}`}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className={`${T.header} px-5 py-4 flex items-center justify-between gap-3 flex-wrap`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-gold-500' : 'bg-navy-950'}`}>
            <svg className={`w-4 h-4 ${dark ? 'text-navy-950' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className={`font-display text-base font-semibold leading-tight truncate ${T.bodyText}`}>{title}</h3>
            <p className={`text-xs mt-0.5 ${T.bodyMuted}`}>
              {submitted ? `${correct}/${gradedTotal} correct · ${pct}%` : `${answeredCount} of ${total} answered`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showTimer && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border ${T.timer}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
              </svg>
              {formatTime(elapsed)}
            </div>
          )}
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${T.counter}`}>
            {currentIdx + 1} / {total}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">

        {/* ── Progress bar ─────────────────────────────────────────── */}
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ease-decelerate ${
              submitted ? (pct >= 70 ? 'bg-teal-500' : 'bg-crimson-500') : 'bg-gold-500'
            }`}
            style={{ width: `${submitted ? pct : Math.round((answeredCount / total) * 100)}%` }}
          />
        </div>

        {/* ── Question Map ─────────────────────────────────────────── */}
        {showMap && (
          <div className={`${T.mapWrap} rounded-xl p-4`}>
            <p className={`text-[0.625rem] font-semibold uppercase tracking-widest mb-3 ${T.label2xs}`}>
              Question Map — click to navigate
            </p>
            <div className="flex flex-wrap gap-1.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  aria-label={`Go to question ${i + 1}`}
                  className={`w-8 h-8 rounded-md text-xs transition-all duration-150 ${mapCellCls(mapState(i))}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className={`flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t ${T.mapDiv}`}>
              {[
                { label: 'Current',    cls: dark ? 'bg-gold-500' : 'bg-navy-950' },
                { label: 'Answered',   cls: dark ? 'bg-navy-600' : 'bg-navy-200' },
                { label: 'Remaining',  cls: dark ? 'bg-navy-800 border border-white/10' : 'bg-slate-100 border border-slate-200' },
                ...(submitted ? [
                  { label: 'Correct', cls: dark ? 'bg-teal-600' : 'bg-teal-500' },
                  { label: 'Wrong',   cls: dark ? 'bg-crimson-600' : 'bg-crimson-500' },
                ] : []),
              ].map(({ label, cls }) => (
                <span key={label} className={`flex items-center gap-1.5 text-[0.625rem] ${T.label2xs}`}>
                  <span className={`w-3 h-3 rounded-sm shrink-0 ${cls}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Results Banner ───────────────────────────────────────── */}
        {submitted && gradedTotal > 0 && (
          <div className={`p-5 rounded-xl border ${
            pct >= 70
              ? dark ? 'bg-teal-900/30 border-teal-700' : 'bg-teal-50 border-teal-200'
              : dark ? 'bg-crimson-900/30 border-crimson-700' : 'bg-crimson-50 border-crimson-200'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className={`font-display text-2xl font-bold ${pct >= 70 ? (dark ? 'text-teal-300' : 'text-teal-700') : (dark ? 'text-crimson-300' : 'text-crimson-700')}`}>
                  {correct}/{gradedTotal} · {pct}%
                </p>
                <p className={`text-sm mt-1 ${pct >= 70 ? (dark ? 'text-teal-400' : 'text-teal-600') : (dark ? 'text-crimson-400' : 'text-crimson-600')}`}>
                  {pct >= 70 ? 'Great work — you passed this quiz.' : 'Keep practising — review the explanations.'}
                </p>
                {showTimer && (
                  <p className={`text-xs mt-1 ${T.bodyMuted}`}>Time taken: {formatTime(elapsed)}</p>
                )}
              </div>
              <button onClick={handleReset} className="h-9 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                Retry quiz
              </button>
            </div>
          </div>
        )}

        {/* ── Topic Breakdown ──────────────────────────────────────── */}
        {submitted && Object.keys(topicMap).length > 1 && (
          <div className={`rounded-xl overflow-hidden border ${dark ? 'border-white/10' : 'border-slate-200'}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-[0.625rem] font-semibold uppercase tracking-widest ${T.label2xs}`}>Performance by Topic</p>
            </div>
            <div className={`divide-y ${dark ? 'divide-white/10' : 'divide-slate-100'}`}>
              {Object.entries(topicMap).map(([topic, td]) => {
                const tp = Math.round((td.correct / td.total) * 100)
                return (
                  <div key={topic} className="flex items-center justify-between px-5 py-2.5">
                    <span className={`text-sm font-medium ${T.bodyText}`}>{topic}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${T.bodyMuted}`}>{td.correct}/{td.total}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tp >= 70 ? (dark ? 'bg-teal-900/50 text-teal-300' : 'bg-teal-50 text-teal-700') : (dark ? 'bg-crimson-900/40 text-crimson-300' : 'bg-crimson-50 text-crimson-700')}`}>
                        {tp}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Question Card ────────────────────────────────────────── */}
        <div className={`${T.qCard} rounded-xl overflow-hidden transition-all duration-200 ${
          qIsCorrect ? (dark ? 'ring-1 ring-teal-600' : 'ring-1 ring-teal-300') :
          qIsWrong   ? (dark ? 'ring-1 ring-crimson-600' : 'ring-1 ring-crimson-300') : ''
        }`}>

          {/* Meta bar */}
          <div className={`${T.qMeta} flex flex-wrap items-center gap-2 px-4 py-3`}>
            <span className={`text-[0.625rem] font-semibold uppercase tracking-wider ${T.label2xs}`}>
              Q{currentIdx + 1}
            </span>
            {q.difficulty && (
              <span className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-full ${dark ? DIFF_CLS_DARK[q.difficulty] : DIFF_CLS_LIGHT[q.difficulty]}`}>
                {DIFF_LABEL[q.difficulty] ?? q.difficulty}
              </span>
            )}
            {q.timeTargetMinutes && (
              <span className={`flex items-center gap-1 text-[0.625rem] font-medium px-2 py-0.5 rounded-full border ${dark ? 'bg-white/10 text-white/50 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                </svg>
                {q.timeTargetMinutes} min
              </span>
            )}
            {q.primaryTopic && (
              <span className={`text-[0.625rem] px-2 py-0.5 rounded-full border ml-auto ${dark ? 'bg-white/10 text-white/50 border-white/10' : 'bg-navy-50 text-navy-500 border-navy-100'}`}>
                {q.primaryTopic}
              </span>
            )}
          </div>

          <div className="p-5">

            {/* Case exhibit */}
            {q.caseId && caseMap[q.caseId] && (
              <div className={`mb-4 p-4 rounded-lg ${dark ? 'bg-white/5 border border-white/10' : 'bg-navy-50 border border-navy-200'}`}>
                {caseMap[q.caseId].title && (
                  <p className={`text-[0.625rem] font-semibold uppercase tracking-widest mb-2 ${dark ? 'text-white/40' : 'text-navy-500'}`}>
                    {caseMap[q.caseId].title}
                  </p>
                )}
                {caseMap[q.caseId].exhibitHtml && (
                  <div
                    className={`text-sm leading-relaxed prose max-w-none ${dark ? 'text-white/70' : 'text-slate-700'}`}
                    dangerouslySetInnerHTML={{ __html: caseMap[q.caseId].exhibitHtml! }}
                  />
                )}
              </div>
            )}

            {/* Question text */}
            <p className={`text-base font-semibold leading-snug mb-5 ${T.bodyText}`}>
              {q.questionText}
            </p>

            {/* ── WRITING TYPE ───────────────────────────────────── */}
            {q.type === 'writing' && (
              <div className="space-y-3">
                <textarea
                  rows={5}
                  value={writing[q.id] ?? ''}
                  onChange={e => setWriting(prev => ({ ...prev, [q.id]: e.target.value }))}
                  disabled={revealed[q.id]}
                  placeholder="Type your answer here…"
                  className={`w-full text-sm border rounded-lg px-4 py-3 resize-y focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    dark
                      ? 'bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:ring-gold-500 disabled:opacity-40'
                      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 focus:ring-navy-950'
                  }`}
                />
                {!revealed[q.id] && (
                  <button
                    onClick={() => setRevealed(prev => ({ ...prev, [q.id]: true }))}
                    disabled={!writing[q.id]?.trim()}
                    className="h-9 px-5 rounded-lg text-xs font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reveal model answer
                  </button>
                )}
                {revealed[q.id] && (
                  <div className="space-y-3 mt-2">
                    {q.writingModelAnswer && (
                      <div className={`p-4 rounded-lg border ${dark ? 'bg-teal-900/30 border-teal-700' : 'bg-teal-50 border-teal-200'}`}>
                        <p className={`text-[0.625rem] font-semibold uppercase tracking-widest mb-2 ${dark ? 'text-teal-400' : 'text-teal-600'}`}>Model Answer</p>
                        <p className={`text-sm leading-relaxed ${dark ? 'text-teal-200' : 'text-teal-800'}`}>{q.writingModelAnswer}</p>
                      </div>
                    )}
                    {q.writingExplanation && (
                      <div className={`p-4 rounded-lg border ${T.explain}`}>
                        <p className={`text-[0.625rem] font-semibold uppercase tracking-widest mb-2 ${T.explainHd}`}>Explanation</p>
                        <p className={`text-sm leading-relaxed ${T.explainTxt}`}>{q.writingExplanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── MCQ / SCENARIO OPTIONS ─────────────────────────── */}
            {q.type !== 'writing' && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected  = answers[q.id] === opt
                  const isThisRight = submitted && oi === q.correctIndex
                  const isThisWrong = submitted && isSelected && !isThisRight

                  const btnCls = dark
                    ? isThisRight ? 'bg-teal-900/40 border-teal-500 text-teal-200 font-semibold'
                    : isThisWrong ? 'bg-crimson-900/30 border-crimson-500 text-crimson-200'
                    : isSelected  ? 'bg-navy-700 border-navy-400 text-white font-medium'
                    : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10 hover:border-white/30'
                    : isThisRight ? 'bg-teal-50 border-teal-400 text-teal-800 font-semibold'
                    : isThisWrong ? 'bg-crimson-50 border-crimson-400 text-crimson-800'
                    : isSelected  ? 'bg-navy-50 border-navy-400 text-navy-900 font-medium'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-navy-300 hover:bg-slate-50'

                  const dotCls = isThisRight ? 'bg-teal-500 border-teal-500 text-white'
                    : isThisWrong ? 'bg-crimson-500 border-crimson-500 text-white'
                    : isSelected  ? 'bg-navy-950 border-navy-950 text-white'
                    : dark        ? 'border-white/30 text-white/50'
                    : 'border-slate-300 text-slate-400'

                  return (
                    <button
                      key={oi}
                      onClick={() => { if (!submitted) setAnswers(prev => ({ ...prev, [q.id]: opt })) }}
                      disabled={submitted}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-150 ${btnCls}`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${dotCls}`}>
                          {isThisRight ? '✓' : isThisWrong ? '✗' : String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </span>
                    </button>
                  )
                })}

                {/* Explanation */}
                {submitted && q.explanation && (
                  <div className={`mt-3 p-4 rounded-lg border ${T.explain}`}>
                    <p className={`text-[0.625rem] font-semibold uppercase tracking-widest mb-1 ${T.explainHd}`}>Explanation</p>
                    <p className={`text-sm leading-relaxed ${T.explainTxt}`}>{q.explanation}</p>
                  </div>
                )}

                {/* Unanswered */}
                {submitted && !answers[q.id] && (
                  <p className={`text-xs italic mt-2 ${T.label2xs}`}>
                    Not answered — correct answer: {q.options[q.correctIndex ?? 0]}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${T.navBtn}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Centre: submit or status */}
          <div className="flex-1 text-center">
            {!submitted ? (
              allAnswered ? (
                <button
                  onClick={() => setSubmitted(true)}
                  className="h-10 px-6 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold"
                >
                  Submit quiz
                </button>
              ) : (
                <span className={`text-xs ${T.bodyMuted}`}>
                  {total - answeredCount} remaining
                </span>
              )
            ) : (
              <span className={`text-xs font-semibold ${pct >= 70 ? (dark ? 'text-teal-400' : 'text-teal-600') : (dark ? 'text-crimson-400' : 'text-crimson-600')}`}>
                {pct >= 70 ? `${pct}% — Passed` : `${pct}% — Review answers`}
              </span>
            )}
          </div>

          <button
            onClick={() => setCurrentIdx(i => Math.min(total - 1, i + 1))}
            disabled={currentIdx === total - 1}
            className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${T.navBtn}`}
          >
            <span className="hidden sm:inline">Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  )
}
