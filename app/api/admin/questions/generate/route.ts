/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ═══════════════════════════════════════════════════════════════════════════════
// QUALIFICATION PROFILES
// Deep exam intelligence per qualification — calibrates difficulty, style,
// command verbs, marking expectations, and question construction.
// NEVER referenced in output — internal calibration only.
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
- Time target: 2.4 minutes per 2-mark question (1.2 min per mark)

COMMAND VERBS BY LEVEL:
- Knowledge level: Identify, State, Define, Outline, List
- Skills level: Calculate, Prepare, Explain, Discuss, Distinguish, Apply
- Professional level: Evaluate, Assess, Advise, Recommend, Analyse, Justify, Critically evaluate

MARKING EXPECTATIONS:
- Calculation questions: method marks available even if final answer wrong — show all workings
- Theory questions: professional language, structured response, specific not generic
- Practical application: link theory to the scenario — generic answers score poorly
- Ethics questions: identify threat, assess significance, apply safeguards, conclude

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
- OT question types: MCQ (1 mark), multiple response (1-2 marks), drag and drop, number entry, hot spot
- Case Study exams (Operational/Management/Strategic): pre-seen material, 3-hour exam, integrated tasks
- Strategic Case Study: board-level decision making, strategic analysis, integration across pillars

MCQ CONSTRUCTION STANDARDS:
- Management accounting focus: cost analysis, budgeting, variance analysis, performance measurement, risk
- Stems: professional management context — "The finance director has asked you to...", "A client has requested advice on..."
- Scenario-led: questions embedded in realistic business management contexts
- Calculation accuracy: marginal costing, absorption costing, activity-based costing, budgetary control
- Strategic level: scenario analysis, stakeholder management, ethical leadership, risk frameworks

MANAGEMENT ACCOUNTING DEPTH:
- Cost behaviour: fixed, variable, semi-variable, step-fixed — high-low method, regression analysis
- Decision making: relevant costs, limiting factors, make-or-buy, shutdown decisions, pricing strategies
- Performance measurement: balanced scorecard, ROI, RI, EVA, non-financial indicators, benchmarking
- Risk: expected value, maximin, maximax, sensitivity analysis, simulation
- Control: standard costing, variance analysis (price, volume, mix, yield), behavioural aspects

COMMAND VERBS:
- Operational level: Calculate, Prepare, Identify, Explain, Classify
- Management level: Analyse, Evaluate, Recommend, Assess, Apply, Advise
- Strategic level: Evaluate, Recommend, Justify, Critically assess, Propose, Advise the board

DISTRACTOR ENGINEERING FOR CIMA:
- Absorption vs marginal profit differences — closing inventory valuation
- Incorrect variance calculations — adverse/favourable sign errors, wrong standard
- ROI vs RI confusion — including/excluding capital charge
- Relevant vs irrelevant cost confusion — sunk costs, committed costs, notional costs
- Strategic analysis errors — internal vs external factors, short vs long term
`,

  ICAEW: `
QUALIFICATION PROFILE — ICAEW/ACA STANDARD (internal calibration only):

EXAM STRUCTURE AWARENESS:
- Certificate level: Accounting (computerised), Assurance, Business Technology & Finance, Law, Management Information, Principles of Taxation
- Professional level: Financial Accounting & Reporting (FAR), Audit & Assurance (AA), Business Strategy & Technology (BST), Financial Management (FM), Tax Compliance (TC)
- Advanced level: Corporate Reporting (CR), Strategic Business Management (SBM), Case Study (CS)
- Advanced level exams: 3.5 hours, open-book, complex multi-issue scenarios requiring integrated professional judgement

ACA QUESTION CHARACTERISTICS:
- Longer scenarios than most other bodies — 200-500 words for Professional level questions
- Ethics integrated throughout — professional duties, conflicts, reporting obligations
- Professional scepticism emphasis — questioning, challenging, corroborating
- Technical precision required — specific IFRS/UK GAAP references, Companies Act references
- Presentation matters — headed responses, structured paragraphs, professional language
- Advanced level: no single right answer — marks for quality of reasoning and application

CORPORATE REPORTING DEPTH (Advanced):
- Complex group accounting: step acquisitions, disposals, foreign subsidiaries, goodwill impairment
- Financial instruments: IFRS 9 classification, measurement, hedge accounting
- Revenue recognition: IFRS 15 five-step model, variable consideration, contract modifications
- Leases: IFRS 16 lessor and lessee accounting, subleases, modifications
- Deferred tax: IAS 12, temporary differences, recognition criteria, business combinations

