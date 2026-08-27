/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ═══════════════════════════════════════════════════════════════════════════════
// TIER MAP
// ═══════════════════════════════════════════════════════════════════════════════
const TIER_MAP: Record<string, Record<string, string>> = {
  ACCA: {
    beginner:     'Applied Knowledge (BT / MA / FA)',
    intermediate: 'Applied Skills (PM / TX / FR / AA / FM / LW)',
    advanced:     'Strategic Professional (SBL / SBR / AFM / APM / ATX / AAA)',
  },
  CIMA: {
    beginner:     'Operational Level',
    intermediate: 'Management Level',
    advanced:     'Strategic Level',
  },
  ICAEW: {
    beginner:     'Certificate Level',
    intermediate: 'Professional Level',
    advanced:     'Advanced Level',
  },
  AAT: {
    beginner:     'Level 2 Foundation',
    intermediate: 'Level 3 Advanced',
    advanced:     'Level 4 Professional',
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUALIFICATION PROFILES
// ═══════════════════════════════════════════════════════════════════════════════
const QUALIFICATION_PROFILES: Record<string, string> = {
  ACCA: `
QUALIFICATION PROFILE — ACCA STANDARD (internal calibration only):

EXAM STRUCTURE AWARENESS:
- Applied Knowledge papers (BT/MA/FA): 100% objective test, 2-hour CBE, 2-mark questions
- Applied Skills papers (PM/TX/FR/AA/FM/LW): Section A = 60% OT (MCQ + OT cases), Section B = 40% constructed response, 3-hour CBE
- Strategic Professional (SBL/SBR/AFM/APM/ATX/AAA): Long-form scenario, 50% Section A case study, 3.5 hours
- OT case questions: 5 linked questions per case exhibit, 2 marks each = 10 marks per case

MCQ CONSTRUCTION STANDARDS:
- Stem: 3-6 sentences presenting a realistic business scenario with specific invented figures
- Options: 4 options (A-D), each 1-2 lines, all plausible — distractors represent the 3 most common student errors
- Numeric distractors: use common calculation mistakes — wrong depreciation method, omitted accrual, incorrect tax treatment, transposition error
- Theory distractors: use superficially similar but incorrect concepts — recognise vs measure, allocate vs apportion, audit vs assurance
- Time target: 2.4 minutes per 2-mark question

TIER-SPECIFIC CALIBRATION:
Applied Knowledge tier: Single-issue questions. One concept per question. Clean data, no noise. Command verbs: Identify, State, Define, Outline, List.
Applied Skills tier: Multi-step calculations. Two to three linked reasoning steps. Realistic business scenarios. Command verbs: Calculate, Prepare, Explain, Distinguish, Apply, Discuss.
Strategic Professional tier: Complex multi-issue scenarios. Professional judgement required. Command verbs: Evaluate, Assess, Advise, Recommend, Critically analyse, Justify.

TECHNICAL ACCURACY STANDARDS FOR ACCA:
- Financial Reporting: IFRS standards referenced by number (IFRS 15, IAS 36, IFRS 16, IAS 37, IFRS 9, IAS 38)
- Audit: ISAs referenced (ISA 315, ISA 330, ISA 700, ISA 560, ISA 570)
- Tax: jurisdiction-specific — caveat all rates as illustrative; use realistic UK-style rates unless otherwise specified
- Performance Management: use realistic figures — contribution margins 20-45%, variances within ±15% of standard
- Financial Management: discount factors calculated correctly, NPV/IRR/Payback all accurate
`,
  CIMA: `
QUALIFICATION PROFILE — CIMA STANDARD (internal calibration only):

EXAM STRUCTURE AWARENESS:
- Objective Test (OT) exams: 60-90 minutes, mix of OT question types
- Case Study exams (Operational/Management/Strategic): pre-seen material, 3-hour exam, integrated tasks

MCQ CONSTRUCTION STANDARDS:
- Management accounting focus: cost analysis, budgeting, variance analysis, performance measurement, risk
- Stems: professional management context — "The finance director has asked you to..."
- Calculation accuracy: marginal costing, absorption costing, activity-based costing, budgetary control

TIER-SPECIFIC CALIBRATION:
Operational Level: Procedural knowledge and basic application. Command verbs: Calculate, Prepare, Identify, Explain, Classify.
Management Level: Analysis and evaluation. Command verbs: Analyse, Evaluate, Recommend, Assess, Apply, Advise.
Strategic Level: Integration and board-level judgement. Command verbs: Evaluate, Recommend, Justify, Critically assess, Propose, Advise the board.
`,
  ICAEW: `
QUALIFICATION PROFILE — ICAEW/ACA STANDARD (internal calibration only):

TIER-SPECIFIC CALIBRATION:
Certificate Level: Knowledge and basic application. Command verbs: Explain, Outline, Describe, Calculate (single step), Identify.
Professional Level: Technical competence and emerging judgement. Command verbs: Analyse, Assess, Evaluate, Advise, Recommend, Prepare, Calculate.
Advanced Level: Full professional judgement. Open-book, complex multi-issue scenarios. Command verbs: Evaluate, Advise, Recommend with full justification, Critically assess.
`,
  AAT: `
QUALIFICATION PROFILE — AAT STANDARD (internal calibration only):

TIER-SPECIFIC CALIBRATION:
Level 2 Foundation: Procedural competency. Debit/credit mechanics, basic VAT, simple payroll. Command verbs: Identify, Enter, Calculate (single step), State, Complete.
Level 3 Advanced: Application and analysis. Trial balance, depreciation, inventory valuation, basic management accounting. Command verbs: Calculate, Prepare, Identify errors, Explain, Apply.
Level 4 Professional: Professional judgement. Limited company accounts, standard costing, complex tax, working capital management. Command verbs: Prepare, Evaluate, Calculate and comment, Advise, Analyse.
`,
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT TECHNICAL CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════
const SUBJECT_TECHNICAL_CONTEXT: Record<string, string> = {
  'Financial Reporting': `
FINANCIAL REPORTING — TECHNICAL STANDARDS:
IFRS 15 (Revenue — five-step model), IFRS 16 (Leases — ROU asset and lease liability), IFRS 9 (Financial instruments — ECL model three stages), IFRS 3 (Business combinations — goodwill), IFRS 10 (Control definition), IFRS 13 (Fair value — three-level hierarchy).
IAS 36 (Impairment — CGU methodology; value in use vs FVLCTS), IAS 37 (Provisions — obligating event + probable + reliable estimate), IAS 38 (Intangibles — research expense vs development capitalise), IAS 19 (Defined benefit — actuarial gains/losses in OCI NEVER P&L), IAS 12 (Deferred tax — temporary differences, NOT timing differences).
COMMON CONFUSIONS: IAS 36 students test individual assets not CGUs. IFRS 16 students put entire lease payment in P&L. IAS 19 students put actuarial gains/losses in P&L.
`,
  'Financial Accounting': `
FINANCIAL ACCOUNTING — TECHNICAL STANDARDS:
Assets/expenses: increase with DEBIT. Liabilities/equity/income: increase with CREDIT.
Accruals basis: match income/expenses to period. Prepayments = asset. Accruals = liability.
Depreciation: SL = (Cost - Residual) / Life. RB = Carrying amount × Rate%.
Inventory: FIFO or weighted average. NRV = lower of cost and net realisable value.
COMMON CONFUSIONS: Allowance for doubtful debts — only the CHANGE hits P&L. RB depreciation — apply rate to carrying amount not cost in year 2+.
`,
  'Management Accounting': `
MANAGEMENT ACCOUNTING — TECHNICAL STANDARDS:
High-low method: Variable cost per unit = (Highest cost - Lowest cost) / (Highest activity - Lowest activity).
Contribution = Selling price - Variable cost. Breakeven (units) = Fixed costs / Contribution per unit.
Absorption vs Marginal: Absorption profit - Marginal profit = Change in inventory × Fixed OAR.
ALL VARIANCES: Material price = (Std price - Actual price) × Actual qty purchased. Material usage = (Std qty for actual prod - Actual qty) × Std price. Labour rate = (Std rate - Actual rate) × Actual hours. Labour efficiency = (Std hours for actual prod - Actual hours) × Std rate.
COMMON CONFUSIONS: Material price variance — applied to qty PURCHASED not used. OAR — use BUDGETED figures only.
`,
  'Audit and Assurance': `
AUDIT AND ASSURANCE — TECHNICAL STANDARDS:
Audit risk = Inherent risk × Control risk × Detection risk. Auditor controls detection risk only.
ISA 315 (Risk assessment), ISA 330 (Responses to risk), ISA 570 (Going concern), ISA 700 (Forming opinion), ISA 705 (Modifications — qualified=material not pervasive; adverse=material and pervasive; disclaimer=unable to obtain sufficient appropriate evidence).
Assertions for balances: existence, completeness, rights and obligations, accuracy/valuation.
Direction: completeness = trace outward from records. Existence = trace inward from statements.
COMMON CONFUSIONS: Students give vague procedures — always state what document, what assertion, what auditor looks for. ISA 705: qualified = material but NOT pervasive.
`,
  'Taxation': `
TAXATION — TECHNICAL STANDARDS:
CRITICAL CAVEAT: Every rate, threshold, allowance cited must carry explicit note that it is illustrative — verify against current HMRC guidance. State tax year assumed.
Income tax structure: personal allowance → basic rate → higher rate → additional rate. NIC is NOT income tax — separate calculation.
Corporation tax: main rate / small profits rate / marginal relief. Associated companies affect thresholds.
VAT: exempt (no input tax recovery) vs zero-rated (input tax IS recoverable) — students confuse these.
Capital gains: annual exempt amount, BADR (illustrative 10% up to lifetime limit).
`,
  'Financial Management': `
FINANCIAL MANAGEMENT — TECHNICAL STANDARDS:
NPV: positive = accept. IRR by interpolation: L + [NPV_L / (NPV_L - NPV_H)] × (H - L).
WACC: use MARKET VALUES not book values. Ke via CAPM = Rf + β(Rm - Rf) or dividend growth model.
Beta ungearing: βa = βe × [Ve/(Ve + Vd(1-t))]. Regearing: βe = βa × [Ve + Vd(1-t)] / Ve.
Real vs nominal: (1 + nominal) = (1 + real) × (1 + inflation). NEVER mix real cash flows with nominal rate.
COMMON CONFUSIONS: WACC — students use book values. IRR interpolation — use closest rates either side of zero NPV.
`,
  'Performance Management': `
PERFORMANCE MANAGEMENT — TECHNICAL STANDARDS:
Planning vs operational variances. Mix and yield variances for multi-input processes.
ABC: identify activities → cost pools → cost drivers → driver rates → assign to products.
Balanced scorecard: Financial, Customer, Internal Process, Learning & Growth — cause-and-effect linkages matter.
ROI vs RI: ROI leads to rejecting positive NPV projects (dysfunctional). RI avoids this — use for new investment decisions.
EVA = NOPAT - (WACC × Capital invested). Adjustments: capitalise R&D, operating leases, add back goodwill amortisation.
Transfer pricing: TP = Marginal cost + Opportunity cost. At full capacity: add contribution forgone per unit.
`,
  'default': `
TECHNICAL ACCURACY — GENERAL STANDARDS:
All calculations must be verified. All accounting entries must balance (debits = credits).
All references to rates or thresholds must be caveated as illustrative and subject to change.
All invented figures must be specific and non-round. All invented company names must be realistic.
Explanations must teach — not just state the correct answer.
`,
  'ETICPA / CPA': `
ETICPA CPA PROFILE: All scenarios use Ethiopian Birr (ETB). Reference Ethiopian companies, ERCA, AABE, Ethiopian Commercial Code.
Financial reporting: IFRS by number for public interest entities. Taxation: ERCA, Schedule A (employment), Schedule C (business), VAT Proclamation, withholding tax — caveat all rates.
Audit: ISAs by number. Ethics: IFAC/IESBA framework. Never mention ETiCPA or ETICPA in question text — use "professional accounting examination".
`,
  'ETICPA / ATQ': `
ETICPA ATQ PROFILE: Level 1 Foundation or Level 2 Advanced. All scenarios use Ethiopian Birr. Ethiopian Commercial Code for law questions.
Level 1: Double entry, basic cost accounting, Ethiopian business law basics. Level 2: Full financial statements under IFRS for SMEs, management accounting, Ethiopian taxation (ERCA schedules), public sector accounting.
Never mention ETiCPA or ETICPA in question text — use "accounting technician level".
`,
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRACTOR LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════
const DISTRACTOR_LIBRARY = `
DISTRACTOR ENGINEERING — MANDATORY FOR ALL MCQ:
Every incorrect option must represent a REAL, SPECIFIC ERROR students commonly make.
Never use obviously wrong distractors. Never use "None of the above" or "All of the above".
Common error types: SIGN ERROR, PERIOD ERROR, OMISSION ERROR, INCLUSION ERROR, RATE/BASE ERROR, METHOD CONFUSION, DIRECTION ERROR, ARITHMETIC ERROR, CONCEPT CONFUSION, STANDARD CONFUSION.
For numeric questions: all four options must represent plausible calculation outcomes. Distractors should correspond to specific identifiable errors.
State in the explanation exactly WHY each distractor is wrong (which error it represents).
`

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLANATION STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════
const EXPLANATION_STANDARDS = `
EXPLANATION QUALITY STANDARDS — NON-NEGOTIABLE:
Every explanation must be a genuine TEACHING RESOURCE.

FOR CALCULATION QUESTIONS:
OVERVIEW: [What concept this tests and why it matters]
DATA: [Every figure used and what it represents]
METHOD: [The calculation approach and why correct]
SOLUTION (STEP-BY-STEP): Step 1: [label] = [calc] = [result] ... (never skip steps)
WHY OTHERS WRONG: Option A: [specific error]. Option B: [specific error]. Option D: [specific error]. (skip correct option)
KEY TAKEAWAY: [One memorable sentence to prevent this mistake in future]

FOR THEORY/CONCEPT QUESTIONS:
OVERVIEW: [What professional knowledge this tests]
WHY CORRECT: [Detailed explanation with reference to relevant standard or principle]
WHY OTHERS WRONG: Option A: [misconception]. Option B: [misconception]. Option D: [misconception].
PROFESSIONAL CONTEXT: [Where practitioner encounters this in real work]
KEY TAKEAWAY: [One specific memorable sentence]

CRITICAL: Never use backticks or code blocks. Journal entries: plain Dr/Cr text. British English throughout.
`

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO ENGINEERING
// ═══════════════════════════════════════════════════════════════════════════════
const SCENARIO_ENGINEERING = `
SCENARIO CASE CONSTRUCTION STANDARDS:
Exhibit structure: Company background, financial context, specific situation, supporting data (specific non-round figures), intentional complexity (one irrelevant item that tests judgement).
Exhibit length: Beginner 100-150 words. Intermediate 200-300 words. Advanced 350-500 words.
Exhibit format: HTML using <p>, <table>, <thead>, <tbody>, <strong>, <ul>, <li>.
Linked questions: each tests a distinct aspect. Mix calculation and judgement. Final question typically requires evaluation or recommendation.
`

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN BUDGETS — per-batch sizing
// Max 10 questions per batch to prevent truncation.
// Author budget: count × base × multiplier, capped at 12000 per batch.
// ═══════════════════════════════════════════════════════════════════════════════
function calcBatchTokenBudgets(count: number, questionType: string, difficulty: string): { author: number; auditor: number } {
  const basePerType: Record<string, number> = {
    mcq:      500,
    scenario: 800,
    writing:  600,
    mixed:    550,
  }
  const difficultyMultiplier: Record<string, number> = {
    beginner:     1.0,
    intermediate: 1.3,
    advanced:     1.6,
  }
  const base = basePerType[questionType] ?? 500
  const mult = difficultyMultiplier[difficulty] ?? 1.3
  // Cap at 12000 per batch (10 questions max per batch keeps this safe)
  const author  = Math.min(12000, Math.max(3000, Math.ceil(count * base * mult)))
  const auditor = count <= 5 ? 5000 : count <= 10 ? 8000 : 12000
  return { author, auditor }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON EXTRACTION — robust multi-strategy parser
// Strategy 1: strip fences, direct parse
// Strategy 2: extract outermost {...}
// Strategy 3: find first { and last } with brace counting
// Throws only if all three fail.
// ═══════════════════════════════════════════════════════════════════════════════
function extractJSON(raw: string): any {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  // Strategy 1: direct parse after stripping fences
  try { return JSON.parse(stripped) } catch { /* continue */ }

  // Strategy 2: slice from first { to last }
  const s = stripped.indexOf('{')
  const e = stripped.lastIndexOf('}')
  if (s >= 0 && e > s) {
    try { return JSON.parse(stripped.slice(s, e + 1)) } catch { /* continue */ }
  }

  // Strategy 3: brace-count to find the outermost complete object
  let depth = 0
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try { return JSON.parse(stripped.slice(start, i + 1)) } catch { /* continue */ }
      }
    }
  }

  throw new Error('No valid JSON object found in response')
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHOR PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildAuthorPrompt(cfg: {
  qualification: string; subject: string; topic: string
  questionType: string; difficulty: string; count: number
  framework: string; examBody: string; rounding: string; noiseLevel: string
  batchIndex: number; totalBatches: number; startId: number
}): string {

  const qualProfile  = QUALIFICATION_PROFILES[cfg.qualification] ?? QUALIFICATION_PROFILES.ACCA
  const subjectCtx   = SUBJECT_TECHNICAL_CONTEXT[cfg.subject] ?? SUBJECT_TECHNICAL_CONTEXT['default']
  const resolvedTier = TIER_MAP[cfg.qualification]?.[cfg.difficulty] ?? cfg.difficulty
  const isMCQ        = cfg.questionType === 'mcq' || cfg.questionType === 'mixed'
  const isScenario   = cfg.questionType === 'scenario'
  const isWriting    = cfg.questionType === 'writing'

  const difficultySpec: Record<string, string> = {
    beginner:     `BEGINNER/FOUNDATION LEVEL: Test knowledge and basic application. One concept per question. No multi-step reasoning. Command verbs: Identify, State, Define, Calculate (single step), Outline.`,
    intermediate: `INTERMEDIATE/SKILLS LEVEL: Multi-step calculations. Requires distinguishing between similar concepts. Realistic business scenarios with specific data. 2-3 linked reasoning steps. Command verbs: Calculate, Prepare, Explain, Distinguish, Apply, Discuss.`,
    advanced:     `ADVANCED/STRATEGIC LEVEL: Complex multi-issue scenarios. Deliberate ambiguity requiring professional judgement. No single obviously correct answer — correct option is the MOST appropriate professional response. Command verbs: Evaluate, Assess, Advise, Recommend, Critically analyse, Justify.`,
  }

  const noiseSpec: Record<string, string> = {
    low:    `NOISE LEVEL LOW: Every piece of information in the stem is needed. No irrelevant details.`,
    medium: `NOISE LEVEL MEDIUM: Include one plausible-looking but irrelevant detail in each stem.`,
    high:   `NOISE LEVEL HIGH: Include two irrelevant or conflicting details. One red herring, one unneeded figure.`,
  }

  const frameworkSpec = cfg.framework && cfg.framework !== 'None'
    ? `FRAMEWORK: Use ONLY ${cfg.framework} throughout. Do not mix frameworks.`
    : `FRAMEWORK: Use IFRS as primary framework for financial reporting topics unless subject requires otherwise. State framework applied where it materially affects the answer.`

  const casesNeeded  = Math.ceil(cfg.count / 4)
  const baseQPerCase = Math.floor(cfg.count / casesNeeded)
  const remainder    = cfg.count - baseQPerCase * (casesNeeded - 1)

  const scenarioBlock = isScenario ? `
${SCENARIO_ENGINEERING}

CASE GROUPING FOR THIS BATCH:
- Generate ${casesNeeded} distinct case exhibits
- Cases 1 to ${casesNeeded - 1}: each has exactly ${baseQPerCase} linked questions
- Case ${casesNeeded} (final case): has exactly ${remainder} linked questions
- Total = ${cfg.count} questions across ${casesNeeded} cases
- exhibitHtml must be valid HTML
` : ''

  const writingBlock = isWriting ? `
WRITING QUESTION STANDARDS:
- Each question: realistic professional scenario (150-250 words) with clear requirement using command verb
- writingModelAnswer: 200-400 words, structured, starts directly with answer, uses headings
- writingExplanation: 100-150 words of teaching notes: approach, marking priorities, common errors
` : ''

  const correctIndexDist = (isMCQ || isScenario) ? `
CORRECT ANSWER POSITION DISTRIBUTION — MANDATORY:
Distribute correctIndex evenly across 0, 1, 2, 3 within this batch of ${cfg.count} questions.
Do NOT cluster correct answers at any single position.
Deliberately vary the position of the correct answer for every question.
` : ''

  const batchNote = cfg.totalBatches > 1
    ? `BATCH NOTE: This is batch ${cfg.batchIndex + 1} of ${cfg.totalBatches}. Question IDs start at q${cfg.startId}. Generate exactly ${cfg.count} questions with IDs q${cfg.startId} through q${cfg.startId + cfg.count - 1}. Topic coverage must be distinct from other batches — cover a different sub-set of sub-topics.`
    : ''

  const jsonShape = isWriting ? `{
  "title": "<Professional descriptive title>",
  "slug": "<url-friendly-slug-max-80-chars>",
  "excerpt": "<2-3 sentence description. No body names.>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "writing",
  "topic": "${cfg.topic}",
  "tags": ["<sub-topic>", "<standard or concept>", "<skill tested>"],
  "cases": [],
  "questions": [
    {
      "id": "q${cfg.startId}",
      "type": "writing",
      "questionText": "<Full scenario 150-250 words ending with clear requirement using command verb>",
      "options": [],
      "correctIndex": null,
      "explanation": null,
      "writingModelAnswer": "<Complete model answer 200-400 words — headed paragraphs, professional language>",
      "writingExplanation": "<Teaching notes 100-150 words: approach, marking priorities, common errors>",
      "caseId": null,
      "primaryTopic": "<Specific sub-topic tested>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 20,
      "points": 10
    }
  ]
}` : isScenario ? `{
  "title": "<Professional descriptive title for this scenario set>",
  "slug": "<url-friendly-slug>",
  "excerpt": "<2-3 sentences. No body names.>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "scenario",
  "topic": "${cfg.topic}",
  "tags": ["<primary topic>", "<standard>", "<skill>"],
  "cases": [
    {
      "caseId": "case-${cfg.batchIndex + 1}-1",
      "title": "<Descriptive case title>",
      "exhibitHtml": "<Full HTML exhibit>"
    }
  ],
  "questions": [
    {
      "id": "q${cfg.startId}",
      "type": "multiple-choice",
      "questionText": "<Question referencing the case exhibit>",
      "options": ["<option>", "<option>", "<option>", "<option>"],
      "correctIndex": 0,
      "explanation": "<Full structured explanation>",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": "case-${cfg.batchIndex + 1}-1",
      "primaryTopic": "<Specific sub-topic>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 3,
      "points": 2
    }
  ]
}` : `{
  "title": "<Professional descriptive title>",
  "slug": "<url-friendly-slug-max-80-chars>",
  "excerpt": "<2-3 sentences. No body names.>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "multiple-choice",
  "topic": "${cfg.topic}",
  "tags": ["<primary topic>", "<standard>", "<skill tested>"],
  "cases": [],
  "questions": [
    {
      "id": "q${cfg.startId}",
      "type": "multiple-choice",
      "questionText": "<3-6 sentence stem: company name, specific figures, realistic scenario, clear question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctIndex": 1,
      "explanation": "<Full structured explanation — OVERVIEW / DATA / METHOD / SOLUTION / WHY OTHERS WRONG / KEY TAKEAWAY>",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": null,
      "primaryTopic": "<Specific sub-topic>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 2,
      "points": 2
    }
  ]
}`

  return `You are a Principal Examiner for a world-class professional accounting education platform.
Your questions must be TECHNICALLY ACCURATE, PROFESSIONALLY CREDIBLE, EDUCATIONALLY EXCELLENT, and ORIGINAL.

═══════════════════════════════════════════════════════
PART 1 — QUALIFICATION PROFILE
═══════════════════════════════════════════════════════
${qualProfile}

═══════════════════════════════════════════════════════
PART 2 — TIER AND DIFFICULTY
═══════════════════════════════════════════════════════
QUALIFICATION: ${cfg.qualification}
EXAM TIER: ${resolvedTier}
DIFFICULTY: ${difficultySpec[cfg.difficulty] ?? difficultySpec.intermediate}

═══════════════════════════════════════════════════════
PART 3 — SUBJECT TECHNICAL REQUIREMENTS
═══════════════════════════════════════════════════════
SUBJECT: ${cfg.subject || cfg.topic}
${subjectCtx}

═══════════════════════════════════════════════════════
PART 4 — CONTENT SPECIFICATION
═══════════════════════════════════════════════════════
TOPIC: ${cfg.topic}
QUESTION TYPE: ${cfg.questionType.toUpperCase()}
COUNT: ${cfg.count} questions
${frameworkSpec}
ROUNDING: ${cfg.rounding}
${noiseSpec[cfg.noiseLevel] ?? noiseSpec.medium}
${batchNote}

═══════════════════════════════════════════════════════
PART 5 — CONSTRUCTION RULES
═══════════════════════════════════════════════════════
${isMCQ || isScenario ? DISTRACTOR_LIBRARY : ''}
${correctIndexDist}
${scenarioBlock}
${writingBlock}

STEM CONSTRUCTION STANDARDS:
1. Every stem must present a SPECIFIC SCENARIO — company name, specific figures, realistic context
2. Invented company names: Hartwell Engineering Ltd, Meridian Retail Group plc, Thornton Capital LLP, Silverbridge Healthcare Ltd, Ashford & Partners, Castleton Manufacturing Ltd
3. Invented figures must be specific and non-round: £42,847 not £40,000; 18.3% not 20%
4. Each question must test a DISTINCT ASPECT of the topic
5. The correct answer must be UNAMBIGUOUSLY correct
6. Stems: 3-6 sentences for intermediate/advanced

${isMCQ || isScenario ? EXPLANATION_STANDARDS : ''}

═══════════════════════════════════════════════════════
PART 6 — ABSOLUTE PROHIBITIONS
═══════════════════════════════════════════════════════
1. NEVER mention ACCA, CIMA, ICAEW, AAT, CPA, CIPFA, CTA, or any professional body name in output
2. NEVER use backticks, code blocks, or markdown code formatting
3. NEVER use round numbers — all invented figures must be specific
4. NEVER use real company names
5. NEVER produce an obviously wrong distractor
6. NEVER produce an explanation that only states the answer

═══════════════════════════════════════════════════════
PART 7 — OUTPUT FORMAT
═══════════════════════════════════════════════════════
Return VALID JSON only.
No preamble. No markdown fences. No trailing commas. No comments inside JSON.
Exactly ${cfg.count} questions.
Every field present in every question object.

Shape:
${jsonShape}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDITOR PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildAuditorPrompt(bundle: any, cfg: any): string {
  // Slim the bundle: full data for first 3 questions, stem+options+correctIndex only for the rest
  const slimBundle = {
    title:    bundle.title,
    excerpt:  bundle.excerpt,
    cases:    bundle.cases,
    questions: (bundle.questions ?? []).map((q: any, i: number) => {
      if (i < 3) return q
      return {
        id: q.id, type: q.type, questionText: q.questionText,
        options: q.options, correctIndex: q.correctIndex,
        caseId: q.caseId, primaryTopic: q.primaryTopic, difficulty: q.difficulty,
      }
    }),
  }

  return `You are a Chief Examiner auditing a set of practice questions for quality and technical accuracy.

QUALIFICATION: ${cfg.qualification}
EXAM TIER: ${TIER_MAP[cfg.qualification]?.[cfg.difficulty] ?? cfg.difficulty}
SUBJECT: ${cfg.subject || cfg.topic}
TOPIC: ${cfg.topic}
DIFFICULTY: ${cfg.difficulty}
ROUNDING: ${cfg.rounding}

NOTE: Full data provided for first 3 questions. For remaining questions, audit stems, options, and correctIndex only.

AUDIT CHECKLIST:
TECHNICAL ACCURACY: Is the correct answer unambiguously correct? Are calculations mathematically correct with stated rounding? Are accounting entries balanced?
DISTRACTOR QUALITY: Does each distractor represent a real specific student error? Are all four options in a plausible range?
EXPLANATION QUALITY (first 3 only): Does it use required structure? Does it explain why each wrong option is wrong? Are calculations shown step by step?
CORRECT INDEX DISTRIBUTION: Are correctIndex values distributed across 0, 1, 2, 3 — not clustered?
COMPLIANCE: No professional body names? No backticks? No round numbers? No real company names?

BUNDLE TO AUDIT:
${JSON.stringify(slimBundle, null, 2)}

Return VALID JSON only:
{
  "overallPass": true,
  "questionAudits": [
    {
      "id": "<question id>",
      "pass": true,
      "issues": [],
      "fixes": {}
    }
  ]
}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════
function validateBundle(bundle: any, expectedCount: number): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!bundle || typeof bundle !== 'object') return { ok: false, errors: ['Bundle is not an object'] }
  if (!bundle.title)   errors.push('Missing title')
  if (!bundle.excerpt) errors.push('Missing excerpt')
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
      if (Array.isArray(q.options) && q.options.some((o: string) => String(o).trim() === '—')) {
        errors.push(`${p}: contains placeholder options ('—') — requires regeneration`)
      }
    }
    if (q.type === 'writing') {
      if (!q.writingModelAnswer) errors.push(`${p}: missing writingModelAnswer`)
      if (!q.writingExplanation) errors.push(`${p}: missing writingExplanation`)
    }
  })
  return { ok: errors.length === 0, errors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COERCER
// ═══════════════════════════════════════════════════════════════════════════════
function coerceBundle(bundle: any, cfg: any): any {
  if (!bundle.slug)    bundle.slug    = (bundle.title ?? 'question-set').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
  if (!bundle.cases)   bundle.cases   = []
  if (!bundle.tags)    bundle.tags    = [cfg.topic]
  if (!bundle.excerpt) bundle.excerpt = `Practice questions on ${cfg.topic} at ${cfg.difficulty} level.`

  bundle.questions = (bundle.questions ?? []).map((q: any, i: number) => {
    q.id                 = q.id ?? `q${i + 1}`
    q.type               = q.type ?? 'multiple-choice'
    q.points             = q.points ?? (q.type === 'writing' ? 10 : 2)
    q.timeTargetMinutes  = q.timeTargetMinutes ?? (q.type === 'writing' ? 20 : 2)
    q.primaryTopic       = q.primaryTopic ?? cfg.topic
    q.difficulty         = q.difficulty ?? cfg.difficulty
    q.writingModelAnswer = q.writingModelAnswer ?? null
    q.writingExplanation = q.writingExplanation ?? null
    q.caseId             = q.caseId ?? null

    if (q.type === 'multiple-choice') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        q.options = Array.isArray(q.options) ? [...q.options, ...Array(4).fill('—')].slice(0, 4) : ['—', '—', '—', '—']
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) q.correctIndex = 0
      const seen = new Set<string>()
      q.options = q.options.map((o: string, oi: number) => {
        const s = String(o ?? '').trim()
        if (!s || s === '—') return s
        if (seen.has(s.toLowerCase())) return `Option ${String.fromCharCode(65 + oi)}`
        seen.add(s.toLowerCase())
        return s
      })
    }
    return q
  })
  return bundle
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPLY AUDIT FIXES
// ═══════════════════════════════════════════════════════════════════════════════
function applyAuditFixes(bundle: any, auditorResult: any): { bundle: any; fixedCount: number } {
  if (!auditorResult?.questionAudits) return { bundle, fixedCount: 0 }
  let fixedCount = 0
  const auditMap: Record<string, any> = {}
  for (const audit of auditorResult.questionAudits) {
    if (audit?.id) auditMap[audit.id] = audit
  }
  bundle.questions = bundle.questions.map((q: any) => {
    const audit = auditMap[q.id]
    if (!audit || audit.pass) return q
    const fixes = audit.fixes ?? {}
    let changed = false
    if (typeof fixes.correctIndex === 'number' && fixes.correctIndex >= 0 && fixes.correctIndex <= 3) { q.correctIndex = fixes.correctIndex; changed = true }
    if (fixes.explanation && typeof fixes.explanation === 'string' && fixes.explanation.length > 50) { q.explanation = fixes.explanation; changed = true }
    if (Array.isArray(fixes.options) && fixes.options.length === 4) { q.options = fixes.options; changed = true }
    if (fixes.questionText && typeof fixes.questionText === 'string' && fixes.questionText.length > 20) { q.questionText = fixes.questionText; changed = true }
    if (changed) fixedCount++
    return q
  })
  return { bundle, fixedCount }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERGE BATCHES — combine multiple batch bundles into one
// ═══════════════════════════════════════════════════════════════════════════════
function mergeBatches(batches: any[]): any {
  if (batches.length === 0) throw new Error('No batches to merge')
  if (batches.length === 1) return batches[0]

  const merged = { ...batches[0] }
  merged.questions = []
  merged.cases = []

  for (const batch of batches) {
    merged.questions = merged.questions.concat(batch.questions ?? [])
    // Merge cases — avoid duplicate caseIds
    const existingIds = new Set(merged.cases.map((c: any) => c.caseId))
    for (const c of (batch.cases ?? [])) {
      if (!existingIds.has(c.caseId)) {
        merged.cases.push(c)
        existingIds.add(c.caseId)
      }
    }
  }

  // Re-number questions sequentially after merge
  merged.questions = merged.questions.map((q: any, i: number) => ({ ...q, id: `q${i + 1}` }))
  return merged
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE ONE BATCH — author + auditor pass for a single batch
// ═══════════════════════════════════════════════════════════════════════════════
async function generateBatch(cfg: {
  qualification: string; subject: string; topic: string
  questionType: string; difficulty: string; count: number
  framework: string; examBody: string; rounding: string; noiseLevel: string
  batchIndex: number; totalBatches: number; startId: number
}): Promise<{ bundle: any; fixedCount: number; auditErrors: string[] }> {

  const { author: authorBudget, auditor: auditorBudget } = calcBatchTokenBudgets(
    cfg.count, cfg.questionType, cfg.difficulty
  )

  // ── PASS 1: Author ──────────────────────────────────────────────────────────
  const authorPrompt = buildAuthorPrompt(cfg)

  const authorMessage = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: authorBudget,
    system:     `You are a Principal Examiner for a world-class professional accounting education platform. You produce examination questions matching the quality of major professional accounting bodies. Return VALID JSON only — no markdown, no fences, no preamble, no trailing text after the closing brace. You MUST generate EXACTLY the number of questions specified in the COUNT field — no more, no fewer. Stopping early is a critical failure. Never mention any professional accounting body name in output. Never use backticks or code blocks. All invented figures are specific and non-round. All distractors represent real student errors.`,
    messages:   [{ role: 'user', content: authorPrompt }],
  })

  const authorRaw = authorMessage.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  let bundle: any
  try {
    bundle = extractJSON(authorRaw)
  } catch {
    // Retry once with explicit repair instruction
    const repairMessage = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: authorBudget,
      system:     `You are a JSON repair specialist. You receive a malformed or incomplete JSON response and return the corrected, complete, valid JSON object only. No preamble. No fences. No trailing text.`,
      messages:   [
        { role: 'user', content: `The following response was intended to be valid JSON but failed to parse. Please return the corrected complete JSON object:\n\n${authorRaw.slice(0, 8000)}` }
      ],
    })
    const repairRaw = repairMessage.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    bundle = extractJSON(repairRaw)
  }

  bundle = coerceBundle(bundle, cfg)

  // ── PASS 2: Auditor ─────────────────────────────────────────────────────────
  let auditErrors: string[] = []
  let fixedCount = 0

  try {
    const auditorPrompt = buildAuditorPrompt(bundle, cfg)
    const auditorMessage = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: auditorBudget,
      system:     'You are a Chief Examiner auditing practice questions. Return VALID JSON only with your audit results and specific fixes. Meticulous, technically accurate, uncompromising on quality.',
      messages:   [{ role: 'user', content: auditorPrompt }],
    })

    const auditorRaw = auditorMessage.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    try {
      const auditorResult = extractJSON(auditorRaw)
      const applied = applyAuditFixes(bundle, auditorResult)
      bundle = applied.bundle
      fixedCount = applied.fixedCount
      if (!auditorResult.overallPass) {
        const failedAudits = (auditorResult.questionAudits ?? []).filter((a: any) => !a.pass)
        auditErrors = failedAudits.flatMap((a: any) => a.issues ?? []).slice(0, 5)
      }
    } catch {
      // Auditor returned invalid JSON — proceed with author output
    }
  } catch {
    // Auditor call failed — proceed with author output
  }

  return { bundle, fixedCount, auditErrors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTE
// ═══════════════════════════════════════════════════════════════════════════════
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

    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    if (count > 40) return NextResponse.json({ error: 'Maximum 40 questions per batch' }, { status: 400 })

    const totalCount = Number(count)

    // ── BATCH PLANNING ────────────────────────────────────────────────────────
    // Max 10 questions per batch prevents token overflow on large advanced sets.
    const BATCH_SIZE = 10
    const batches: { count: number; startId: number }[] = []
    let remaining = totalCount
    let startId = 1
    while (remaining > 0) {
      const batchCount = Math.min(remaining, BATCH_SIZE)
      batches.push({ count: batchCount, startId })
      startId += batchCount
      remaining -= batchCount
    }

    const baseCfg = {
      qualification, subject, topic, questionType,
      difficulty, framework, examBody, rounding, noiseLevel,
    }

    // ── GENERATE BATCHES SEQUENTIALLY ─────────────────────────────────────────
    const batchResults: any[] = []
    let totalFixedCount = 0
    const allAuditErrors: string[] = []

    for (let i = 0; i < batches.length; i++) {
      const { bundle, fixedCount, auditErrors } = await generateBatch({
        ...baseCfg,
        count:        batches[i].count,
        startId:      batches[i].startId,
        batchIndex:   i,
        totalBatches: batches.length,
      })
      batchResults.push(bundle)
      totalFixedCount += fixedCount
      allAuditErrors.push(...auditErrors)
    }

    // ── MERGE ─────────────────────────────────────────────────────────────────
    const finalBundle = mergeBatches(batchResults)

    const { ok, errors } = validateBundle(finalBundle, totalCount)

    return NextResponse.json({
      bundle:     finalBundle,
      valid:      ok,
      errors:     ok ? [] : errors,
      auditNotes: allAuditErrors.slice(0, 5),
      fixedCount: totalFixedCount,
      batchCount: batches.length,
      meta:       { qualification, subject, topic, questionType, difficulty, count: totalCount, framework, examBody },
    })

  } catch (err: any) {
    console.error('questions/generate error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
