// The one prompt compiler. Both doors (copy the prompt, or generate here) send
// THIS text, and the answer must come back with the same promptId. The id is
// computed before the text is written, so it is part of the text, and the
// same brief always gives the same id and the same text.
import { blueprintFor, sectionsFor, type BlueprintChoice } from './blueprints/index'
import { QUESTION_COUNT_DEFAULT, validateBrief } from './brief'
import { canonicalJson, sha16 } from './canonical'
import { PACKS_FINGERPRINT } from './packs/index'
import {
  ANSWER_BALANCE,
  DISTRACTOR_LIBRARY,
  EXPLANATION_STANDARDS,
  OPTION_REFERENCES,
  STUDIO_QUESTION_STANDARD,
} from './packs/assessment'
import { BODY_NAME_RULE } from './packs/body-names'
import {
  DIFFICULTY_GUIDE,
  FORBIDDEN_PHRASES,
  INSIGHT_DENSITY,
  ORIGINALITY_AND_LEGAL,
  QUALITY_SELF_CHECK,
  TECHNICAL_ACCURACY,
  VOICE,
} from './packs/house-style'
import { JURISDICTION_PACKS } from './packs/jurisdictions'
import { LEVEL_PACKS } from './packs/levels'
import { REVIEWER_RULES } from './packs/reviewer'
import { subjectContext } from './packs/subjects'
import { sourceFromHtml } from './source'
import type { Blueprint, BlueprintSection, Brief, CompileFailure, CompiledPrompt, SourceNote } from './types'
import { ENGINE_NAME, ENGINE_VERSION } from './version'

export const REVIEWER_VERSION = '1.0.0'

/** The block types, their exact JSON fields and limits, as the writer sees them. */
export const BLOCK_GUIDE = `Every block is one JSON object with a "type" and exactly these fields (no others):
- heading: { "type": "heading", "level": 2 or 3, "text": string }
- paragraph: { "type": "paragraph", "text": string }
- definition: { "type": "definition", "term": string, "text": string }
- worked_example: { "type": "worked_example", "title": string, "scenario": string, "steps": [string, … 1 to 12], "answer": string }
- calculation: { "type": "calculation", "title": string, "steps": [{ "label": string, "working": string, "result": string }, … 1 to 20] }
- journal_entry: { "type": "journal_entry", "title": string, "narrative": string (optional), "lines": [{ "account": string, "debit": number or null, "credit": number or null }, … 2 to 12] } — each line has exactly one side above zero and the other null; total debits equal total credits to the penny; amounts are plain numbers (42847.5, not "£42,847.50")
- table: { "type": "table", "caption": string, "columns": [string, … 2 to 8], "rows": [[string, …], … 1 to 30] } — every row has one cell per column
- key_point: { "type": "key_point", "text": string }
- common_mistake: { "type": "common_mistake", "mistake": string, "correction": string }
- exam_tip: { "type": "exam_tip", "text": string }
- check_understanding: { "type": "check_understanding", "question": string, "answer": string }
- takeaway: { "type": "takeaway", "points": [string, … 2 to 7] }
- list: { "type": "list", "style": "bullet" or "number", "items": [string, … 2 to 12] }
Every text is plain text of 1 to 1,200 characters. The only marks allowed are **bold** and *italic*. Never use < or > or any HTML, markdown headings, tables or code formatting inside text.`

/** The gate's checks in plain words, so the writer can meet them. */
export const GATE_SELF_CHECK = `THE AUTOMATIC CHECKS YOUR ANSWER WILL FACE:
- The answer is one JSON object with exactly the fields of the OUTPUT template; engine, promptId, promptVersion, blueprint and contentType are copied exactly.
- The summary is 120 to 200 characters; keyTerms has 3 to 12 terms.
- Every section listed in STRUCTURE is present once, in the given order, with its required block types and a word count inside its range; the total word count is inside the total range.
- Every block has exactly its fields, within its limits; no text contains < or >; every journal entry balances.
- No internal path appears except the related notes paths given; no web links.
- No professional body name appears anywhere.
- validAsAt is exactly as the RULES say.
- The title is not one of the titles to avoid.
- sourceSectionsCovered lists every source section of 40 words or more that you used, and only real section ids.
- No forbidden phrase appears.`