AUDIT AND ASSURANCE DEPTH:
- Risk-based audit approach: inherent risk, control risk, detection risk
- ISA compliance: planning (ISA 300), risk assessment (ISA 315), fraud (ISA 240), going concern (ISA 570)
- Audit evidence: sufficiency, appropriateness, reliability hierarchy
- Modified opinions: qualified, adverse, disclaimer — specific triggers
- Ethics and independence: fundamental principles (ICAEW Code), threats and safeguards

COMMAND VERBS (ICAEW specific):
- Explain, Outline, Describe: factual recall and explanation
- Analyse, Assess, Evaluate: structured professional assessment
- Advise, Recommend: professional conclusion with justification
- Prepare, Calculate: technical computation with workings
- Discuss, Consider: balanced treatment of multiple perspectives
`,

  AAT: `
QUALIFICATION PROFILE — AAT STANDARD (internal calibration only):

EXAM STRUCTURE AWARENESS:
- Level 2 Foundation: Bookkeeping Transactions (BTRN), Bookkeeping Controls (BKCL), Introduction to Payroll (ITPF), Business Environment (BENV)
- Level 3 Advanced: Financial Accounting (FAPS), Management Accounting (MATS), Tax Processes (TPFB), Business Awareness (BUAW), Synoptic (AVSY)
- Level 4 Professional: Financial Statements of Limited Companies (FSLC), Management Accounting Decision & Control (MDCL), Budgeting (MABU), Business Tax (BNTA), Personal Tax (PNTA), Audit & Assurance (AUDT), Cash & Financial Management (CAFM), Credit & Debt Management (CDMT), Synoptic

AAT QUESTION CHARACTERISTICS:
- Task-based assessments — not primarily MCQ but structured computational tasks
- For MCQ format: test procedural knowledge and correct application of rules
- Practical focus: double entry, ledger balances, trial balance, VAT calculations, payroll
- Stepped difficulty within a paper: early tasks straightforward, later tasks integrated
- Real-world accounting scenarios: bookkeeping, control accounts, reconciliations
- Professional ethics woven into assessments at every level

LEVEL 2 TECHNICAL REQUIREMENTS:
- Double entry: debit/credit rules for assets, liabilities, equity, income, expenses
- Source documents: invoices, credit notes, receipts, remittance advices
- Sales and purchase ledgers: posting, totalling, balancing
- VAT: standard rate 20%, input/output tax, VAT return basics
- Payroll: gross pay, income tax, NIC, net pay calculation

LEVEL 3 TECHNICAL REQUIREMENTS:
- Trial balance extraction and correction of errors
- Accruals and prepayments, depreciation methods (straight-line, reducing balance)
- Irrecoverable debts and allowances for doubtful debts
- Inventory valuation: FIFO, weighted average cost
- Management accounting: cost classification, overhead absorption, contribution analysis

LEVEL 4 TECHNICAL REQUIREMENTS:
- Financial statements: sole trader, partnership, limited company (IFRS and FRS 102)
- Group accounts basics: consolidated statement of financial position
- Standard costing and variance analysis
- Cash flow forecasting, working capital management
- Business and personal tax: self-assessment, corporation tax basics

