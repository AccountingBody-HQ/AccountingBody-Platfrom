/**
 * question-normaliser.ts
 *
 * Converts any valid JSON from any AI model (ChatGPT, DeepSeek, Gemini,
 * Claude, hand-written) into the internal bundle format used by the
 * AccountingBody question system.
 *
 * Handles every known field name variation, answer format, options shape,
 * and top-level structure. Returns a NormaliseResult containing:
 *   - the normalised bundle ready for the publish route
 *   - a list of changes made (for the UI diff report)
 *   - any warnings about data that could not be resolved
 */

// ── Internal bundle types ─────────────────────────────────────────────────────

export interface NormalisedQuestion {
  id:                   string
  type:                 'multiple-choice' | 'scenario' | 'writing'
  questionText:         string
  options:              string[]          // always 4 elements for MCQ/scenario, [] for writing
  correctIndex:         number | null     // 0-3 for MCQ/scenario, null for writing
  explanation:          string | null
  writingModelAnswer:   string | null
  writingExplanation:   string | null
  caseId:               string | null
  primaryTopic:         string
  difficulty:           string
  timeTargetMinutes:    number
  points:               number
}

export interface NormalisedCase {
  caseId:      string
  title:       string
  exhibitHtml: string
}

export interface NormalisedBundle {
  title:        string
  slug:         string
  excerpt:      string
  difficulty:   string
  questionType: string
  topic:        string
  tags:         string[]
  cases:        NormalisedCase[]
  questions:    NormalisedQuestion[]
}

export interface NormaliseResult {
  bundle:   NormalisedBundle
  changes:  string[]   // human-readable list of transformations applied
  warnings: string[]   // issues that could not be auto-resolved
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const QUESTION_TEXT_KEYS = [
  'questionText', 'question_text', 'question', 'stem',
  'text', 'prompt', 'q', 'content', 'body', 'description',
]

const OPTIONS_KEYS = [
  'options', 'choices', 'answers', 'option_list',
  'alternatives', 'opts', 'possible_answers', 'answer_choices',
]

const CORRECT_INDEX_KEYS = [
  'correctIndex', 'correct_index', 'correct', 'answer',
  'correct_answer', 'correct_option', 'answer_index',
  'correctAnswer', 'right_answer', 'solution', 'key',
]

const EXPLANATION_KEYS = [
  'explanation', 'rationale', 'feedback', 'solution',
  'reasoning', 'justification', 'reason', 'commentary',
  'answer_explanation', 'discussion',
]

const WRITING_MODEL_ANSWER_KEYS = [
  'writingModelAnswer', 'writing_model_answer', 'model_answer',
  'sample_answer', 'modelAnswer', 'suggested_answer',
  'example_answer', 'reference_answer', 'ideal_answer',
]

const WRITING_EXPLANATION_KEYS = [
  'writingExplanation', 'writing_explanation', 'teaching_notes',
  'marking_notes', 'notes', 'hints', 'marker_notes',
  'assessor_notes', 'guidance', 'marking_guidance',
]

const PRIMARY_TOPIC_KEYS = [
  'primaryTopic', 'primary_topic', 'topic', 'subtopic',
  'sub_topic', 'subject_area', 'area', 'concept', 'tag',
]

const DIFFICULTY_KEYS = [
  'difficulty', 'level', 'grade', 'complexity',
  'difficulty_level', 'challenge_level',
]

const TYPE_KEYS = [
  'type', 'question_type', 'format', 'kind', 'questionType',
]

const CASE_ID_KEYS = [
  'caseId', 'case_id', 'case', 'scenario_id',
  'exhibit_id', 'passage_id', 'context_id',
]

const EXHIBIT_KEYS = [
  'exhibitHtml', 'exhibit_html', 'exhibit', 'case_text',
  'scenario_text', 'context', 'passage', 'background',
  'scenario', 'case_content', 'vignette', 'stem',
]

const CASE_TITLE_KEYS = [
  'title', 'case_title', 'name', 'heading', 'label',
]

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Pick the first key present in obj from a list of candidates */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] !== null && obj[k] !== undefined) return obj[k]
  }
  return undefined
}