const QUESTION_SELF_CHECK = `- Exactly the requested number of questions, ids q1, q2, … in order, each with every field of the template.
- Exactly 4 options per question, none empty, no two the same, none of "all of the above", "none of the above" or similar.
- correctIndex is a whole number from 0 to 3; the correct answer positions are balanced across the set.
- No explanation or question text refers to an option by its letter or position.
- Every explanation is 120 to 300 words and its last sentence starts with "Remember:".
- No two question texts are the same or nearly the same.
- Every question's sourceSection is a real source section id.`

export function promptVersionFor(blueprint: Blueprint): string {
  return `${blueprint.id}@${blueprint.version}/engine@${ENGINE_VERSION}/packs@${PACKS_FINGERPRINT}`
}

export function isCompiled(result: CompiledPrompt | CompileFailure): result is CompiledPrompt {
  return 'promptId' in result
}

function sourceBlock(source: SourceNote | null): string {
  if (!source) return 'No source note: write from the topic.'
  const parts = [`Title: ${source.title}`, `Words: ${source.words}`]
  for (const s of source.sections) parts.push(`[${s.id}] ${s.heading}\n${s.text}`)
  return parts.join('\n\n')
}

function structureBlock(brief: Brief, choice: BlueprintChoice, sections: BlueprintSection[], questionCount: number | undefined): string {
  const blueprint = choice.blueprint
  if (blueprint.output === 'questionSet') {
    return [
      `Write exactly ${questionCount} multiple-choice questions, ids q1 to q${questionCount}, in the "questionSet" of the OUTPUT template.`,
      ...blueprint.rules.map(r => `- ${r}`),
    ].join('\n')
  }
  if (blueprint.output === 'explainer') {
    const q = brief.question
    const lines = [
      `Write one list of blocks in "explainer.blocks", ${blueprint.totalWords.min} to ${blueprint.totalWords.max} words in total.`,
      ...blueprint.rules.map(r => `- ${r}`),
    ]
    if (q) {
      lines.push('', 'THE QUESTION TO EXPLAIN:', q.questionText, '', 'Its options (refer to them by their content only):')
      q.options.forEach((option, i) => lines.push(`- ${option}${i === q.correctIndex ? '   ← the correct answer' : ''}`))
      lines.push('', 'Its current explanation:', q.explanation || '(none)')
    }
    return lines.join('\n')
  }
  const lines = [`Return the sections below in "document.sections", in this order, each as { "id": "<section id>", "blocks": [ … ] }. Total: ${blueprint.totalWords.min} to ${blueprint.totalWords.max} words.`]
  for (const s of sections) {
    const optional = s.id === 'related-notes'
      ? ((brief.relatedNotes ?? []).length > 0 ? ' (required: the brief lists related notes)' : ' (optional: leave it out, as no related notes are given)')
      : s.optional ? ' (optional)' : ''
    lines.push(`[${s.id}] ${s.title}${optional} — ${s.minWords} to ${s.maxWords} words; must include: ${s.requiredBlockTypes.join(', ')}\n  ${s.purpose}`)
  }
  if (blueprint.rules.length) lines.push('', ...blueprint.rules.map(r => `- ${r}`))
  return lines.join('\n')
}

