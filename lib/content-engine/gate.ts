// The one quality gate. It reads an answer (pasted text or an object), checks
// its shape and the house rules, and returns a scorecard. It never changes a
// word of the answer, never checks facts (owner decision D335) and never
// throws.
import { blueprintFor, sectionsFor } from './blueprints/index'
import { blocksToText, countWords, describePath, isRecord, validateBlocks } from './blocks'
import { isIsoDate } from './brief'
import { BANNED_OPTIONS, LETTER_REFERENCE_PATTERNS } from './packs/assessment'
import { findBodyNames } from './packs/body-names'
import { FORBIDDEN_PHRASE_LIST } from './packs/house-style'
import { extractJson } from './parse'
import {
  CHECK_ORDER,
  DIFFICULTIES,
  type Block,
  type CheckId,
  type CompiledPrompt,
  type EngineOutput,
  type Finding,
  type Scorecard,
  type Severity,
} from './types'
import { ENGINE_NAME } from './version'

export const NOT_CHECKED_FACTS = 'Facts and figures are not checked (owner decision D335); please review them.'
export const NOT_CHECKED_ANSWERS = 'Whether each correct answer is right is not checked; please review it.'
export const NOT_CHECKED_EXPLANATION_PARTS = 'The five parts of each explanation (why the correct answer is right, why each other option is wrong, the underlying idea, the standard reference and the takeaway) are not checked one by one; please review them.'