/** Coerce any value to a non-empty string or return null */
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

/** Generate a url-safe slug from a title */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

/** Map a letter (A/B/C/D) to a 0-based index */
function letterToIndex(letter: string): number | null {
  const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 }
  const l = letter.trim().toLowerCase().replace(/[^a-d]/g, '')
  return l in map ? map[l] : null
}

/** Strip option prefix like "A.", "A)", "(A)", "1.", "1)" from option text */
function stripOptionPrefix(text: string): string {
  return text
    .replace(/^\s*[\(\[]?[A-Da-d1-4][\)\]\.:\s]+\s*/, '')
    .trim()
}

/** Normalise difficulty value to one of the three accepted values */
function normaliseDifficulty(raw: unknown): string {
  const s = str(raw)?.toLowerCase() ?? ''
  if (s.includes('adv') || s.includes('hard') || s.includes('difficult') || s === '3' || s === 'high') return 'advanced'
  if (s.includes('beg') || s.includes('found') || s.includes('easy') || s === '1' || s === 'low') return 'beginner'
  return 'intermediate'
}

/** Normalise question type to internal enum */
function normaliseType(raw: unknown): 'multiple-choice' | 'scenario' | 'writing' {
  const s = str(raw)?.toLowerCase() ?? ''
  if (
    s.includes('writ') || s.includes('essay') || s.includes('construct') ||
    s.includes('open') || s.includes('long') || s.includes('free')
  ) return 'writing'
  if (
    s.includes('scen') || s.includes('case') || s.includes('vignette') ||
    s.includes('passage') || s.includes('exhibit')
  ) return 'scenario'
  return 'multiple-choice'
}

/**
 * Resolve correctIndex from any of the wild formats AI models produce.
 * Returns 0-based index (0-3) or null if unresolvable.
 */
function resolveCorrectIndex(
  raw: unknown,
  options: string[],
  changes: string[],
  qId: string,
): number | null {

  if (raw === null || raw === undefined) return null

  // Already a 0-based number in range
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3) {
    return raw
  }

  // 1-based number (1,2,3,4)
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 4) {
    changes.push(`${qId}: converted 1-based answer index ${raw} → correctIndex ${raw - 1}`)
    return raw - 1
  }

  const s = str(raw)
  if (!s) return null

  // Single letter: "A", "B", "C", "D" (case-insensitive)
  if (/^[A-Da-d]$/.test(s.trim())) {
    const idx = letterToIndex(s)
    if (idx !== null) {
      changes.push(`${qId}: converted letter answer "${s.toUpperCase()}" → correctIndex ${idx}`)
      return idx
    }
  }

  // "Option A", "Option B", "choice C", "answer D"
  const prefixMatch = s.match(/(?:option|choice|answer|opt)\s*([A-Da-d])/i)
  if (prefixMatch) {
    const idx = letterToIndex(prefixMatch[1])
    if (idx !== null) {
      changes.push(`${qId}: extracted letter from "${s}" → correctIndex ${idx}`)
      return idx
    }
  }

  // "option_a", "option_b", "opt_c", "ans_d"
  const snakeMatch = s.match(/(?:option|opt|ans|answer)_([a-d])/i)
  if (snakeMatch) {
    const idx = letterToIndex(snakeMatch[1])
    if (idx !== null) {
      changes.push(`${qId}: extracted letter from snake_case "${s}" → correctIndex ${idx}`)
      return idx
    }
  }

  // Full text match against options (AI gave the full answer text)
  if (options.length > 0) {
    const sLower = s.toLowerCase()
    const textIdx = options.findIndex(o => o.toLowerCase() === sLower)
    if (textIdx >= 0) {
      changes.push(`${qId}: matched full answer text to option ${textIdx} (correctIndex ${textIdx})`)
      return textIdx
    }
    // Partial match — answer text is a substring of an option or vice versa
    const partialIdx = options.findIndex(o =>
      o.toLowerCase().includes(sLower.slice(0, 30)) ||
      sLower.includes(o.toLowerCase().slice(0, 30))
    )
    if (partialIdx >= 0) {
      changes.push(`${qId}: partial text match → correctIndex ${partialIdx}`)
      return partialIdx
    }
  }

  return null
}