function template(compiled: { promptId: string; promptVersion: string }, brief: Brief, choice: BlueprintChoice, sections: BlueprintSection[], questionCount: number | undefined, source: SourceNote | null): string {
  const blueprint = choice.blueprint
  const covered = source && source.sections.length
    ? `[${source.sections.map(s => `"${s.id}"`).join(', ')}]  (the ids of the source sections you used)`
    : '[]'
  const head = [
    '{',
    `  "engine": "${ENGINE_NAME}",`,
    `  "promptId": "${compiled.promptId}",`,
    `  "promptVersion": "${compiled.promptVersion}",`,
    `  "blueprint": "${blueprint.id}",`,
    `  "contentType": "${brief.contentType}",`,
    '  "title": "<title>",',
    '  "summary": "<120 to 200 characters>",',
    '  "keyTerms": ["<3 to 12 key terms>"],',
    `  "validAsAt": ${brief.validAsAt ? `"${brief.validAsAt}"` : 'null'},`,
    `  "sourceSectionsCovered": ${covered},`,
  ]
  if (blueprint.output === 'questionSet') {
    const example = source && source.sections.length ? source.sections[0].id : 's1'
    return [
      ...head,
      '  "questionSet": {',
      '    "questions": [',
      '      {',
      '        "id": "q1",',
      '        "type": "multiple-choice",',
      '        "questionText": "<the question>",',
      '        "options": ["<option>", "<option>", "<option>", "<option>"],',
      '        "correctIndex": <0, 1, 2 or 3>,',
      '        "explanation": "<120 to 300 words; the last sentence starts with Remember:>",',
      '        "writingModelAnswer": null,',
      '        "writingExplanation": null,',
      '        "caseId": null,',
      '        "primaryTopic": "<the sub-topic tested>",',
      '        "difficulty": "<beginner, intermediate or advanced>",',
      '        "timeTargetMinutes": 2,',
      '        "points": 2,',
      `        "sourceSection": "<a source section id, for example ${example}>"`,
      '      }',
      `      … ${questionCount} questions in all, q1 to q${questionCount}`,
      '    ]',
      '  }',
      '}',
    ].join('\n')
  }
  if (blueprint.output === 'explainer') {
    return [...head, '  "explainer": {', '    "blocks": [ <blocks> ]', '  }', '}'].join('\n')
  }
  const wanted = sections.filter(s => s.id !== 'related-notes' || (brief.relatedNotes ?? []).length > 0)
  return [
    ...head,
    '  "document": {',
    '    "sections": [',
    ...wanted.map((s, i) => `      { "id": "${s.id}", "blocks": [ <blocks> ] }${i < wanted.length - 1 ? ',' : ''}`),
    '    ]',
    '  }',
    '}',
  ].join('\n')
}

function assemble(parts: [string, string][]): string {
  return parts.map(([heading, body]) => `${heading}\n${body}`).join('\n\n')
}

/** The prompt for a brief, or the brief's findings when it is not valid. Never throws. */
export function compilePrompt(input: unknown): CompiledPrompt | CompileFailure {
  const { brief, findings } = validateBrief(input)
  if (!brief) return { findings }

  const choice = blueprintFor(brief.contentType)
  const blueprint = choice.blueprint
  const sections = sectionsFor(choice)
  const source = brief.source ? sourceFromHtml(brief.source.html, brief.source.title) : null
  const questionCount = blueprint.output === 'questionSet' ? brief.questionCount ?? QUESTION_COUNT_DEFAULT : undefined
  const sectionIds = sections.map(s => s.id)
  const promptVersion = promptVersionFor(blueprint)
  const promptId = sha16(canonicalJson({ promptVersion, brief, sectionIds }))

  const level = LEVEL_PACKS[brief.level]
  const subject = choice.preset?.subject ?? brief.subject
  const difficulty = brief.difficulty ?? 'intermediate'
  const isQuestions = blueprint.output === 'questionSet'

  const task = [
    `Content type: ${brief.contentType} (blueprint ${blueprint.id} ${blueprint.version})`,
    `Purpose: ${blueprint.purpose}`,
    ...(choice.preset ? [`Emphasis: ${choice.preset.emphasis}`] : []),
    `Topic: ${brief.topic}`,
    `Difficulty: ${difficulty} — ${DIFFICULTY_GUIDE[difficulty]}`,
    ...(brief.eticpa ? [`ETICPA level: ${brief.eticpa.level}; module: ${brief.eticpa.module}`] : []),
    '',
    'LEVEL CALIBRATION (internal only — use it to set depth; never name the level or any body in the content):',
    level.depth,
    ...(isQuestions ? ['', level.questionCalibration] : []),
    '',
    'SUBJECT STANDARDS:',
    subjectContext(subject),
    '',
    JURISDICTION_PACKS[brief.jurisdiction],
  ].join('\n')

  const related = (brief.relatedNotes ?? []).length
    ? ['These are the ONLY internal links allowed; write each path exactly as given:', ...(brief.relatedNotes ?? []).map(n => `- ${n.title}: ${n.path}`)].join('\n')
    : 'None: do not write any internal path.'

  const avoid = (brief.avoidTitles ?? []).length
    ? ['Do not use any of these titles (they already exist):', ...(brief.avoidTitles ?? []).map(t => `- ${t}`)].join('\n')
    : 'None.'

  const validAsAt = brief.validAsAt
    ? `"validAsAt" must be "${brief.validAsAt}": every tax figure is valid as at that date, and the text says so.`
    : '"validAsAt" must be null.'

  const rules = [
    FORBIDDEN_PHRASES,
    INSIGHT_DENSITY,
    TECHNICAL_ACCURACY,
    ORIGINALITY_AND_LEGAL,
    `BODY-NAME RULE: ${BODY_NAME_RULE}`,
    ...(isQuestions ? [STUDIO_QUESTION_STANDARD, DISTRACTOR_LIBRARY, EXPLANATION_STANDARDS, ANSWER_BALANCE, OPTION_REFERENCES] : []),
    ...(blueprint.output === 'explainer' ? [OPTION_REFERENCES] : []),
    'TEXT AND LINKS: Text fields are plain text; the only marks are **bold** and *italic*. Never write an internal path other than the related notes paths, and never write a web link.',
    `DATE: ${validAsAt}`,
  ].join('\n\n')

  const selfCheck = [QUALITY_SELF_CHECK, GATE_SELF_CHECK, ...(isQuestions ? [QUESTION_SELF_CHECK] : [])].join('\n\n')

  const output = [
    template({ promptId, promptVersion }, brief, choice, sections, questionCount, source),
    '',
    'Return ONLY the JSON object. No markdown fences, no text before or after it. promptId and promptVersion must be returned exactly as given.',
  ].join('\n')

  const text = assemble([
    ['ROLE', VOICE],
    ['TASK', task],
    ['SOURCE NOTE', sourceBlock(source)],
    ['RELATED NOTES', related],
    ['AVOID', avoid],
    ['STRUCTURE', structureBlock(brief, choice, sections, questionCount)],
    ['BLOCKS', blueprint.output === 'questionSet' ? 'Questions use plain text fields only (no blocks). The only marks allowed are **bold** and *italic*; never use < or >.' : BLOCK_GUIDE],
    ['RULES', rules],
    ['SELF-CHECK', selfCheck],
    ['OUTPUT', output],
  ])

  return {
    promptId,
    promptVersion,
    blueprintId: blueprint.id,
    ...(choice.preset ? { preset: choice.preset.contentType } : {}),
    brief,
    source,
    text,
    expected: { sectionIds, ...(questionCount !== undefined ? { questionCount } : {}) },
  }
}

