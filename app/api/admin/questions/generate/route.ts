/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })


// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(cfg: {
  qualification: string
  subject:       string
  topic:         string
  questionType:  string   // 'mcq' | 'scenario' | 'writing' | 'mixed'
  difficulty:    string   // 'beginner' | 'intermediate' | 'advanced'
  count:         number
  framework:     string   // 'IFRS' | 'UK GAAP' | 'US GAAP' | 'None'
  examBody:      string   // 'acca' | 'cima' | 'icaew' | 'aat' | 'none'
  rounding:      string
  noiseLevel:    string   // 'low' | 'medium' | 'high'
}): string {

  const diffGuide: Record<string, string> = {
    beginner:     'Foundational level. Test recall and basic application. Clear stems, no multi-step traps.',
    intermediate: 'Professional level. Multi-step reasoning, professional judgement, realistic data.',
    advanced:     'Examination peak difficulty. Complex scenarios, multiple interacting concepts, deliberate noise.',
  }

  const noiseGuide: Record<string, string> = {
    low:    'Stems are clean and focused. One or zero irrelevant details.',
    medium: 'Add one plausible-looking but irrelevant detail that tests judgement.',
    high:   'Add two irrelevant or conflicting details. Require careful filtering to identify what matters.',
  }

  const frameworkLine = cfg.framework && cfg.framework !== 'None'
    ? `Use ONLY ${cfg.framework} terminology throughout. Do not mix frameworks.`
    : 'Framework-neutral unless the topic inherently requires a specific standard.'

  const isMCQ      = cfg.questionType === 'mcq' || cfg.questionType === 'mixed'
  const isScenario = cfg.questionType === 'scenario'
  const isWriting  = cfg.questionType === 'writing'

  const scenarioCaseBlock = isScenario ? `
SCENARIO QUESTION RULES (MANDATORY):
- Group every ${Math.min(4, cfg.count)} questions around a shared case exhibit
- Each case exhibit is a realistic invented business scenario (company name, figures, narrative)
- Case exhibits: 150-300 words, with a clear exhibit header
- Each question references the case via caseId
- Question stems start with: "Based on the information provided, ..."
- NEVER repeat full case text in the question stem — the stem is a focused question only
- Each case must have a unique caseId (e.g. "case-1", "case-2")
- The cases[] array in the JSON must contain ALL case objects used
` : ''

  const writingBlock = isWriting ? `
WRITING QUESTION RULES (MANDATORY):
- Each question is a short constructed-response item
- writingModelAnswer: a complete model answer (150-300 words), structured, going straight into the answer
- writingExplanation: teaching notes explaining the approach (80-150 words)
- No options, no correctIndex — these are null/omitted for writing questions
- type must be "writing"
` : ''

  const mcqExplanationRules = (isMCQ || isScenario) ? `
MCQ EXPLANATION FORMAT (MANDATORY — follow exactly):
For CALCULATION questions use these exact headings (plain text, no backticks, no code blocks):
  OVERVIEW:
  [brief context — what this question is testing]

  DATA (INPUTS & ASSUMPTIONS):
  [list the key figures and what they represent]

  METHOD:
  [the approach step by step]

  SOLUTION (STEP-BY-STEP):
  Step 1: [label] = [figure] × [rate] = [result]
  Step 2: [label] = [figure] + [figure] = [result]
  [etc.]

  KEY TAKEAWAY:
  [one sentence the student must remember]

For THEORY/CONCEPT questions use these exact headings:
  OVERVIEW:
  [what this question is testing and why it matters]

  APPLY TO THIS CASE:
  [why the correct option is right for this specific question]

  KEY TAKEAWAY:
  [one sentence the student must remember]

CRITICAL: Never use backticks or code blocks anywhere in explanations or calculations.
` : ''

  const jsonShape = isWriting ? `
{
  "title": "<descriptive title for this question set>",
  "slug": "<url-friendly slug>",
  "excerpt": "<1-2 sentence description of what this set covers — no body names>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "writing",
  "topic": "${cfg.topic}",
  "tags": ["<topic tag>", "<another tag>"],
  "cases": [],
  "questions": [
    {
      "id": "q1",
      "type": "writing",
      "questionText": "<the scenario and requirement>",
      "options": [],
      "correctIndex": null,
      "explanation": null,
      "writingModelAnswer": "<complete model answer — straight into the answer, no restated title>",
      "writingExplanation": "<teaching notes on how to approach this>",
      "caseId": null,
      "primaryTopic": "<specific topic this tests>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 15,
      "points": 5
    }
  ]
}
` : isScenario ? `
{
  "title": "<descriptive title for this scenario set>",
  "slug": "<url-friendly slug>",
  "excerpt": "<1-2 sentence description — no body names>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "scenario",
  "topic": "${cfg.topic}",
  "tags": ["<topic>", "<another>"],
  "cases": [
    {
      "caseId": "case-1",
      "title": "<Case Title>",
      "exhibitHtml": "<HTML string of the case exhibit — use <p>, <ul>, <li>, <strong>, <table> as needed>"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "questionText": "Based on the information provided, ...",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correctIndex": 2,
      "explanation": "<OVERVIEW:\\n...\\n\\nAPPLY TO THIS CASE:\\n...\\n\\nKEY TAKEAWAY:\\n...>",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": "case-1",
      "primaryTopic": "<specific sub-topic>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 3,
      "points": 1
    }
  ]
}
` : `
{
  "title": "<descriptive title for this question set>",
  "slug": "<url-friendly slug>",
  "excerpt": "<1-2 sentence description — no body names>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "multiple-choice",
  "topic": "${cfg.topic}",
  "tags": ["<topic>", "<another>"],
  "cases": [],
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "questionText": "<3-5 sentence stem — realistic, professional, specific figures>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correctIndex": 2,
      "explanation": "<OVERVIEW:\\n...\\n\\nAPPLY TO THIS CASE:\\n...\\n\\nKEY TAKEAWAY:\\n...>",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": null,
      "primaryTopic": "<specific sub-topic this question tests>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 3,
      "points": 1
    }
  ]
}
`

  return `You are a senior professional accounting examination question writer producing content for a world-class accounting education platform. Your output is benchmarked against the highest professional examination standards. Every question must be technically accurate, professionally credible, and educationally excellent.

INTERNAL CONTEXT (calibrate content — NEVER reference in output):
- Qualification level: ${cfg.qualification} standard
- Subject area: ${cfg.subject || cfg.topic}
- Exam body internal tag: ${cfg.examBody}

CONTENT SPECIFICATION:
- Topic: ${cfg.topic}
- Question type: ${cfg.questionType}
- Difficulty: ${cfg.difficulty} — ${diffGuide[cfg.difficulty] ?? diffGuide.intermediate}
- Number of questions: ${cfg.count}
- Noise level: ${cfg.noiseLevel} — ${noiseGuide[cfg.noiseLevel] ?? noiseGuide.medium}
- Rounding rule: ${cfg.rounding}
- Framework: ${frameworkLine}

CRITICAL RULES — NON-NEGOTIABLE:
1. NEVER mention any professional body name (ACCA, CIMA, ICAEW, AAT, CPA, CIPFA, or any other) anywhere in the output — not in titles, stems, options, explanations, or tags
2. NEVER reproduce or closely paraphrase past examination questions
3. ALL worked examples must use invented company names (e.g. "Hartwell Engineering Ltd", "Meridian Retail Group") and specific non-round figures (e.g. £42,847 not £40,000)
4. NEVER use backticks, code blocks, or markdown code formatting — not for journal entries, not for calculations, not anywhere
5. Journal entries as plain Dr/Cr text with "Being:" narrative
6. Calculations as numbered plain-text steps
7. Each question must test a distinct aspect of the topic — no two questions should test the same concept
8. Options must be plausible — distractors must represent common errors or misconceptions, not obviously wrong answers
9. For numeric questions, all four options must be within a realistic range — not one correct answer and three wildly wrong ones
10. The correct option must be unambiguously correct — no contested positions without acknowledgement

${scenarioCaseBlock}${writingBlock}${mcqExplanationRules}

QUESTION QUALITY STANDARDS:
- Every stem must be 2-5 sentences — no single-sentence stems except for simple recall questions at beginner level
- Professional tone throughout — as if written for a Big Four training programme
- Each question must stand alone as a genuine test of understanding, not a trick or wordplay question
- The explanation must genuinely teach — a student who reads it must understand WHY the answer is correct
- Primary topic must be a specific sub-topic, not the broad topic title

RETURN: Valid JSON only. No preamble. No markdown fences. No trailing commas. No comments.
Shape:
${jsonShape}

Generate exactly ${cfg.count} questions. Every field in the shape above must be present in every question object.`
}