DISTRACTOR ENGINEERING FOR AAT:
- Debit/credit confusion — particularly for returns, contra entries, provisions
- VAT inclusive vs exclusive — wrong base for VAT calculation
- Depreciation: wrong method, wrong rate, wrong period, disposal errors
- Accruals direction — which way the adjustment goes
- Bank reconciliation: timing differences, unpresented cheques, outstanding lodgements
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT TECHNICAL CONTEXT
// Per-subject technical standards for question accuracy
// ═══════════════════════════════════════════════════════════════════════════════
const SUBJECT_TECHNICAL_CONTEXT: Record<string, string> = {
  'Financial Reporting':        'Apply IFRS standards by number. Never reproduce standard text. Specific recognition, measurement, presentation and disclosure requirements. IAS 1, IFRS 15, IFRS 16, IAS 36, IFRS 9, IAS 38, IAS 37, IFRS 3, IAS 12 are the core standards. Figures in journals to nearest pound. Clearly label IFRS vs UK GAAP where both apply.',
  'Financial Accounting':       'Double entry mechanics must be correct. T-accounts, trial balance, control accounts, bank reconciliation. Accruals basis throughout. Inventory: FIFO and weighted average. Depreciation: straight-line and reducing balance with exact calculations. VAT: 20% standard rate — state all rates as illustrative.',
  'Management Accounting':      'Cost classifications: fixed, variable, semi-variable. Contribution = Sales - Variable costs. Absorption rate = Budgeted overhead / Budgeted activity. All variances: adverse (A) or favourable (F). High-low method: variable cost per unit = (High cost - Low cost) / (High units - Low units).',
  'Audit and Assurance':        'ISA references where relevant. Risk = Inherent risk × Control risk × Detection risk. Audit assertions: completeness, existence, accuracy, valuation, rights and obligations, cut-off, classification. Modified opinions: qualified (material but not pervasive), adverse (material and pervasive), disclaimer (unable to obtain sufficient evidence).',
  'Taxation':                   'All rates and thresholds marked as illustrative — state year and caveat with verify from official sources. UK tax context unless specified. Income tax: basic/higher/additional rate bands. Corporation tax: main rate. VAT: standard/reduced/zero rates. Capital gains: annual exempt amount, rates.',
  'Financial Management':       'Time value of money: PV = FV / (1+r)^n. NPV, IRR, Payback, ROCE — all calculated correctly. WACC: weighted average using market values. Gearing: debt/(debt+equity) or debt/equity — state which. Beta: systematic risk only. CAPM: E(r) = Rf + β(Rm - Rf). All workings shown step by step.',
  'Performance Management':     'Variance analysis: all eight standard cost variances. Balanced scorecard: financial, customer, internal process, learning and growth. Transfer pricing: market price, marginal cost, negotiated. Divisional performance: ROI, RI, EVA. Linear programming: contribution maximisation, shadow prices.',
  'Strategic Business':         'Strategic analysis frameworks: PESTLE, Porter Five Forces, SWOT, Ansoff, BCG. Balanced scorecard at strategic level. Stakeholder mapping: power/interest grid. Risk frameworks: COSO, risk register, risk appetite. Ethics: professional codes, whistleblowing, conflicts of interest.',
  'Bookkeeping':                'Debit = left side of T-account. Credit = right side. Assets and expenses increase with debits. Liabilities, equity, income increase with credits. Source documents: invoice (sales/purchase), credit note, receipt, remittance advice, bank statement. Daybooks: sales, purchases, sales returns, purchases returns, cash, petty cash.',
  'default':                    'Technical accuracy is paramount. All calculations verified. All accounting entries balanced. All references to standards, rates or thresholds caveated as illustrative and subject to change.',
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRACTOR ENGINEERING LIBRARY
// Common student errors per question kind — used to build realistic distractors
// ═══════════════════════════════════════════════════════════════════════════════
const DISTRACTOR_LIBRARY = `
DISTRACTOR ENGINEERING — MANDATORY FOR ALL MCQ:

Every incorrect option (distractor) must represent a REAL, SPECIFIC ERROR that students commonly make.
Never use obviously wrong distractors. Never use "None of the above" or "All of the above".

COMMON ERROR TYPES TO USE AS DISTRACTORS:
1. SIGN ERROR — treating a debit as a credit or vice versa, treating adverse variance as favourable
2. PERIOD ERROR — using wrong period (annual vs monthly, pre-adjustment vs post-adjustment)
3. OMISSION ERROR — forgetting an accrual, a depreciation charge, a tax adjustment, an NCI
4. INCLUSION ERROR — including a non-qualifying item (capital vs revenue, relevant vs sunk cost)
5. RATE/BASE ERROR — applying wrong rate, wrong base, or wrong year
6. METHOD CONFUSION — straight-line vs reducing balance, FIFO vs AVCO, absorption vs marginal
7. DIRECTION ERROR — adjusting the wrong way (adding instead of subtracting an accrual)
8. ROUNDING/ARITHMETIC ERROR — a plausible near-miss calculation result
9. CONCEPT CONFUSION — recognition vs measurement, allocation vs apportionment, provision vs contingent liability
10. STANDARD CONFUSION — applying wrong standard or wrong paragraph of correct standard

FOR NUMERIC QUESTIONS:
- All four options must represent plausible calculation outcomes
- Correct answer and distractors must be in the same realistic range
- Distractors should correspond to specific identifiable errors — never random numbers
- For two-decimal precision: correct answer and distractors should differ by a consistent factor or error
- State in the explanation exactly WHY each distractor is wrong (which error it represents)

FOR THEORY QUESTIONS:
- Each distractor should be a statement a student who partially understands the topic might choose
- Avoid distractors that are obviously false — they should require genuine knowledge to eliminate
- Use real professional misconceptions, not invented implausible statements
`

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO CASE ENGINEERING
// ═══════════════════════════════════════════════════════════════════════════════
const SCENARIO_ENGINEERING = `
SCENARIO CASE CONSTRUCTION STANDARDS:

Case exhibits must replicate the quality of professional examination scenarios:

EXHIBIT STRUCTURE:
- Company background: name, industry, size (turnover, employees), ownership structure
- Financial context: relevant financial data, ratios, comparatives where useful
- Specific situation: the issue, transaction, or decision requiring analysis
- Supporting data: figures, percentages, dates — all specific, non-round, realistic
- Intentional complexity: include one or two items that look relevant but are not — tests judgement

EXHIBIT LENGTH BY DIFFICULTY:
- Beginner: 100-150 words, single clear issue, clean data
- Intermediate: 200-300 words, 2-3 related issues, some noise
- Advanced: 350-500 words, multiple interacting issues, significant noise, professional judgement required

EXHIBIT FORMAT (HTML):
- Use <p> for narrative paragraphs
- Use <table> with <thead> and <tbody> for financial data
- Use <strong> for key figures and company names
- Use <ul><li> for lists of items
- Financial statements: present as HTML tables with proper column alignment

LINKED QUESTIONS:
- Each question tests a distinct aspect of the case
- Questions can build on each other (earlier answer informs later question) but each must be self-contained
- Mix of calculation and theory/judgement questions within a case
- Final question in a case typically requires evaluation or professional recommendation
`

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLANATION STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════
const EXPLANATION_STANDARDS = `
EXPLANATION QUALITY STANDARDS — NON-NEGOTIABLE:

Every explanation must be a genuine TEACHING RESOURCE, not just the answer restated.

FOR CALCULATION QUESTIONS — use this exact structure:
OVERVIEW:
[What accounting/financial concept this question tests and why it is important in practice]

DATA (INPUTS & ASSUMPTIONS):
[List every figure used, what it represents, and any assumptions made]

METHOD:
[The calculation approach and why this method is correct for this scenario]

SOLUTION (STEP-BY-STEP):
Step 1: [Clear label] = [figure] × [rate/factor] = [result]
Step 2: [Clear label] = [result from step 1] + [other figure] = [final result]
[Continue until answer reached — never skip steps]

WHY THE OTHER OPTIONS ARE WRONG:
Option A: [Explains which specific error leads to this result]
Option B: [Explains which specific error leads to this result]
Option D: [Explains which specific error leads to this result]
[Skip the correct option in this list]

KEY TAKEAWAY:
[One sentence that a student can commit to memory to avoid this mistake in future]

FOR THEORY/CONCEPT QUESTIONS — use this exact structure:
OVERVIEW:
[What professional knowledge this question tests — the underlying principle or standard]

WHY THE CORRECT ANSWER IS RIGHT:
[Detailed explanation of why the correct option is the only defensible answer — with reference to the relevant standard, rule, or professional principle]

WHY THE OTHER OPTIONS ARE WRONG:
Option A: [Specific reason this option fails — what misconception it represents]
Option B: [Specific reason this option fails]
Option D: [Specific reason this option fails]
[Skip the correct option]

PROFESSIONAL CONTEXT:
[Where a practitioner or candidate would encounter this in real professional work or in an examination]

KEY TAKEAWAY:
[One specific, memorable sentence]

CRITICAL FORMATTING RULES:
- Never use backticks, code blocks, or markdown code formatting
- Journal entries: plain Dr/Cr text — Dr [Account Name] £X,XXX / Cr [Account Name] £X,XXX / Being: [narrative]
- Calculations: numbered steps in plain text — Step 1: [label] = [calc] = [result]
- All explanations in British English
- Professional language throughout — no colloquialisms
`

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHOR PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildAuthorPrompt(cfg: {
  qualification: string; subject: string; topic: string
  questionType: string; difficulty: string; count: number
  framework: string; examBody: string; rounding: string; noiseLevel: string
}): string {

  const qualProfile  = QUALIFICATION_PROFILES[cfg.qualification] ?? QUALIFICATION_PROFILES.ACCA
  const subjectCtx   = SUBJECT_TECHNICAL_CONTEXT[cfg.subject] ?? SUBJECT_TECHNICAL_CONTEXT.default
  const isMCQ        = cfg.questionType === 'mcq' || cfg.questionType === 'mixed'
  const isScenario   = cfg.questionType === 'scenario'
  const isWriting    = cfg.questionType === 'writing'

  const difficultySpec: Record<string, string> = {
    beginner:     `BEGINNER/FOUNDATION LEVEL: Test knowledge and basic application. Stems are clear and unambiguous. One concept per question. No multi-step reasoning required. Students with 2-4 weeks of study should be able to answer. Command verbs: Identify, State, Define, Calculate (single step), Outline.`,
    intermediate: `INTERMEDIATE/SKILLS LEVEL: Test understanding and application in professional contexts. Multi-step calculations. Requires distinguishing between similar concepts. Realistic business scenarios with specific data. Some questions should require 2-3 linked reasoning steps. Students preparing for first-sitting should find these challenging but achievable. Command verbs: Calculate, Prepare, Explain, Distinguish, Apply, Discuss.`,
    advanced:     `ADVANCED/STRATEGIC LEVEL: Test professional judgement and analytical depth. Complex multi-issue scenarios. Deliberate ambiguity requiring professional judgement. Some questions have no single obviously correct answer — the correct option is the MOST appropriate professional response. Requires integration of multiple concepts. Students should need 4+ months of focused study to answer confidently. Command verbs: Evaluate, Assess, Advise, Recommend, Critically analyse, Justify.`,
  }

  const noiseSpec: Record<string, string> = {
    low:    `NOISE LEVEL LOW: Stems are clean. Every piece of information in the stem is needed to answer the question. No irrelevant details.`,
    medium: `NOISE LEVEL MEDIUM: Include one plausible-looking but irrelevant detail in each stem. The irrelevant detail should look important but not be needed. Tests the student's ability to identify what matters.`,
    high:   `NOISE LEVEL HIGH: Include two irrelevant or conflicting details in each stem. One should be a red herring that points toward a wrong answer. One should be a figure that is not needed for the calculation. Tests disciplined reading and judgement under exam conditions.`,
  }

  const frameworkSpec = cfg.framework && cfg.framework !== 'None'
    ? `FRAMEWORK: Use ONLY ${cfg.framework} throughout. Do not mix frameworks. Where ${cfg.framework} differs from other frameworks, apply ${cfg.framework} exclusively.`
    : `FRAMEWORK: Use IFRS as the primary framework for financial reporting topics unless the subject specifically requires UK GAAP or US GAAP. State the framework applied where it materially affects the answer.`

  const scenarioBlock = isScenario ? `
${SCENARIO_ENGINEERING}

CASE GROUPING FOR THIS BATCH:
- Generate ${Math.ceil(cfg.count / 4)} distinct case exhibits
- Each case has exactly ${Math.min(4, cfg.count)} linked questions
- Total = ${cfg.count} questions across ${Math.ceil(cfg.count / 4)} cases
- Cases array must contain ALL case objects — questions reference cases by caseId
- exhibitHtml must be valid HTML using <p>, <table>, <strong>, <ul>, <li> tags
` : ''

  const writingBlock = isWriting ? `
WRITING QUESTION STANDARDS:
- Each question presents a realistic professional scenario (150-250 words) with a clear requirement
- Requirement uses a professional command verb: Evaluate, Advise, Assess, Recommend, Analyse, Prepare, Calculate and comment
- writingModelAnswer: 200-400 words, structured response that goes straight into the answer — no restating the question title — use headings where appropriate
- writingExplanation: 100-150 words of teaching notes explaining the approach, marking priorities, and common errors
- keyPoints equivalent: embed 3-5 marking criteria within the writingExplanation
- Writing questions test JUDGEMENT not just recall — the scenario must require professional analysis
` : ''

  const jsonShape = isWriting ? `{
  "title": "<Professional, descriptive title — e.g. 'Lease Accounting: Professional Judgement and Application'>",
  "slug": "<url-friendly-slug-max-80-chars>",
  "excerpt": "<2-3 sentence description of what this set covers and at what level. No body names.>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "writing",
  "topic": "${cfg.topic}",
  "tags": ["<specific sub-topic>", "<accounting standard or concept>", "<skill tested>"],
  "cases": [],
  "questions": [
    {
      "id": "q1",
      "type": "writing",
      "questionText": "<Full scenario text (150-250 words) ending with a clear requirement using a command verb>",
      "options": [],
      "correctIndex": null,
      "explanation": null,
      "writingModelAnswer": "<Complete model answer 200-400 words — starts directly with the answer, uses headings, professional language>",
      "writingExplanation": "<Teaching notes 100-150 words: approach, marking priorities, common errors>",
      "caseId": null,
      "primaryTopic": "<Specific sub-topic tested — not the broad topic>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 20,
      "points": 10
    }
  ]
}` : isScenario ? `{
  "title": "<Professional descriptive title for this scenario set>",
  "slug": "<url-friendly-slug>",
  "excerpt": "<2-3 sentences describing the case contexts and skills tested. No body names.>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "scenario",
  "topic": "${cfg.topic}",
  "tags": ["<primary topic>", "<standard or concept>", "<skill>"],
  "cases": [
    {
      "caseId": "case-1",
      "title": "<Descriptive case title — e.g. 'Hartwell Engineering Ltd — Lease Commitments'>",
      "exhibitHtml": "<Full HTML exhibit — company background, financial data as HTML tables, specific scenario>"
    }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "questionText": "Based on the information provided for Hartwell Engineering Ltd, which of the following correctly states...?",
      "options": ["<Correct answer — specific, precise>", "<Distractor: sign error or omission>", "<Distractor: method confusion>", "<Distractor: arithmetic error>"],
      "correctIndex": 0,
      "explanation": "<Full structured explanation using OVERVIEW / WHY CORRECT / WHY OTHERS WRONG / KEY TAKEAWAY format>",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": "case-1",
      "primaryTopic": "<Specific sub-topic>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 3,
      "points": 2
    }
  ]
}` : `{
  "title": "<Professional descriptive title — e.g. 'Financial Reporting: Revenue Recognition Under IFRS 15'>",
  "slug": "<url-friendly-slug-max-80-chars>",
  "excerpt": "<2-3 sentences describing what this set covers and at what professional level. No body names.>",
  "difficulty": "${cfg.difficulty}",
  "questionType": "multiple-choice",
  "topic": "${cfg.topic}",
  "tags": ["<primary topic>", "<standard or framework>", "<skill tested>"],
  "cases": [],
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "questionText": "<3-6 sentence stem: company name, specific figures, realistic scenario, clear question>",
      "options": [
        "<Option A — one of: correct answer or plausible distractor>",
        "<Option B — one of: correct answer or plausible distractor>",
        "<Option C — one of: correct answer or plausible distractor>",
        "<Option D — one of: correct answer or plausible distractor>"
      ],
      "correctIndex": 2,
      "explanation": "<Full structured explanation — OVERVIEW / DATA / METHOD / SOLUTION / WHY OTHERS WRONG / KEY TAKEAWAY>",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": null,
      "primaryTopic": "<Specific sub-topic tested — not the broad topic title>",
      "difficulty": "<beginner|intermediate|advanced>",
      "timeTargetMinutes": 2,
      "points": 2
    }
  ]
}`

  return `You are a Principal Examiner for a world-class professional accounting education platform, responsible for producing examination questions that match the quality, depth, and rigour of the major professional accounting qualification bodies.

Your questions must be TECHNICALLY ACCURATE, PROFESSIONALLY CREDIBLE, EDUCATIONALLY EXCELLENT, and ORIGINAL.

═══════════════════════════════════════════════════════
PART 1 — QUALIFICATION PROFILE (internal calibration)
═══════════════════════════════════════════════════════
${qualProfile}

═══════════════════════════════════════════════════════
PART 2 — SUBJECT TECHNICAL REQUIREMENTS
═══════════════════════════════════════════════════════
SUBJECT: ${cfg.subject || cfg.topic}
${subjectCtx}

═══════════════════════════════════════════════════════
PART 3 — CONTENT SPECIFICATION
═══════════════════════════════════════════════════════
TOPIC: ${cfg.topic}
QUESTION TYPE: ${cfg.questionType.toUpperCase()}
DIFFICULTY: ${difficultySpec[cfg.difficulty] ?? difficultySpec.intermediate}
COUNT: ${cfg.count} questions
${frameworkSpec}
ROUNDING: ${cfg.rounding}
${noiseSpec[cfg.noiseLevel] ?? noiseSpec.medium}

═══════════════════════════════════════════════════════
PART 4 — QUESTION CONSTRUCTION RULES
═══════════════════════════════════════════════════════

${isMCQ || isScenario ? DISTRACTOR_LIBRARY : ''}
${scenarioBlock}
${writingBlock}

STEM CONSTRUCTION STANDARDS:
1. Every stem must present a SPECIFIC SCENARIO — company name, specific figures, realistic context
2. Invented company names must be realistic: Hartwell Engineering Ltd, Meridian Retail Group plc, Thornton Capital LLP, Silverbridge Healthcare Ltd, Ashford & Partners, Castleton Manufacturing Ltd
3. Invented figures must be specific and non-round: £42,847 not £40,000; 18.3% not 20%; 3.7 years not 4 years
4. Each question must test a DISTINCT ASPECT of the topic — no two questions cover the same concept
5. Stems must be 3-6 sentences for intermediate/advanced — single sentence only acceptable for foundation recall
6. Questions must be SELF-CONTAINED — a student must be able to answer without external reference (except scenario exhibits)
7. The correct answer must be UNAMBIGUOUSLY correct — no reasonable professional disagreement
8. Questions must NOT be solvable by elimination — each distractor must require genuine knowledge to reject

TOPIC COVERAGE REQUIREMENT:
Generate questions that collectively cover a RANGE of sub-topics within the main topic.
Do not generate multiple questions on identical concepts.
Vary the question kinds: mix of calculation, application, and conceptual questions where the topic allows.
For ${cfg.count} questions, aim for coverage of at least ${Math.min(cfg.count, 6)} distinct sub-topics.

${isMCQ || isScenario ? EXPLANATION_STANDARDS : ''}

═══════════════════════════════════════════════════════
PART 5 — ABSOLUTE PROHIBITIONS
═══════════════════════════════════════════════════════
1. NEVER mention ACCA, CIMA, ICAEW, AAT, CPA, CIPFA, CTA, or any professional body name in output
2. NEVER reproduce or closely paraphrase past examination questions from any professional body
3. NEVER use backticks, code blocks, or markdown code formatting anywhere
4. NEVER use round numbers — all invented figures must be specific (e.g. £42,847 not £40,000)
5. NEVER use real company names — all companies must be invented with realistic names
6. NEVER produce a distractor that is obviously wrong — all options must require genuine knowledge to evaluate
7. NEVER produce an explanation that only states the answer — explanations must teach
8. NEVER produce questions where the correct answer could be disputed by a competent professional

═══════════════════════════════════════════════════════
PART 6 — OUTPUT FORMAT
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
// Second-pass quality gate — validates technical accuracy and exam standard
// ═══════════════════════════════════════════════════════════════════════════════
function buildAuditorPrompt(bundle: any, cfg: any): string {
  return `You are a Chief Examiner conducting a quality audit of a set of practice questions.
Your role is to identify any questions that fail to meet professional examination standards and specify exactly what must be fixed.

QUALIFICATION STANDARD: ${cfg.qualification}
SUBJECT: ${cfg.subject || cfg.topic}
TOPIC: ${cfg.topic}
DIFFICULTY: ${cfg.difficulty}

AUDIT CHECKLIST — evaluate every question against ALL of these:

TECHNICAL ACCURACY:
[ ] Is the correct answer unambiguously correct? Would a competent professional agree?
[ ] Are all calculations mathematically correct with the stated rounding rule (${cfg.rounding})?
[ ] Are accounting entries balanced (debits = credits)?
[ ] Are standards referenced correctly (if referenced)?
[ ] Are all rates, thresholds, figures internally consistent?

DISTRACTOR QUALITY:
[ ] Does each distractor represent a real, specific student error (not a random or obviously wrong answer)?
[ ] Are all four options in a plausible range (not one correct and three wildly wrong)?
[ ] Can each distractor be linked to a specific identifiable error type?

EXPLANATION QUALITY:
[ ] Does the explanation use the required structure (OVERVIEW / METHOD / SOLUTION or OVERVIEW / WHY CORRECT / WHY OTHERS WRONG / KEY TAKEAWAY)?
[ ] Does the explanation explain WHY each wrong option is wrong?
[ ] Are calculations shown step by step with no backticks or code blocks?
[ ] Does the KEY TAKEAWAY capture a genuinely memorable professional insight?

QUESTION QUALITY:
[ ] Is the stem 3+ sentences with specific figures and company name?
[ ] Does the question test a DISTINCT sub-topic from other questions in the set?
[ ] Is the question at the correct difficulty level?
[ ] Is the question original (not a reproduction of a known exam question)?

COMPLIANCE:
[ ] No professional body names mentioned (ACCA, CIMA, ICAEW, AAT, etc.)?
[ ] No backticks or code blocks anywhere?
[ ] No round numbers (all invented figures specific)?
[ ] No real company names?

BUNDLE TO AUDIT:
${JSON.stringify(bundle, null, 2)}

Return VALID JSON only in this exact shape:
{
  "overallPass": true,
  "questionAudits": [
    {
      "id": "<question id>",
      "pass": true,
      "issues": [],
      "fixes": {}
    },
    {
      "id": "<question id>",
      "pass": false,
      "issues": ["<specific issue 1>", "<specific issue 2>"],
      "fixes": {
        "correctIndex": 2,
        "explanation": "<corrected full explanation if explanation is wrong>",
        "options": ["<corrected options array if options are wrong>"],
        "questionText": "<corrected stem if stem has issues>"
      }
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
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) errors.push(`${p}: invalid correctIndex (${q.correctIndex})`)
      if (!q.explanation) errors.push(`${p}: missing explanation`)
    }
    if (q.type === 'writing') {
      if (!q.writingModelAnswer) errors.push(`${p}: missing writingModelAnswer`)
      if (!q.writingExplanation) errors.push(`${p}: missing writingExplanation`)
    }
  })
  return { ok: errors.length === 0, errors }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COERCER — safe defaults on partial output
// ═══════════════════════════════════════════════════════════════════════════════
function coerceBundle(bundle: any, cfg: any): any {
  if (!bundle.slug)  bundle.slug  = (bundle.title ?? 'question-set').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
  if (!bundle.cases) bundle.cases = []
  if (!bundle.tags)  bundle.tags  = [cfg.topic]
  if (!bundle.excerpt) bundle.excerpt = `Practice questions on ${cfg.topic} at ${cfg.difficulty} level.`

  bundle.questions = (bundle.questions ?? []).map((q: any, i: number) => {
    q.id               = q.id ?? `q${i + 1}`
    q.type             = q.type ?? 'multiple-choice'
    q.points           = q.points ?? (q.type === 'writing' ? 10 : 2)
    q.timeTargetMinutes = q.timeTargetMinutes ?? (q.type === 'writing' ? 20 : 2)
    q.primaryTopic     = q.primaryTopic ?? cfg.topic
    q.difficulty       = q.difficulty ?? cfg.difficulty
    q.writingModelAnswer = q.writingModelAnswer ?? null
    q.writingExplanation = q.writingExplanation ?? null
    q.caseId           = q.caseId ?? null

    if (q.type === 'multiple-choice') {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        q.options = Array.isArray(q.options) ? [...q.options, ...Array(4).fill('—')].slice(0, 4) : ['—', '—', '—', '—']
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) q.correctIndex = 0
      // Deduplicate options
      const seen = new Set<string>()
      q.options = q.options.map((o: string, oi: number) => {
        const s = String(o ?? '').trim()
        if (!s || seen.has(s.toLowerCase())) return `Option ${String.fromCharCode(65 + oi)}`
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
    if (typeof fixes.correctIndex === 'number' && fixes.correctIndex >= 0 && fixes.correctIndex <= 3) {
      q.correctIndex = fixes.correctIndex; changed = true
    }
    if (fixes.explanation && typeof fixes.explanation === 'string' && fixes.explanation.length > 50) {
      q.explanation = fixes.explanation; changed = true
    }
    if (Array.isArray(fixes.options) && fixes.options.length === 4) {
      q.options = fixes.options; changed = true
    }
    if (fixes.questionText && typeof fixes.questionText === 'string' && fixes.questionText.length > 20) {
      q.questionText = fixes.questionText; changed = true
    }
    if (changed) fixedCount++
    return q
  })
  return { bundle, fixedCount }
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

    const cfg = {
      qualification, subject, topic, questionType,
      difficulty, count: Number(count), framework, examBody, rounding, noiseLevel,
    }

    // ── PASS 1: Author generates questions ───────────────────────────────────
    const authorPrompt = buildAuthorPrompt(cfg)

    const authorMessage = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 9000,
      system:     `You are a Principal Examiner for a world-class professional accounting education platform. You produce examination questions that match the quality of major professional accounting bodies. You return VALID JSON only — no markdown, no fences, no preamble. You never mention any professional accounting body name in output. You never use backticks or code blocks. All invented figures are specific and non-round. All distractors represent real student errors. Your explanations are full teaching resources, not just answer confirmations.`,
      messages:   [{ role: 'user', content: authorPrompt }],
    })

    const authorRaw = authorMessage.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    let bundle: any
    try {
      const cleaned = authorRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const s = cleaned.indexOf('{')
      const e = cleaned.lastIndexOf('}')
      bundle = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned)
    } catch {
      return NextResponse.json({ error: 'Generation failed — Claude returned invalid JSON. Please try again.' }, { status: 500 })
    }

    bundle = coerceBundle(bundle, cfg)

    // ── PASS 2: Auditor validates and fixes ──────────────────────────────────
    let auditErrors: string[] = []
    let fixedCount = 0

    try {
      const auditorPrompt = buildAuditorPrompt(bundle, cfg)
      const auditorMessage = await client.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system:     'You are a Chief Examiner auditing practice questions. You return VALID JSON only with your audit results and specific fixes. You are meticulous, technically accurate, and uncompromising on quality standards.',
        messages:   [{ role: 'user', content: auditorPrompt }],
      })

      const auditorRaw = auditorMessage.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('')

      try {
        const ac = auditorRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
        const as2 = ac.indexOf('{'); const ae = ac.lastIndexOf('}')
        const auditorResult = JSON.parse(as2 >= 0 && ae > as2 ? ac.slice(as2, ae + 1) : ac)
        const applied = applyAuditFixes(bundle, auditorResult)
        bundle = applied.bundle
        fixedCount = applied.fixedCount
        if (!auditorResult.overallPass) {
          const failedAudits = (auditorResult.questionAudits ?? []).filter((a: any) => !a.pass)
          auditErrors = failedAudits.flatMap((a: any) => a.issues ?? []).slice(0, 5)
        }
      } catch {
        // Auditor returned invalid JSON — proceed with author output unchanged
      }
    } catch {
      // Auditor call failed — proceed with author output
    }

    const { ok, errors } = validateBundle(bundle, Number(count))

    return NextResponse.json({
      bundle,
      valid:      ok,
      errors:     ok ? [] : errors,
      auditNotes: auditErrors,
      fixedCount,
      meta:       { qualification, subject, topic, questionType, difficulty, count, framework, examBody },
    })

  } catch (err: any) {
    console.error('questions/generate error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
