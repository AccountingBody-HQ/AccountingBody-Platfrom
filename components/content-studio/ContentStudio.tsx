'use client'

// The Content Studio screen (D373 E2): the plan of what to make next and the
// practice-question maker. All text comes from WORDING; every content text is
// shown as plain React text. State lives in memory only: a reload starts again.
import { useCallback, useEffect, useState } from 'react'
import { Layers, ClipboardCopy, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'
import { adminFetch, type AdminResponse } from '@/lib/admin-fetch'
import { ADMIN_COLORS } from '@/lib/admin-theme'
import { WORDING } from '@/lib/content-studio/wording'
import {
  bodies,
  canCheck,
  canMake,
  canPublish,
  cardLines,
  choicesOf,
  clearOnChange,
  errorOf,
  foundLine,
  jsonPost,
  londonToday,
  planUrl,
  publishedOf,
  type Answer,
  type CheckResult,
  type Count,
  type LevelId,
  type NoteInfo,
  type PlanRow,
  type PlanView,
} from './view'

// The Studio's look (its card, input and state styles), from the admin colours.
const C = {
  card: { background: ADMIN_COLORS.bg, border: `1px solid ${ADMIN_COLORS.border}`, borderRadius: 16 },
  input: { background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.borderLight}`, borderRadius: 10, color: ADMIN_COLORS.text },
  active: { background: ADMIN_COLORS.border, border: `1px solid ${ADMIN_COLORS.gold}`, color: ADMIN_COLORS.text },
  idle: { background: ADMIN_COLORS.card, border: `1px solid ${ADMIN_COLORS.borderLight}`, color: ADMIN_COLORS.textMuted },
  success: { background: ADMIN_COLORS.successBg, border: `1px solid ${ADMIN_COLORS.success}`, color: ADMIN_COLORS.success },
  warning: { background: ADMIN_COLORS.warningBg, border: `1px solid ${ADMIN_COLORS.warning}`, color: ADMIN_COLORS.warning },
  danger: { background: ADMIN_COLORS.dangerBg, border: `1px solid ${ADMIN_COLORS.danger}`, color: ADMIN_COLORS.danger },
  muted: { color: ADMIN_COLORS.textMuted },
  gold: { color: ADMIN_COLORS.gold },
} as const

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
const BUTTON = `flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 ${FOCUS}`
const FIELD = `w-full text-sm rounded-xl px-3 py-2.5 ${FOCUS}`
const CARD = 'rounded-2xl border p-6 mb-6'
const HEADING = 'text-white font-bold text-sm'
const HELP = 'text-xs mb-3'

type Busy = null | 'finding' | 'checking' | 'generating' | 'review' | 'publishing'

/** A failed answer's own message, or the plain "something went wrong". */
async function failure(res: AdminResponse): Promise<string> {
  const body: unknown = await res.json()
  const message = errorOf(body, WORDING.somethingWrong)
  return /^Request failed/.test(message) ? WORDING.somethingWrong : message
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function ContentStudio({ apiBase, publishUrl }: { apiBase: string; publishUrl: string }) {
  const [tab, setTab] = useState<'plan' | 'make'>('plan')

  // ── Plan ──
  const [plan, setPlan] = useState<PlanView | null>(null)
  const [planError, setPlanError] = useState(false)

  const loadPlan = useCallback(async () => {
    setPlanError(false)
    try {
      const res = await adminFetch(planUrl(apiBase))
      if (!res.ok) {
        if (!res.signedOut) setPlanError(true)
        return
      }
      setPlan((await res.json()) as PlanView)
    } catch {
      setPlanError(true)
    }
  }, [apiBase])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  const showMore = async (group: 1 | 2) => {
    if (!plan) return
    const offset = group === 1 ? plan.queue1.length : plan.queue2.length
    try {
      const res = await adminFetch(planUrl(apiBase, group, offset))
      if (!res.ok) {
        if (!res.signedOut) setPlanError(true)
        return
      }
      const page = (await res.json()) as { rows: PlanRow[] }
      setPlan(p => (p ? (group === 1 ? { ...p, queue1: [...p.queue1, ...page.rows] } : { ...p, queue2: [...p.queue2, ...page.rows] }) : p))
    } catch {
      setPlanError(true)
    }
  }

  // ── Make ──
  const [noteInput, setNoteInput] = useState('')
  const [note, setNote] = useState<NoteInfo | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId>('acca')
  const [count, setCount] = useState<Count>(20)
  const [validAsAt, setValidAsAt] = useState(() => londonToday(new Date()))
  const [prompt, setPrompt] = useState<{ text: string; estimate: string; steps: number } | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [checked, setChecked] = useState<Answer | null>(null)
  const [reviewText, setReviewText] = useState<string | null>(null)
  const [reviewCopy, setReviewCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [reviewPaste, setReviewPaste] = useState('')
  const [reviewNotes, setReviewNotes] = useState<{ where: string; problem: string; suggestion: string }[] | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [published, setPublished] = useState<string[] | null>(null)

  const clear = () => {
    const c = clearOnChange()
    setPrompt(c.prompt)
    setAnswer(c.answer)
    setResult(c.result)
    setChecked(c.checked)
    setReviewNotes(c.reviewNotes)
    setReviewPaste(c.reviewPaste)
    setMessage(c.message)
    setPublished(c.published)
    setReviewText(null)
    setReviewError(null)
    setCopyState('idle')
    setReviewCopy('idle')
  }

  const choices = note ? choicesOf(note, level, count, validAsAt) : null
  const makeOpen = canMake(note)
  const state = { note, busy: busy !== null, answer, result, checked }

  const find = async (id: string) => {
    clear()
    setNote(null)
    setNoteError(null)
    setBusy('finding')
    try {
      const res = await adminFetch(`${apiBase}/prompt`, jsonPost(bodies.find(id)))
      if (!res.ok) {
        if (!res.signedOut) setNoteError(await failure(res))
        return
      }
      const found = ((await res.json()) as { note: NoteInfo }).note
      setNote(found)
      setLevel(found.defaultLevel)
    } catch {
      setNoteError(WORDING.somethingWrong)
    } finally {
      setBusy(null)
    }
  }

  // The prompt (and its estimate) for the current choices, from the server.
  const choiceKey = choices ? JSON.stringify(choices) : ''
  useEffect(() => {
    if (!choiceKey || !makeOpen) return
    let live = true
    void (async () => {
      try {
        const res = await adminFetch(`${apiBase}/prompt`, jsonPost(bodies.prompt(JSON.parse(choiceKey))))
        if (!live) return
        if (!res.ok) {
          if (!res.signedOut) setMessage(await failure(res))
          return
        }
        setPrompt((await res.json()) as { text: string; estimate: string; steps: number })
      } catch {
        if (live) setMessage(WORDING.somethingWrong)
      }
    })()
    return () => {
      live = false
    }
  }, [apiBase, choiceKey, makeOpen])

  const onCopyPrompt = async () => {
    if (!prompt) return
    setCopyState((await copyText(prompt.text)) ? 'copied' : 'failed')
  }

  const runCheck = async (body: unknown, from: Answer) => {
    const res = await adminFetch(`${apiBase}/check`, jsonPost(body))
    if (!res.ok) {
      if (!res.signedOut) setMessage(await failure(res))
      return
    }
    setResult((await res.json()) as CheckResult)
    setChecked(from)
    setReviewNotes(null)
    setReviewText(null)
    setPublished(null)
  }

  const onCheckPasted = async () => {
    if (!choices) return
    setMessage(null)
    if (answer.trim() === '') {
      setMessage(WORDING.pasteFirst)
      return
    }
    setBusy('checking')
    try {
      await runCheck(bodies.checkCopy(choices, answer), { door: 'copy', answer })
    } catch {
      setMessage(WORDING.somethingWrong)
    } finally {
      setBusy(null)
    }
  }

  const onGenerate = async () => {
    if (!choices || !prompt) return
    setMessage(null)
    setResult(null)
    setBusy('generating')
    const got: string[] = []
    try {
      for (let step = 0; step < prompt.steps; step++) {
        setProgress({ i: step + 1, n: prompt.steps })
        const res = await adminFetch(`${apiBase}/generate`, jsonPost(bodies.generateStep(choices, step, got)))
        if (!res.ok) {
          if (!res.signedOut) setMessage(WORDING.aiFailed)
          return
        }
        got.push(((await res.json()) as { raw: string }).raw)
      }
      setProgress(null)
      setBusy('checking')
      await runCheck(bodies.checkGenerate(choices, got), { door: 'generate', parts: got })
    } catch {
      setMessage(WORDING.aiFailed)
    } finally {
      setProgress(null)
      setBusy(null)
    }
  }

  // ── Second opinion (notes only, never applied) ──
  const onReviewCopy = async () => {
    if (!choices || !checked) return
    setReviewError(null)
    setBusy('review')
    try {
      const res = await adminFetch(`${apiBase}/prompt`, jsonPost(bodies.reviewPrompt(choices, checked)))
      if (!res.ok) {
        if (!res.signedOut) setReviewError(await failure(res))
        return
      }
      const text = ((await res.json()) as { text: string }).text
      setReviewText(text)
      setReviewCopy((await copyText(text)) ? 'copied' : 'failed')
    } catch {
      setReviewError(WORDING.somethingWrong)
    } finally {
      setBusy(null)
    }
  }

  const readNotes = async (raw: string) => {
    const res = await adminFetch(`${apiBase}/check`, jsonPost(bodies.reviewCheck(raw)))
    if (!res.ok) {
      if (!res.signedOut) setReviewError(await failure(res))
      return
    }
    const body = (await res.json()) as { ok: boolean; notes?: { where: string; problem: string; suggestion: string }[]; error?: string }
    if (body.ok && body.notes) setReviewNotes(body.notes)
    else setReviewError(body.error ?? WORDING.somethingWrong)
  }

  const onReviewGenerate = async () => {
    if (!choices || !checked) return
    setReviewError(null)
    setBusy('review')
    try {
      const res = await adminFetch(`${apiBase}/generate`, jsonPost(bodies.reviewGenerate(choices, checked)))
      if (!res.ok) {
        if (!res.signedOut) setReviewError(WORDING.aiFailed)
        return
      }
      await readNotes(((await res.json()) as { raw: string }).raw)
    } catch {
      setReviewError(WORDING.aiFailed)
    } finally {
      setBusy(null)
    }
  }

  const onReviewPasted = async () => {
    setReviewError(null)
    if (reviewPaste.trim() === '') {
      setReviewError(WORDING.pasteFirst)
      return
    }
    setBusy('review')
    try {
      await readNotes(reviewPaste)
    } catch {
      setReviewError(WORDING.somethingWrong)
    } finally {
      setBusy(null)
    }
  }

  // ── Publish ──
  const onPublish = async () => {
    if (!result?.publish || !canPublish(state)) return
    setMessage(null)
    setBusy('publishing')
    try {
      const res = await adminFetch(publishUrl, jsonPost(bodies.publish(result.publish)))
      if (!res.ok) {
        if (!res.signedOut) setMessage(await failure(res))
        return
      }
      const done = publishedOf(await res.json())
      if (!done) {
        setMessage(WORDING.somethingWrong)
        return
      }
      setPublished([WORDING.published(done.contentId, done.questionCount), ...(done.linkWarning ? [done.linkWarning] : [])])
      setResult(null)
      setChecked(null)
      void loadPlan()
    } catch {
      setMessage(WORDING.somethingWrong)
    } finally {
      setBusy(null)
    }
  }

  const startFromPlan = (row: PlanRow) => {
    setTab('make')
    setNoteInput(row.contentId)
    void find(row.contentId)
  }

  // ── Rendering ──
  const planRows = (rows: PlanRow[]) => (
    <ul className="flex flex-col gap-2 mb-3">
      {rows.map(row => (
        <li key={row.contentId} className="flex items-center gap-2 flex-wrap text-xs" style={C.muted}>
          <span className="text-white">{row.title}</span>
          <span>·</span>
          <span>{row.subjectTitle}</span>
          <span>·</span>
          <span className="font-mono">{row.contentId}</span>
          <button type="button" className={`${BUTTON} ml-auto`} style={C.idle} onClick={() => startFromPlan(row)}>
            {WORDING.makeQuestions}
          </button>
        </li>
      ))}
    </ul>
  )

  const lines = result ? cardLines(result.card) : null

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Layers size={22} style={C.gold} />
        <h1 className="text-2xl font-bold text-white">{WORDING.pageTitle}</h1>
      </div>
      <p className="text-sm mb-6" style={C.muted}>{WORDING.pageIntro}</p>

      <div className="flex items-center gap-2 mb-6" role="tablist">
        {(['plan', 'make'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={BUTTON} style={tab === t ? C.active : C.idle} onClick={() => setTab(t)}>
            {t === 'plan' ? WORDING.tabPlan : WORDING.tabMake}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <div className={CARD} style={C.card}>
          <h2 className={`${HEADING} mb-4`}>{WORDING.planTitle}</h2>
          {planError && <p className="rounded-xl p-3 mb-4 text-xs" style={C.danger}>{WORDING.planFailed}</p>}
          {plan && (
            <>
              <h3 className={`${HEADING} mb-1`}>{WORDING.emptySubjectsTitle}</h3>
              <p className={HELP} style={C.muted}>{WORDING.emptySubjectsHelp}</p>
              <ul className="flex flex-col gap-1 mb-3">
                {plan.subjects.map(s => (
                  <li key={s.slug} className="text-xs text-white">{WORDING.subjectLine(s.title, s.poolSize, s.notesWithoutSet)}</li>
                ))}
              </ul>
              {planRows(plan.queue1)}
              {plan.queue1.length < plan.queue1Total && (
                <button type="button" className={`${BUTTON} mb-6`} style={C.idle} onClick={() => void showMore(1)}>{WORDING.showMore}</button>
              )}
              <h3 className={`${HEADING} mb-3`}>{WORDING.otherTitle(plan.queue2Total)}</h3>
              {planRows(plan.queue2)}
              {plan.queue2.length < plan.queue2Total && (
                <button type="button" className={`${BUTTON} mb-6`} style={C.idle} onClick={() => void showMore(2)}>{WORDING.showMore}</button>
              )}
              {plan.eticpaMissing.length > 0 && <p className="text-xs" style={C.muted}>{WORDING.eticpaMissing(plan.eticpaMissing)}</p>}
            </>
          )}
        </div>
      )}

      {tab === 'make' && (
        <>
          <div className={CARD} style={C.card}>
            <label htmlFor="cs-note" className={`${HEADING} block mb-1`}>{WORDING.noteBoxTitle}</label>
            <p id="cs-note-help" className={HELP} style={C.muted}>{WORDING.noteHelp}</p>
            <div className="flex items-center gap-2 mb-3">
              <input id="cs-note" aria-describedby="cs-note-help" className={FIELD} style={C.input} value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && busy === null) void find(noteInput) }} />
              <button type="button" className={BUTTON} style={C.active} disabled={busy !== null} onClick={() => void find(noteInput)}>
                {busy === 'finding' ? WORDING.finding : WORDING.findNote}
              </button>
            </div>
            {noteError && <p className="text-xs" style={C.danger}>{noteError}</p>}
            {note && <p className="text-xs text-white mb-2">{foundLine(note)}</p>}
            {note?.setMessage && <p className="rounded-xl p-3 text-xs" style={C.warning}>{note.setMessage}</p>}
          </div>

          {note && makeOpen && (
            <div className={CARD} style={C.card}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="cs-level" className={`${HEADING} block mb-1`}>{WORDING.levelLabel}</label>
                  <select id="cs-level" aria-describedby="cs-level-help" className={FIELD} style={C.input} value={level}
                    onChange={e => { clear(); setLevel(e.target.value as LevelId) }}>
                    {WORDING.levelOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <p id="cs-level-help" className="text-xs mt-1" style={C.muted}>{WORDING.levelHelp}</p>
                </div>
                <fieldset className="flex flex-col gap-2">
                  {([10, 20] as const).map(n => (
                    <label key={n} className="flex items-center gap-2 text-xs text-white">
                      <input type="radio" name="cs-count" className={FOCUS} checked={count === n} onChange={() => { clear(); setCount(n) }} />
                      {n === 10 ? WORDING.count10 : WORDING.count20}
                    </label>
                  ))}
                </fieldset>
                {note.needsValidAsAt && (
                  <div>
                    <label htmlFor="cs-date" className={`${HEADING} block mb-1`}>{WORDING.validAsAtLabel}</label>
                    <input id="cs-date" type="date" aria-describedby="cs-date-help" className={FIELD} style={C.input} value={validAsAt}
                      onChange={e => { clear(); setValidAsAt(e.target.value) }} />
                    <p id="cs-date-help" className="text-xs mt-1" style={C.muted}>{WORDING.validAsAtHelp}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl p-4" style={C.idle}>
                  <button type="button" className={BUTTON} style={C.active} disabled={!prompt || busy !== null} onClick={() => void onCopyPrompt()}>
                    <ClipboardCopy size={14} />{WORDING.copyPrompt}
                  </button>
                  <p className="text-xs mt-2" style={C.muted}>{WORDING.copyHelp}</p>
                  {copyState === 'copied' && <p className="text-xs mt-2" style={C.success}>{WORDING.copied}</p>}
                  {copyState === 'failed' && prompt && (
                    <>
                      <p id="cs-copy-failed" className="text-xs mt-2" style={C.warning}>{WORDING.copyFailed}</p>
                      <textarea readOnly aria-labelledby="cs-copy-failed" className={`${FIELD} font-mono mt-2`} rows={6} style={C.input} value={prompt.text} />
                    </>
                  )}
                </div>
                <div className="rounded-xl p-4" style={C.idle}>
                  <button type="button" className={BUTTON} style={C.active} disabled={!prompt || busy !== null} onClick={() => void onGenerate()}>
                    <Sparkles size={14} />{WORDING.generateHere}
                  </button>
                  {prompt && <p className="text-xs mt-2" style={C.muted}>{WORDING.generateHelp(prompt.estimate)}</p>}
                  {progress && <p className="text-xs mt-2 text-white">{WORDING.stepProgress(progress.i, progress.n)}</p>}
                </div>
              </div>

              <label htmlFor="cs-answer" className={`${HEADING} block mb-1`}>{WORDING.pasteLabel}</label>
              <textarea id="cs-answer" className={`${FIELD} font-mono mb-3`} rows={8} style={C.input} value={answer}
                onChange={e => setAnswer(e.target.value)} />
              <button type="button" className={BUTTON} style={C.active} disabled={!canCheck(state)} onClick={() => void onCheckPasted()}>
                {busy === 'checking' ? WORDING.checking : WORDING.checkAnswer}
              </button>
              {message && <p className="rounded-xl p-3 mt-4 text-xs" style={C.danger}>{message}</p>}
            </div>
          )}

          {result && lines && (
            <div className={CARD} style={C.card}>
              <div className="flex items-center gap-2 mb-2">
                {result.card.ok ? <CheckCircle2 size={16} style={C.success} /> : <AlertTriangle size={16} style={C.warning} />}
                <h2 className={HEADING}>{lines.score}</h2>
              </div>
              <p className="text-xs mb-4" style={result.card.ok ? C.success : C.warning}>{lines.verdict}</p>
              <h3 className={`${HEADING} mb-1`}>{lines.problemsTitle}</h3>
              <ul className="list-disc pl-5 mb-4 text-xs text-white">{lines.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
              <h3 className={`${HEADING} mb-1`}>{lines.warningsTitle}</h3>
              <ul className="list-disc pl-5 mb-4 text-xs text-white">{lines.warnings.map((p, i) => <li key={i}>{p}</li>)}</ul>
              <h3 className={`${HEADING} mb-1`}>{WORDING.notCheckedTitle}</h3>
              <ul className="list-disc pl-5 mb-4 text-xs" style={C.muted}>{lines.notChecked.map((p, i) => <li key={i}>{p}</li>)}</ul>
              {result.publishProblem && <p className="rounded-xl p-3 mb-4 text-xs" style={C.danger}>{result.publishProblem}</p>}

              {result.preview && (
                <>
                  <h3 className={`${HEADING} mb-3`}>{WORDING.previewTitle}</h3>
                  <ol className="flex flex-col gap-4 mb-6">
                    {result.preview.map((q, i) => (
                      <li key={i} className="rounded-xl p-4" style={C.idle}>
                        <p className="text-xs font-bold mb-1" style={C.gold}>{WORDING.questionLabel(i + 1)}</p>
                        <p className="text-sm text-white mb-2 whitespace-pre-wrap">{q.questionText}</p>
                        <ul className="flex flex-col gap-1 mb-2">
                          {q.options.map((o, j) => (
                            <li key={j} className="text-xs text-white">
                              {o}{j === q.correctIndex && <span className="ml-2 font-bold" style={C.success}>{WORDING.correctAnswer}</span>}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs whitespace-pre-wrap" style={C.muted}>{q.explanation}</p>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {result.card.ok && checked && (
                <div className="rounded-xl p-4 mb-6" style={C.idle}>
                  <h3 className={`${HEADING} mb-3`}>{WORDING.secondOpinion}</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <button type="button" className={BUTTON} style={C.idle} disabled={busy !== null} onClick={() => void onReviewCopy()}>
                      <ClipboardCopy size={14} />{WORDING.copyPrompt}
                    </button>
                    <button type="button" className={BUTTON} style={C.idle} disabled={busy !== null} onClick={() => void onReviewGenerate()}>
                      <Sparkles size={14} />{WORDING.generateHere}
                    </button>
                  </div>
                  {busy === 'review' && <p className="text-xs mb-2 text-white">{WORDING.stepGenerateReview}</p>}
                  {reviewCopy === 'copied' && <p className="text-xs mb-2" style={C.success}>{WORDING.copied}</p>}
                  {reviewCopy === 'failed' && reviewText && (
                    <>
                      <p id="cs-review-copy-failed" className="text-xs mb-2" style={C.warning}>{WORDING.copyFailed}</p>
                      <textarea readOnly aria-labelledby="cs-review-copy-failed" className={`${FIELD} font-mono mb-2`} rows={6} style={C.input} value={reviewText} />
                    </>
                  )}
                  <label htmlFor="cs-review" className="text-xs text-white block mb-1">{WORDING.pasteLabel}</label>
                  <textarea id="cs-review" className={`${FIELD} font-mono mb-2`} rows={5} style={C.input} value={reviewPaste}
                    onChange={e => setReviewPaste(e.target.value)} />
                  <button type="button" className={BUTTON} style={C.idle} disabled={busy !== null} onClick={() => void onReviewPasted()}>
                    {WORDING.checkAnswer}
                  </button>
                  {reviewError && <p className="text-xs mt-2" style={C.danger}>{reviewError}</p>}
                  {reviewNotes && (
                    <div className="mt-3">
                      {reviewNotes.length === 0 ? (
                        <p className="text-xs" style={C.success}>{WORDING.checkerNothing}</p>
                      ) : (
                        <>
                          <h4 className={`${HEADING} mb-2`}>{WORDING.checkerNotes(reviewNotes.length)}</h4>
                          <ul className="flex flex-col gap-2">
                            {reviewNotes.map((n, i) => (
                              <li key={i} className="text-xs text-white">
                                <p><span style={C.muted}>{WORDING.noteWhere}</span> {n.where}</p>
                                <p><span style={C.muted}>{WORDING.noteProblem}</span> {n.problem}</p>
                                <p><span style={C.muted}>{WORDING.noteSuggestion}</span> {n.suggestion}</p>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {note && (
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-white">{WORDING.publishTitle(note.title)}</p>
                  <button type="button" className={BUTTON} style={C.success} disabled={!canPublish(state)} onClick={() => void onPublish()}>
                    {busy === 'publishing' ? WORDING.publishing : WORDING.publish}
                  </button>
                </div>
              )}
            </div>
          )}

          {message && !makeOpen && <p className="rounded-xl p-3 text-xs" style={C.danger}>{message}</p>}
          {published && (
            <div className="rounded-xl p-4 text-xs" style={C.success}>
              {published.map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