const ENVELOPE_FIELDS = ['engine', 'promptId', 'promptVersion', 'blueprint', 'contentType', 'title', 'summary', 'keyTerms', 'validAsAt', 'sourceSectionsCovered']
const PAYLOADS = ['document', 'questionSet', 'explainer'] as const
const QUESTION_FIELDS = [
  'id', 'type', 'questionText', 'options', 'correctIndex', 'explanation', 'writingModelAnswer',
  'writingExplanation', 'caseId', 'primaryTopic', 'difficulty', 'timeTargetMinutes', 'points', 'sourceSection',
]
/** Findings that mean the answer does not have the contract's shape. */
const SHAPE_CHECKS: CheckId[] = ['parse.json', 'envelope.fields', 'structure.sections', 'blocks.shape', 'q.shape', 'q.options', 'q.answer']
const INTERNAL_PATH = /(^|[\s("'[])(\/(?:study|articles|practice-questions|free-courses)(?:\/[^\s)"'\],;<>]*)?)/g
const WEB_LINK = /https?:\/\/[^\s)"'<>]+/i
const COVERAGE_MIN_WORDS = 40

interface TextItem { path: string; text: string }

class Report {
  findings: Finding[] = []
  add(check: CheckId, severity: Severity, message: string, path?: string): void {
    this.findings.push(path === undefined ? { check, severity, message } : { check, severity, message, path })
  }
  error(check: CheckId, message: string, path?: string): void { this.add(check, 'error', message, path) }
  warn(check: CheckId, message: string, path?: string): void { this.add(check, 'warning', message, path) }
}

function where(path: string): string {
  return describePath(path)
}

function normaliseTitle(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

function normaliseForPhrases(text: string): string {
  return text.replace(/[‘’]/g, "'").toLowerCase().replace(/\s+/g, ' ')
}

function naturalCompare(a: string, b: string): number {
  const split = (s: string) => s.match(/\d+|\D+/g) ?? []
  const x = split(a)
  const y = split(b)
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] === y[i]) continue
    const nx = /^\d/.test(x[i]) && /^\d/.test(y[i])
    if (nx) return Number(x[i]) - Number(y[i])
    return x[i] < y[i] ? -1 : 1
  }
  return x.length - y.length
}

function sortFindings(findings: Finding[]): Finding[] {
  const order = (c: CheckId) => (CHECK_ORDER as readonly string[]).indexOf(c)
  return findings
    .map((f, i) => ({ f, i }))
    .sort((p, q) => order(p.f.check) - order(q.f.check) || naturalCompare(p.f.path ?? '', q.f.path ?? '') || p.i - q.i)
    .map(p => p.f)
}

function lastSentenceStartsWithRemember(text: string): boolean {
  const trimmed = text.trim()
  const at = trimmed.lastIndexOf('Remember:')
  if (at < 0) return false
  if (at > 0 && !/[.!?]["')\]]?\s+$/.test(trimmed.slice(0, at))) return false
  return !/[.!?]["')\]]?\s+\S/.test(trimmed.slice(at))
}

function wordSet(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9£%.\s]/g, ' ').split(/\s+/).filter(Boolean)
  return words.filter((w, i) => words.indexOf(w) === i)
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  let shared = 0
  for (const w of a) if (b.indexOf(w) >= 0) shared++
  return shared / (a.length + b.length - shared)
}

function emptyScorecard(findings: Finding[], notChecked: string[]): Scorecard {
  return { ...score(findings), findings: sortFindings(findings), output: null, stats: { words: 0, sections: 0, questions: 0, blocks: 0 }, notChecked }
}

function score(findings: Finding[]): { ok: boolean; score: number } {
  const errors = findings.filter(f => f.severity === 'error').length
  const warnings = findings.filter(f => f.severity === 'warning').length
  return { ok: errors === 0, score: Math.max(0, Math.floor(100 - 20 * errors - 5 * warnings)) }
}

function checkEnvelope(r: Report, value: Record<string, unknown>, compiled: CompiledPrompt, payload: (typeof PAYLOADS)[number]): void {
  if (value.engine !== ENGINE_NAME) r.error('envelope.engine', `The answer does not say it was made by ${ENGINE_NAME}.`, 'engine')
  if (value.promptId !== compiled.promptId || value.promptVersion !== compiled.promptVersion) {
    r.error('envelope.prompt', 'This answer was made from a different prompt.', 'promptId')
  }
  if (value.blueprint !== compiled.blueprintId || value.contentType !== compiled.brief.contentType) {
    r.error('envelope.blueprint', `This answer is for a different content type; it should be ${compiled.brief.contentType} (blueprint ${compiled.blueprintId}).`, 'blueprint')
  }
  for (const key of ENVELOPE_FIELDS) {
    if (!(key in value)) r.error('envelope.fields', `The answer is missing its "${key}" field.`, key)
  }
  for (const key of Object.keys(value)) {
    if (ENVELOPE_FIELDS.indexOf(key) < 0 && (PAYLOADS as readonly string[]).indexOf(key) < 0) {
      r.error('envelope.fields', `The answer has an unexpected field "${key.slice(0, 40)}".`, key.slice(0, 40))
    }
  }
  if ('title' in value && (typeof value.title !== 'string' || value.title.trim() === '' || value.title.length > 200)) {
    r.error('envelope.fields', 'The title must be text of 1 to 200 characters.', 'title')
  }
  if ('summary' in value) {
    if (typeof value.summary !== 'string') r.error('envelope.fields', 'The summary must be text.', 'summary')
    else if (value.summary.trim().length < 120 || value.summary.trim().length > 200) {
      r.warn('envelope.fields', `The summary is ${value.summary.trim().length} characters; it should be 120 to 200.`, 'summary')
    }
  }
  if ('keyTerms' in value) {
    const terms = value.keyTerms
    if (!Array.isArray(terms) || !terms.every(t => typeof t === 'string' && t.trim() !== '')) {
      r.error('envelope.fields', 'keyTerms must be a list of texts.', 'keyTerms')
    } else if (terms.length < 3 || terms.length > 12) {
      r.warn('envelope.fields', `There are ${terms.length} key terms; there should be 3 to 12.`, 'keyTerms')
    }
  }
  if ('validAsAt' in value && value.validAsAt !== null && typeof value.validAsAt !== 'string') {
    r.error('envelope.fields', 'validAsAt must be a date text or null.', 'validAsAt')
  }
  if ('sourceSectionsCovered' in value) {
    const covered = value.sourceSectionsCovered
    if (!Array.isArray(covered) || !covered.every(c => typeof c === 'string')) {
      r.error('envelope.fields', 'sourceSectionsCovered must be a list of section ids.', 'sourceSectionsCovered')
    }
  }
  for (const key of PAYLOADS) {
    if (key === payload) {
      if (!isRecord(value[key])) r.error('envelope.fields', `The answer needs its "${key}" object.`, key)
    } else if (key in value) {
      r.error('envelope.fields', `The answer has a "${key}" part, but this content type uses "${payload}".`, key)
    }
  }
}

interface DocumentResult { texts: TextItem[]; words: number; sections: number; blocks: number }

function checkDocument(r: Report, doc: Record<string, unknown>, compiled: CompiledPrompt): DocumentResult {
  const result: DocumentResult = { texts: [], words: 0, sections: 0, blocks: 0 }
  const choice = blueprintFor(compiled.brief.contentType)
  const expected = sectionsFor(choice)
  const related = compiled.brief.relatedNotes ?? []
  for (const key of Object.keys(doc)) {
    if (key !== 'sections') r.error('structure.sections', `The document has an unexpected field "${key.slice(0, 40)}".`, 'document')
  }
  const sections = doc.sections
  if (!Array.isArray(sections)) {
    r.error('structure.sections', 'The document needs a list of sections.', 'document.sections')
    return result
  }
  result.sections = sections.length
  const seen: string[] = []
  const order: number[] = []
  sections.forEach((raw, i) => {
    const path = `document.sections[${i}]`
    if (!isRecord(raw)) {
      r.error('structure.sections', `${where(path)}: must be an object with an id and blocks.`, path)
      return
    }
    for (const key of Object.keys(raw)) {
      if (key !== 'id' && key !== 'blocks') r.error('structure.sections', `${where(path)}: has an unexpected field "${key.slice(0, 40)}".`, path)
    }
    const id = typeof raw.id === 'string' ? raw.id : ''
    const index = expected.findIndex(s => s.id === id)
    if (index < 0) r.error('structure.sections', `${where(path)}: "${id.slice(0, 60)}" is not a section of this content type.`, path)
    else if (seen.indexOf(id) >= 0) r.error('structure.sections', `${where(path)}: the section "${id}" appears twice.`, path)
    else { seen.push(id); order.push(index) }

    const { blocks, findings } = validateBlocks(raw.blocks, `${path}.blocks`)
    r.findings.push(...findings)
    result.blocks += blocks.length
    const text = blocksToText(blocks)
    const words = countWords(text)
    result.words += words
    blocks.forEach((block, j) => result.texts.push({ path: `${path}.blocks[${j}]`, text: blocksToText([block]) }))
    if (index < 0) return
    const spec = expected[index]
    const types = blocks.map(b => b.type)
    for (const type of spec.requiredBlockTypes) {
      if (types.indexOf(type) < 0) r.error('blocks.required', `Section "${spec.id}" needs at least one ${type} block.`, path)
    }
    if (words < spec.minWords || words > spec.maxWords) {
      r.warn('words.section', `Section "${spec.id}" has ${words} words; it should have ${spec.minWords} to ${spec.maxWords}.`, path)
    }
    if (spec.id === 'related-notes') {
      for (const note of related) {
        if (text.indexOf(note.path) < 0) r.error('structure.sections', `The related notes section does not list ${note.path}.`, path)
      }
    }
  })
  for (const spec of expected) {
    const required = spec.id === 'related-notes' ? related.length > 0 : !spec.optional
    if (required && seen.indexOf(spec.id) < 0) r.error('structure.sections', `The required section "${spec.id}" is missing.`, 'document.sections')
  }
  for (let i = 1; i < order.length; i++) {
    if (order[i] < order[i - 1]) {
      r.error('structure.sections', 'The sections are not in the required order.', 'document.sections')
      break
    }
  }
  checkTotalWords(r, result.words, choice.blueprint.totalWords, 'document')
  return result
}

function checkTotalWords(r: Report, words: number, range: { min: number; max: number }, path: string): void {
  if (words < 0.8 * range.min || words > 1.25 * range.max) {
    r.error('words.total', `The content has ${words} words, far outside the ${range.min} to ${range.max} words asked for.`, path)
  } else if (words < range.min || words > range.max) {
    r.warn('words.total', `The content has ${words} words; it should have ${range.min} to ${range.max}.`, path)
  }
}

interface QuestionResult { texts: TextItem[]; words: number; questions: number; sourceSections: string[] }

function checkQuestions(r: Report, set: Record<string, unknown>, compiled: CompiledPrompt): QuestionResult {
  const result: QuestionResult = { texts: [], words: 0, questions: 0, sourceSections: [] }
  for (const key of Object.keys(set)) {
    if (key !== 'questions') r.error('q.shape', `The question set has an unexpected field "${key.slice(0, 40)}".`, 'questionSet')
  }
  const questions = set.questions
  if (!Array.isArray(questions)) {
    r.error('q.shape', 'The question set needs a list of questions.', 'questionSet.questions')
    return result
  }
  result.questions = questions.length
  const expectedCount = compiled.expected.questionCount ?? 0
  if (questions.length !== expectedCount) {
    r.error('q.count', `There are ${questions.length} questions; the prompt asked for ${expectedCount}.`, 'questionSet.questions')
  }
  const sourceIds = compiled.source ? compiled.source.sections.map(s => s.id) : []
  const positions: (number | null)[] = []
  const stems: { index: number; text: string }[] = []

  questions.forEach((raw, i) => {
    const path = `questionSet.questions[${i}]`
    const label = `Question ${i + 1}`
    if (!isRecord(raw)) {
      r.error('q.shape', `${label}: must be a question object.`, path)
      positions.push(null)
      return
    }
    for (const key of QUESTION_FIELDS) {
      if (!(key in raw)) r.error('q.shape', `${label}: is missing its "${key}" field.`, path)
    }
    for (const key of Object.keys(raw)) {
      if (QUESTION_FIELDS.indexOf(key) < 0) r.error('q.shape', `${label}: has an unexpected field "${key.slice(0, 40)}".`, path)
    }
    if ('id' in raw && raw.id !== `q${i + 1}`) r.error('q.shape', `${label}: its id should be "q${i + 1}".`, `${path}.id`)
    if ('type' in raw && raw.type !== 'multiple-choice') r.error('q.shape', `${label}: its type must be "multiple-choice".`, `${path}.type`)
    for (const key of ['writingModelAnswer', 'writingExplanation', 'caseId']) {
      if (key in raw && raw[key] !== null) r.error('q.shape', `${label}: ${key} must be null.`, `${path}.${key}`)
    }
    if ('questionText' in raw && (typeof raw.questionText !== 'string' || raw.questionText.trim() === '')) {
      r.error('q.shape', `${label}: the question text must be non-empty text.`, `${path}.questionText`)
    }
    if ('explanation' in raw && typeof raw.explanation !== 'string') r.error('q.shape', `${label}: the explanation must be text.`, `${path}.explanation`)
    if ('primaryTopic' in raw && (typeof raw.primaryTopic !== 'string' || raw.primaryTopic.trim() === '')) {
      r.error('q.shape', `${label}: primaryTopic must be non-empty text.`, `${path}.primaryTopic`)
    }
    if ('difficulty' in raw && !(typeof raw.difficulty === 'string' && (DIFFICULTIES as readonly string[]).indexOf(raw.difficulty) >= 0)) {
      r.error('q.shape', `${label}: difficulty must be beginner, intermediate or advanced.`, `${path}.difficulty`)
    }
    for (const key of ['timeTargetMinutes', 'points']) {
      if (key in raw && !(typeof raw[key] === 'number' && isFinite(raw[key] as number) && (raw[key] as number) > 0)) {
        r.error('q.shape', `${label}: ${key} must be a number above zero.`, `${path}.${key}`)
      }
    }
    if ('sourceSection' in raw && typeof raw.sourceSection !== 'string') r.error('q.shape', `${label}: sourceSection must be a section id.`, `${path}.sourceSection`)

    // Options
    const options = raw.options
    if (!Array.isArray(options) || options.length !== 4) {
      r.error('q.options', `${label}: must have exactly 4 options.`, `${path}.options`)
    }
    if (Array.isArray(options)) {
      const seenOptions: string[] = []
      options.forEach((option, k) => {
        const optionPath = `${path}.options[${k}]`
        if (typeof option !== 'string' || option.trim() === '') {
          r.error('q.options', `${label}: option ${k + 1} is empty.`, optionPath)
          return
        }
        const norm = option.toLowerCase().trim().replace(/\s+/g, ' ')
        if (seenOptions.indexOf(norm) >= 0) r.error('q.options', `${label}: two options are the same.`, optionPath)
        seenOptions.push(norm)
        const bare = norm.replace(/[.!?;:,]+$/, '').trim()
        if (BANNED_OPTIONS.indexOf(bare) >= 0) r.error('q.banned', `${label}: "${option.trim().slice(0, 40)}" is not allowed as an option.`, optionPath)
        result.texts.push({ path: optionPath, text: option })
        result.words += countWords(option)
      })
    }

    // Answer
    const answer = raw.correctIndex
    const validAnswer = typeof answer === 'number' && Number.isInteger(answer) && answer >= 0 && answer <= 3
    if (!validAnswer) r.error('q.answer', `${label}: correctIndex must be a whole number from 0 to 3.`, `${path}.correctIndex`)
    positions.push(validAnswer ? (answer as number) : null)

    // Texts, letter references, explanation
    for (const key of ['questionText', 'explanation'] as const) {
      const text = raw[key]
      if (typeof text !== 'string') continue
      result.texts.push({ path: `${path}.${key}`, text })
      result.words += countWords(text)
      LETTER_REFERENCE_PATTERNS.forEach((pattern, p) => {
        if (pattern.test(text)) {
          const part = key === 'questionText' ? 'the question text' : 'the explanation'
          r.error('q.letterRefs', `${label}: ${part} refers to an option by its letter or position (pattern P${p + 1}).`, `${path}.${key}`)
        }
      })
    }
    if (typeof raw.primaryTopic === 'string') result.texts.push({ path: `${path}.primaryTopic`, text: raw.primaryTopic })
    if (typeof raw.explanation === 'string') {
      const words = countWords(raw.explanation)
      if (words < 120 || words > 300) r.error('q.explanation', `${label}: the explanation has ${words} words; it should have 120 to 300.`, `${path}.explanation`)
      if (!lastSentenceStartsWithRemember(raw.explanation)) {
        r.error('q.explanation', `${label}: the explanation's last sentence must start with "Remember:".`, `${path}.explanation`)
      }
    }
    if (typeof raw.questionText === 'string' && raw.questionText.trim() !== '') stems.push({ index: i, text: raw.questionText })

    // Source section
    if (typeof raw.sourceSection === 'string') {
      result.sourceSections.push(raw.sourceSection)
      if (compiled.source && sourceIds.indexOf(raw.sourceSection) < 0) {
        r.error('q.source', `${label}: its source section "${raw.sourceSection.slice(0, 20)}" is not a section of the source note.`, `${path}.sourceSection`)
      }
    }
  })

  // Answer balance
  if (questions.length >= 10) {
    for (let p = 0; p < 4; p++) {
      const share = positions.filter(x => x === p).length / questions.length
      if (share < 0.2 || share > 0.3) {
        r.warn('q.balance', `The correct answer is in position ${p + 1} for ${Math.round(share * 100)}% of the questions; aim for 20-30%.`, 'questionSet.questions')
      }
    }
  }
  let run = 1
  for (let i = 1; i <= positions.length; i++) {
    if (i < positions.length && positions[i] !== null && positions[i] === positions[i - 1]) {
      run++
      continue
    }
    if (run >= 4) {
      r.warn('q.balance', `Questions ${i - run + 1} to ${i} all have the correct answer in the same position.`, `questionSet.questions[${i - run}]`)
    }
    run = 1
  }

  // Duplicate stems
  for (let a = 0; a < stems.length; a++) {
    for (let b = a + 1; b < stems.length; b++) {
      const x = stems[a]
      const y = stems[b]
      if (normaliseTitle(x.text) === normaliseTitle(y.text)) {
        r.error('q.dupStem', `Questions ${x.index + 1} and ${y.index + 1} have the same question text.`, `questionSet.questions[${y.index}].questionText`)
      } else if (jaccard(wordSet(x.text), wordSet(y.text)) >= 0.9) {
        r.warn('q.dupStem', `Questions ${x.index + 1} and ${y.index + 1} have nearly the same question text.`, `questionSet.questions[${y.index}].questionText`)
      }
    }
  }
  return result
}

function checkTexts(r: Report, texts: TextItem[], compiled: CompiledPrompt): void {
  const allowed = (compiled.brief.relatedNotes ?? []).map(n => n.path.replace(/\/+$/, ''))
  for (const item of texts) {
    INTERNAL_PATH.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = INTERNAL_PATH.exec(item.text)) !== null) {
      const found = match[2].replace(/[.:!?]+$/, '').replace(/\/+$/, '')
      if (allowed.indexOf(found) < 0) {
        r.error('links.internal', `${where(item.path)}: links to ${found.slice(0, 80)}, which is not one of the related notes given.`, item.path)
      }
    }
    if (WEB_LINK.test(item.text)) r.warn('links.internal', `${where(item.path)}: contains a web link; links are not allowed in the content.`, item.path)
  }
  for (const item of texts) {
    for (const name of findBodyNames(item.text)) {
      r.error('body.names', `${where(item.path)}: names "${name}"; write for the level instead of naming a body.`, item.path)
    }
  }
}