/**
 * Normalise the options array from any shape AI models produce.
 * Returns exactly 4 strings, stripping prefixes.
 */
function resolveOptions(
  raw: unknown,
  changes: string[],
  warnings: string[],
  qId: string,
): string[] {

  if (!raw) return ['', '', '', '']

  let arr: string[] = []

  // Plain array
  if (Array.isArray(raw)) {
    arr = raw.map(item => {
      if (typeof item === 'string') return stripOptionPrefix(item)
      // Object with text/label/content key
      if (typeof item === 'object' && item !== null) {
        const o = item as Record<string, unknown>
        const text = str(o.text ?? o.content ?? o.label ?? o.value ?? o.option ?? '')
        return text ? stripOptionPrefix(text) : ''
      }
      return String(item)
    })
  }

  // Object with keys a/b/c/d or A/B/C/D or 1/2/3/4
  else if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>
    const byLetter = ['a','b','c','d'].map(l =>
      str(o[l] ?? o[l.toUpperCase()] ?? null) ?? ''
    )
    const byNumber = ['1','2','3','4'].map(n => str(o[n] ?? null) ?? '')
    // Use whichever set is more populated
    const letterFilled = byLetter.filter(Boolean).length
    const numberFilled = byNumber.filter(Boolean).length
    arr = letterFilled >= numberFilled ? byLetter : byNumber
    changes.push(`${qId}: converted options object to array`)
  }

  // Strip prefixes from all options
  const stripped = arr.map(stripOptionPrefix)

  // Pad or trim to exactly 4
  if (stripped.length < 4) {
    warnings.push(`${qId}: only ${stripped.length} options found — padded to 4`)
    while (stripped.length < 4) stripped.push('')
  }
  if (stripped.length > 4) {
    warnings.push(`${qId}: ${stripped.length} options found — trimmed to first 4`)
    stripped.splice(4)
  }

  // Flag if any options had prefixes stripped
  const hadPrefixes = arr.some((o, i) => o !== stripped[i])
  if (hadPrefixes) {
    changes.push(`${qId}: stripped A./B./C./D. prefixes from options`)
  }

  return stripped
}

// ── Case/exhibit extraction ───────────────────────────────────────────────────

/**
 * Try to extract scenario cases from the raw JSON.
 * Handles: top-level cases array, questions nested under case objects,
 * flat questions with caseId references, inline exhibit per question.
 */
function extractCases(
  raw: Record<string, unknown>,
): NormalisedCase[] {

  // Already has a cases array
  const casesRaw = raw.cases ?? raw.scenarios ?? raw.exhibits ?? raw.passages
  if (Array.isArray(casesRaw) && casesRaw.length > 0) {
    return casesRaw.map((c: unknown, i: number) => {
      if (typeof c !== 'object' || c === null) return null
      const o = c as Record<string, unknown>
      const caseId = str(pick(o, CASE_ID_KEYS)) ?? `case-${i + 1}`
      const title  = str(pick(o, CASE_TITLE_KEYS)) ?? `Case ${i + 1}`
      const rawExhibit = pick(o, EXHIBIT_KEYS)
      const exhibitHtml = rawExhibit
        ? (typeof rawExhibit === 'string' ? rawExhibit : JSON.stringify(rawExhibit))
        : ''
      return { caseId, title, exhibitHtml }
    }).filter(Boolean) as NormalisedCase[]
  }

  return []
}

// ── Question extraction ───────────────────────────────────────────────────────

/** Extract the flat questions array from any top-level structure */
function extractQuestionsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    // Could be array of questions directly, or array containing one bundle
    if (raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null) {
      const first = raw[0] as Record<string, unknown>
      // If first element has a questions array, it's an array of bundles — flatten
      if (Array.isArray(first.questions)) {
        return raw.flatMap((b: unknown) => {
          if (typeof b === 'object' && b !== null) {
            const o = b as Record<string, unknown>
            return Array.isArray(o.questions) ? o.questions : [b]
          }
          return [b]
        })
      }
      // Otherwise it's a direct array of question objects
      return raw
    }
    return raw
  }

  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>

    // Standard bundle shape
    if (Array.isArray(o.questions)) return o.questions

    // Nested: { data: { questions: [...] } }
    if (typeof o.data === 'object' && o.data !== null) {
      const d = o.data as Record<string, unknown>
      if (Array.isArray(d.questions)) return d.questions
    }

    // Nested: { result: { questions: [...] } }
    if (typeof o.result === 'object' && o.result !== null) {
      const r = o.result as Record<string, unknown>
      if (Array.isArray(r.questions)) return r.questions
    }

    // Single question object — wrap in array
    if (o.questionText || o.question_text || o.question || o.stem) {
      return [o]
    }
  }

  return []
}