// ── Validator ─────────────────────────────────────────────────────────────────
function validateBundle(bundle: any, expectedCount: number): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!bundle || typeof bundle !== 'object') { return { ok: false, errors: ['Bundle is not an object'] } }
  if (!bundle.title)    errors.push('Missing title')
  if (!bundle.excerpt)  errors.push('Missing excerpt')
  if (!Array.isArray(bundle.questions) || bundle.questions.length === 0) {
    errors.push('No questions array')
    return { ok: false, errors }
  }
  if (bundle.questions.length < expectedCount) {
    errors.push(`Expected ${expectedCount} questions, got ${bundle.questions.length}`)
  }
  bundle.questions.forEach((q: any, i: number) => {
    const p = `Q${i + 1}`
    if (!q.id)           errors.push(`${p}: missing id`)
    if (!q.type)         errors.push(`${p}: missing type`)
    if (!q.questionText) errors.push(`${p}: missing questionText`)
    if (q.type === 'multiple-choice') {
      if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${p}: must have exactly 4 options`)
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) errors.push(`${p}: invalid correctIndex`)
      if (!q.explanation) errors.push(`${p}: missing explanation`)
    }
    if (q.type === 'writing') {
      if (!q.writingModelAnswer) errors.push(`${p}: missing writingModelAnswer`)
    }
  })
  return { ok: errors.length === 0, errors }
}

// ── Coerce bundle to safe defaults ───────────────────────────────────────────
function coerceBundle(bundle: any, cfg: any): any {
  if (!bundle.slug) bundle.slug = (bundle.title ?? 'question-set').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
  if (!bundle.cases) bundle.cases = []
  if (!bundle.tags)  bundle.tags  = [cfg.topic]
  bundle.questions = (bundle.questions ?? []).map((q: any, i: number) => {
    q.id            = q.id ?? `q${i + 1}`
    q.type          = q.type ?? 'multiple-choice'
    q.points        = q.points ?? 1
    q.timeTargetMinutes = q.timeTargetMinutes ?? (q.type === 'writing' ? 15 : 3)
    q.primaryTopic  = q.primaryTopic ?? cfg.topic
    q.difficulty    = q.difficulty ?? cfg.difficulty
    if (q.type === 'multiple-choice') {
      if (!Array.isArray(q.options)) q.options = ['Option A', 'Option B', 'Option C', 'Option D']
      if (typeof q.correctIndex !== 'number') q.correctIndex = 0
      // Deduplicate options
      const seen = new Set<string>()
      q.options = q.options.map((o: string, oi: number) => {
        const s = String(o).trim()
        if (seen.has(s.toLowerCase())) return `${s} (${oi + 1})`
        seen.add(s.toLowerCase())
        return s
      })
    }
    return q
  })
  return bundle
}

// ── API Route ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      qualification = 'ACCA',
      subject       = '',
      topic,
      questionType  = 'mcq',
      difficulty    = 'intermediate',
      count         = 10,
      framework     = 'None',
      examBody      = 'none',
      rounding      = 'nearest whole number',
      noiseLevel    = 'medium',
    } = body

    if (!topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }
    if (count > 40) {
      return NextResponse.json({ error: 'Maximum 40 questions per batch' }, { status: 400 })
    }

    const cfg = { qualification, subject, topic, questionType, difficulty, count: Number(count), framework, examBody, rounding, noiseLevel }
    const prompt = buildPrompt(cfg)

    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system:     'You are a senior professional accounting examination question writer. You return VALID JSON only — no markdown, no fences, no preamble. You never mention any professional accounting body name in output. You never use backticks or code blocks. Every question you write is technically accurate and educationally excellent.',
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')

    let bundle: any
    try {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const s = cleaned.indexOf('{')
      const e = cleaned.lastIndexOf('}')
      bundle = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned)
    } catch {
      return NextResponse.json({ error: 'Claude returned invalid JSON. Please try again.' }, { status: 500 })
    }

    bundle = coerceBundle(bundle, cfg)
    const { ok, errors } = validateBundle(bundle, Number(count))

    return NextResponse.json({
      bundle,
      valid:  ok,
      errors: ok ? [] : errors,
      meta:   { qualification, subject, topic, questionType, difficulty, count, framework, examBody },
    })

  } catch (err: any) {
    console.error('questions/generate error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