function checkPhrases(r: Report, texts: TextItem[]): void {
  const normalised = texts.map(t => ({ path: t.path, text: normaliseForPhrases(t.text) }))
  for (const phrase of FORBIDDEN_PHRASE_LIST) {
    const needle = normaliseForPhrases(phrase)
    const hit = normalised.find(t => t.text.indexOf(needle) >= 0)
    if (hit) r.warn('style.forbidden', `${where(hit.path)}: uses the forbidden phrase "${phrase}".`, hit.path)
  }
}

/** Runs every check on an answer and returns the scorecard. Never throws, never rewrites. */
export function runGate(raw: unknown, compiled: CompiledPrompt): Scorecard {
  const choice = (() => { try { return blueprintFor(compiled.brief.contentType) } catch { return null } })()
  const isQuestions = choice?.blueprint.output === 'questionSet'
  const notChecked = isQuestions ? [NOT_CHECKED_FACTS, NOT_CHECKED_ANSWERS, NOT_CHECKED_EXPLANATION_PARTS] : [NOT_CHECKED_FACTS]
  try {
    if (!choice) return emptyScorecard([{ check: 'parse.json', severity: 'error', message: 'The prompt for this answer could not be read.' }], notChecked)
    const r = new Report()
    let value: unknown = raw
    if (typeof raw === 'string') {
      const parsed = extractJson(raw)
      r.findings.push(...parsed.findings)
      if (parsed.findings.some(f => f.check === 'parse.json')) return emptyScorecard(r.findings, notChecked)
      value = parsed.value
    }
    if (!isRecord(value)) {
      r.error('envelope.fields', 'The answer is not a JSON object.')
      return emptyScorecard(r.findings, notChecked)
    }
    const payload = choice.blueprint.output
    checkEnvelope(r, value, compiled, payload)

    const texts: TextItem[] = []
    if (typeof value.title === 'string') texts.push({ path: 'title', text: value.title })
    if (typeof value.summary === 'string') texts.push({ path: 'summary', text: value.summary })
    if (Array.isArray(value.keyTerms)) value.keyTerms.forEach((t, i) => { if (typeof t === 'string') texts.push({ path: `keyTerms[${i}]`, text: t }) })

    const stats = { words: 0, sections: 0, questions: 0, blocks: 0 }
    let questionSources: string[] | null = null
    const part = value[payload]
    if (payload === 'document' && isRecord(part)) {
      const d = checkDocument(r, part, compiled)
      texts.push(...d.texts)
      stats.words = d.words
      stats.sections = d.sections
      stats.blocks = d.blocks
    } else if (payload === 'explainer' && isRecord(part)) {
      for (const key of Object.keys(part)) {
        if (key !== 'blocks') r.error('blocks.shape', `The explainer has an unexpected field "${key.slice(0, 40)}".`, 'explainer')
      }
      const { blocks, findings } = validateBlocks(part.blocks, 'explainer.blocks')
      r.findings.push(...findings)
      blocks.forEach((block: Block, j: number) => texts.push({ path: `explainer.blocks[${j}]`, text: blocksToText([block]) }))
      stats.blocks = blocks.length
      stats.words = countWords(blocksToText(blocks))
      checkTotalWords(r, stats.words, choice.blueprint.totalWords, 'explainer')
    } else if (payload === 'questionSet' && isRecord(part)) {
      const q = checkQuestions(r, part, compiled)
      texts.push(...q.texts)
      stats.words = q.words
      stats.questions = q.questions
      questionSources = q.sourceSections
    }

    checkTexts(r, texts, compiled)

    // validAsAt
    const brief = compiled.brief
    const required = brief.subject === 'taxation' || brief.contentType === 'tax-guide'
    const expectedDate = brief.validAsAt ?? null
    const date = value.validAsAt === undefined ? null : value.validAsAt
    if (required && date === null) r.error('tax.validAsAt', `This tax content needs validAsAt "${expectedDate}".`, 'validAsAt')
    else if (date !== null && !isIsoDate(date)) r.error('tax.validAsAt', 'validAsAt must be a real date written YYYY-MM-DD.', 'validAsAt')
    else if (date !== expectedDate) {
      r.error('tax.validAsAt', expectedDate === null ? 'validAsAt must be null: the brief gives no date.' : `validAsAt must be "${expectedDate}", the date in the brief.`, 'validAsAt')
    }

    // Duplicate title
    if (typeof value.title === 'string') {
      const title = normaliseTitle(value.title)
      if ((brief.avoidTitles ?? []).some(t => normaliseTitle(t) === title)) r.error('dup.title', 'The title is the same as an existing title.', 'title')
    }

    // Source coverage
    const covered = Array.isArray(value.sourceSectionsCovered) ? value.sourceSectionsCovered.filter((c): c is string => typeof c === 'string') : []
    const source = compiled.source
    const ids = source ? source.sections.map(s => s.id) : []
    for (const id of covered) {
      if (ids.indexOf(id) < 0) {
        r.error('coverage.source', source ? `sourceSectionsCovered lists "${id.slice(0, 20)}", which is not a section of the source note.` : 'There is no source note, so sourceSectionsCovered must be empty.', 'sourceSectionsCovered')
      }
    }
    if (source) {
      const big = source.sections.filter(s => s.words >= COVERAGE_MIN_WORDS)
      for (const s of big) {
        if (questionSources !== null) {
          if (stats.questions >= big.length && questionSources.indexOf(s.id) < 0) {
            r.error('coverage.source', `No question is tied to source section ${s.id} ("${s.heading.slice(0, 60)}").`, 'questionSet.questions')
          }
        } else if (covered.indexOf(s.id) < 0) {
          r.error('coverage.source', `Source section ${s.id} ("${s.heading.slice(0, 60)}") is not covered.`, 'sourceSectionsCovered')
        }
      }
    }

    checkPhrases(r, texts)

    const shapeOk = !r.findings.some(f => f.severity === 'error' && SHAPE_CHECKS.indexOf(f.check) >= 0)
    return {
      ...score(r.findings),
      findings: sortFindings(r.findings),
      output: shapeOk ? (value as unknown as EngineOutput) : null,
      stats,
      notChecked,
    }
  } catch {
    return emptyScorecard([{ check: 'parse.json', severity: 'error', message: 'The answer could not be checked.' }], notChecked)
  }
}