/** Extract scenario cases that are nested inside question objects */
function extractInlineCases(
  questions: unknown[],
  changes: string[],
): { cases: NormalisedCase[]; caseIdByQIndex: Map<number, string> } {
  const cases: NormalisedCase[] = []
  const caseIdByQIndex = new Map<number, string>()
  const seenExhibits = new Map<string, string>() // exhibit text → caseId

  questions.forEach((q, i) => {
    if (typeof q !== 'object' || q === null) return
    const o = q as Record<string, unknown>
    const rawExhibit = pick(o, EXHIBIT_KEYS)
    if (!rawExhibit) return

    const exhibitText = typeof rawExhibit === 'string'
      ? rawExhibit
      : JSON.stringify(rawExhibit)

    // Deduplicate: same exhibit text = same case
    if (seenExhibits.has(exhibitText)) {
      caseIdByQIndex.set(i, seenExhibits.get(exhibitText)!)
      return
    }

    const caseId = `case-inline-${cases.length + 1}`
    const rawTitle = str(pick(o, CASE_TITLE_KEYS)) ?? `Case ${cases.length + 1}`
    cases.push({ caseId, title: rawTitle, exhibitHtml: exhibitText })
    seenExhibits.set(exhibitText, caseId)
    caseIdByQIndex.set(i, caseId)
    changes.push(`Q${i + 1}: extracted inline exhibit as ${caseId}`)
  })

  return { cases, caseIdByQIndex }
}

// ── Normalise a single question ───────────────────────────────────────────────

function normaliseQuestion(
  raw: unknown,
  index: number,
  inlineCaseId: string | undefined,
  changes: string[],
  warnings: string[],
): NormalisedQuestion | null {

  if (typeof raw !== 'object' || raw === null) {
    warnings.push(`Q${index + 1}: not an object — skipped`)
    return null
  }

  const o = raw as Record<string, unknown>
  const qId = `Q${index + 1}`

  // ── Question text ──
  const questionText = str(pick(o, QUESTION_TEXT_KEYS))
  if (!questionText) {
    warnings.push(`${qId}: no question text found — skipped`)
    return null
  }

  // ── Type ──
  const rawType = pick(o, TYPE_KEYS)
  const type = normaliseType(rawType)
  if (rawType && str(rawType) !== type) {
    changes.push(`${qId}: normalised type "${str(rawType)}" → "${type}"`)
  }

  // ── Options ──
  const rawOptions = pick(o, OPTIONS_KEYS)
  const options = (type === 'writing')
    ? []
    : resolveOptions(rawOptions, changes, warnings, qId)

  // ── Correct index ──
  const rawCorrect = pick(o, CORRECT_INDEX_KEYS)
  const correctIndex = (type === 'writing')
    ? null
    : resolveCorrectIndex(rawCorrect, options, changes, qId)

  if (type !== 'writing' && correctIndex === null) {
    warnings.push(`${qId}: could not resolve correct answer — defaulting to 0`)
  }

  // ── Explanation ──
  const explanation = type === 'writing'
    ? null
    : (str(pick(o, EXPLANATION_KEYS)) ?? null)

  // ── Writing fields ──
  const writingModelAnswer = type === 'writing'
    ? (str(pick(o, WRITING_MODEL_ANSWER_KEYS)) ?? null)
    : null
  const writingExplanation = type === 'writing'
    ? (str(pick(o, WRITING_EXPLANATION_KEYS)) ?? null)
    : null

  // ── Case ID ──
  const rawCaseId = pick(o, CASE_ID_KEYS)
  const caseId = inlineCaseId ?? str(rawCaseId) ?? null

  // ── Supporting fields ──
  const rawDifficulty = pick(o, DIFFICULTY_KEYS)
  const difficulty = normaliseDifficulty(rawDifficulty)

  const primaryTopic = str(pick(o, PRIMARY_TOPIC_KEYS)) ?? ''

  const rawTime = o.timeTargetMinutes ?? o.time_target_minutes ?? o.time ?? o.minutes
  const timeTargetMinutes = typeof rawTime === 'number' ? rawTime : (type === 'writing' ? 20 : 2)

  const rawPoints = o.points ?? o.marks ?? o.score ?? o.weight
  const points = typeof rawPoints === 'number' ? rawPoints : (type === 'writing' ? 10 : 2)

  return {
    id:                 `q${index + 1}`,
    type,
    questionText,
    options,
    correctIndex:       correctIndex ?? (type === 'writing' ? null : 0),
    explanation,
    writingModelAnswer,
    writingExplanation,
    caseId,
    primaryTopic,
    difficulty,
    timeTargetMinutes,
    points,
  }
}