/**
 * The optional second opinion (decision G): the reviewer gets the rules, the
 * source and the answer, and returns findings JSON only — never a rewrite.
 */
export function compileReviewerPrompt(input: unknown, outputJson: string): CompiledPrompt | CompileFailure {
  const { brief, findings } = validateBrief(input)
  if (!brief) return { findings }
  const choice = blueprintFor(brief.contentType)
  const sections = sectionsFor(choice)
  const source = brief.source ? sourceFromHtml(brief.source.html, brief.source.title) : null
  const sectionIds = sections.map(s => s.id)
  const promptVersion = `reviewer@${REVIEWER_VERSION}/${promptVersionFor(choice.blueprint)}`
  const promptId = sha16(canonicalJson({ promptVersion, brief, sectionIds, output: sha16(outputJson) }))
  const questionCount = choice.blueprint.output === 'questionSet' ? brief.questionCount ?? QUESTION_COUNT_DEFAULT : undefined

  const context = [
    `Content type: ${brief.contentType} (blueprint ${choice.blueprint.id})`,
    `Topic: ${brief.topic}`,
    `Difficulty: ${brief.difficulty ?? 'intermediate'}`,
    `Required sections: ${sectionIds.length ? sectionIds.join(', ') : '(none: a question set or an explainer)'}`,
  ].join('\n')

  const text = assemble([
    ['ROLE', REVIEWER_RULES],
    ['BODY-NAME RULE', BODY_NAME_RULE],
    ['CONTEXT', context],
    ['SOURCE NOTE', sourceBlock(source)],
    ['CONTENT TO REVIEW', outputJson],
    ['OUTPUT', 'Return ONLY the findings JSON object described in OUTPUT INSTRUCTIONS. No markdown fences, no text before or after it.'],
  ])

  return {
    promptId,
    promptVersion,
    blueprintId: choice.blueprint.id,
    ...(choice.preset ? { preset: choice.preset.contentType } : {}),
    brief,
    source,
    text,
    expected: { sectionIds, ...(questionCount !== undefined ? { questionCount } : {}) },
  }
}