// ── Top-level metadata extraction ─────────────────────────────────────────────

function extractBundleMeta(
  raw: unknown,
  questions: NormalisedQuestion[],
): {
  title: string; slug: string; excerpt: string
  difficulty: string; questionType: string; topic: string; tags: string[]
} {

  const o = (typeof raw === 'object' && raw !== null && !Array.isArray(raw))
    ? raw as Record<string, unknown>
    : {}

  const title = str(o.title ?? o.name ?? o.set_title ?? o.setTitle) ??
    `Imported Question Set — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const slug = str(o.slug) ?? slugify(title)

  const excerpt = str(o.excerpt ?? o.description ?? o.summary ?? o.intro) ??
    `${questions.length} imported question${questions.length !== 1 ? 's' : ''}.`

  // Infer overall difficulty from questions if not set
  const rawDiff = o.difficulty ?? o.level
  let difficulty: string
  if (rawDiff) {
    difficulty = normaliseDifficulty(rawDiff)
  } else {
    const counts = { beginner: 0, intermediate: 0, advanced: 0 }
    questions.forEach(q => {
      if (q.difficulty in counts) counts[q.difficulty as keyof typeof counts]++
    })
    difficulty = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'intermediate'
  }

  // Infer question type from questions
  const rawType = o.questionType ?? o.question_type ?? o.type ?? o.format
  let questionType: string
  if (rawType) {
    const t = normaliseType(rawType)
    questionType = t === 'multiple-choice' ? 'multiple-choice' : t
  } else {
    const hasWriting  = questions.some(q => q.type === 'writing')
    const hasScenario = questions.some(q => q.type === 'scenario')
    const hasMCQ      = questions.some(q => q.type === 'multiple-choice')
    if (hasWriting && !hasScenario && !hasMCQ)      questionType = 'writing'
    else if (hasScenario && !hasWriting && !hasMCQ) questionType = 'scenario'
    else if (hasMCQ && !hasWriting && !hasScenario) questionType = 'multiple-choice'
    else                                             questionType = 'mixed'
  }

  const topic = str(
    o.topic ?? o.subject ?? o.subject_area ?? o.area ?? o.theme
  ) ?? ''

  const rawTags = o.tags ?? o.keywords ?? o.labels
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.map(t => str(t)).filter(Boolean) as string[]
    : topic ? [topic] : []

  return { title, slug, excerpt, difficulty, questionType, topic, tags }
}

// ── Main normaliser entry point ───────────────────────────────────────────────

/**
 * Normalise any JSON input into a valid AccountingBody question bundle.
 *
 * @param rawJson - The raw JSON string or already-parsed object from any AI source
 * @returns NormaliseResult with bundle, changes, and warnings
 * @throws Error if the input is not parseable as JSON or contains no questions
 */
export function normalise(rawJson: string | unknown): NormaliseResult {
  const changes:  string[] = []
  const warnings: string[] = []

  // ── Parse ──
  let parsed: unknown
  if (typeof rawJson === 'string') {
    const trimmed = rawJson.trim()
    // Strip markdown code fences if present
    const fenceStripped = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    try {
      parsed = JSON.parse(fenceStripped)
      if (fenceStripped !== trimmed) {
        changes.push('Stripped markdown code fences from JSON input')
      }
    } catch {
      // Try to extract JSON from surrounding text
      const s = fenceStripped.indexOf('{')
      const e = fenceStripped.lastIndexOf('}')
      const s2 = fenceStripped.indexOf('[')
      const e2 = fenceStripped.lastIndexOf(']')
      const objStr = s >= 0 && e > s ? fenceStripped.slice(s, e + 1) : null
      const arrStr = s2 >= 0 && e2 > s2 ? fenceStripped.slice(s2, e2 + 1) : null
      const candidate = objStr && (!arrStr || s < s2) ? objStr : arrStr
      if (candidate) {
        try {
          parsed = JSON.parse(candidate)
          changes.push('Extracted JSON from surrounding text')
        } catch {
          throw new Error('Input is not valid JSON. Please paste a valid JSON object or array.')
        }
      } else {
        throw new Error('Input is not valid JSON. Please paste a valid JSON object or array.')
      }
    }
  } else {
    parsed = rawJson
  }

  // ── Extract questions array ──
  const rawQuestions = extractQuestionsArray(parsed)
  if (rawQuestions.length === 0) {
    throw new Error('No questions found in the JSON. Make sure your JSON contains a "questions" array or is an array of question objects.')
  }

  // ── Extract cases from top level ──
  const topLevelCases = (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
    ? extractCases(parsed as Record<string, unknown>)
    : []

  // ── Extract inline cases (exhibits embedded in questions) ──
  const { cases: inlineCases, caseIdByQIndex } = extractInlineCases(rawQuestions, changes)

  // Merge cases — top-level takes precedence
  const allCases: NormalisedCase[] = [...topLevelCases]
  for (const ic of inlineCases) {
    if (!allCases.find(c => c.caseId === ic.caseId)) {
      allCases.push(ic)
    }
  }

  // ── Normalise each question ──
  const normalisedQuestions: NormalisedQuestion[] = []
  rawQuestions.forEach((q, i) => {
    const inlineCaseId = caseIdByQIndex.get(i)
    const nq = normaliseQuestion(q, i, inlineCaseId, changes, warnings)
    if (nq) normalisedQuestions.push(nq)
  })

  if (normalisedQuestions.length === 0) {
    throw new Error('No valid questions could be extracted. Check that your questions have a text field and, for MCQs, an options array.')
  }

  if (normalisedQuestions.length < rawQuestions.length) {
    warnings.push(`${rawQuestions.length - normalisedQuestions.length} question(s) were skipped due to missing required fields`)
  }

  // ── Extract bundle metadata ──
  const meta = extractBundleMeta(parsed, normalisedQuestions)

  // ── Re-number question IDs sequentially ──
  normalisedQuestions.forEach((q, i) => { q.id = `q${i + 1}` })

  const bundle: NormalisedBundle = {
    ...meta,
    cases:     allCases,
    questions: normalisedQuestions,
  }

  return { bundle, changes, warnings }
}

/**
 * Validate a normalised bundle for publish-readiness.
 * Returns errors that must be fixed before publishing.
 */
export function validateNormalisedBundle(bundle: NormalisedBundle): string[] {
  const errors: string[] = []

  if (!bundle.title.trim())   errors.push('Title is required')
  if (bundle.questions.length === 0) errors.push('No questions in bundle')

  bundle.questions.forEach((q, i) => {
    const p = `Q${i + 1}`
    if (!q.questionText.trim()) errors.push(`${p}: question text is empty`)
    if (q.type === 'multiple-choice' || q.type === 'scenario') {
      const filledOptions = q.options.filter(o => o.trim().length > 0)
      if (filledOptions.length < 2) errors.push(`${p}: fewer than 2 options have content`)
      if (q.correctIndex === null) errors.push(`${p}: correct answer not set`)
    }
    if (q.type === 'writing' && !q.writingModelAnswer?.trim()) {
      errors.push(`${p}: writing question has no model answer`)
    }
  })

  return errors
}
