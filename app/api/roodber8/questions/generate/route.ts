/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ═══════════════════════════════════════════════════════════════════════════════
// TIER MAP — Issue 3 fix
// Maps qualification + difficulty to the explicit exam tier name.
// Injected into the author prompt so the model knows exactly which tier applies.
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

TIER-SPECIFIC CALIBRATION:
Applied Knowledge tier: Single-issue questions. One concept per question. Clean data, no noise. Command verbs: Identify, State, Define, Outline, List. Students with 2-4 weeks study should answer. One-mark recall points.
Applied Skills tier: Multi-step calculations. Two to three linked reasoning steps. Realistic business scenarios with specific data. Requires distinguishing between similar concepts. Command verbs: Calculate, Prepare, Explain, Distinguish, Apply, Discuss. Application marks awarded.
Strategic Professional tier: Complex multi-issue scenarios. Professional judgement required. Some questions have no single obviously correct answer — the correct option is the MOST appropriate professional response. Integration of multiple concepts and standards. Command verbs: Evaluate, Assess, Advise, Recommend, Critically analyse, Justify. Professional judgement marks with APC standards.

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

TIER-SPECIFIC CALIBRATION:
Operational Level: Procedural knowledge and basic application. Cost classification, basic variance analysis, simple performance measures. Clean single-issue questions. Students 2-3 months into study. Command verbs: Calculate, Prepare, Identify, Explain, Classify.
Management Level: Analysis and evaluation. Multi-dimensional performance measurement, risk analysis, investment decisions, complex budgeting. Scenarios with competing considerations. Command verbs: Analyse, Evaluate, Recommend, Assess, Apply, Advise.
Strategic Level: Integration and board-level judgement. Strategic analysis, stakeholder management, ethical leadership, complex risk. No single correct answer — best professional response required. Command verbs: Evaluate, Recommend, Justify, Critically assess, Propose, Advise the board.

MANAGEMENT ACCOUNTING DEPTH:
- Cost behaviour: fixed, variable, semi-variable, step-fixed — high-low method, regression analysis
- Decision making: relevant costs, limiting factors, make-or-buy, shutdown decisions, pricing strategies
- Performance measurement: balanced scorecard, ROI, RI, EVA, non-financial indicators, benchmarking
- Risk: expected value, maximin, maximax, sensitivity analysis, simulation
- Control: standard costing, variance analysis (price, volume, mix, yield), behavioural aspects

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

TIER-SPECIFIC CALIBRATION:
Certificate Level: Knowledge and basic application. Fundamental accounting mechanics, basic legal principles, introductory tax. Clean unambiguous questions. Students early in training. Command verbs: Explain, Outline, Describe, Calculate (single step), Identify.
Professional Level: Technical competence and emerging judgement. Complex financial statements, detailed audit procedures, tax computations, strategic analysis. Multi-step scenarios. 200-500 word stems. Command verbs: Analyse, Assess, Evaluate, Advise, Recommend, Prepare, Calculate.
Advanced Level: Full professional judgement. Complex multi-issue scenarios, open-book, no single right answer — marks for quality of reasoning. APC professional marks for presentation and structure. Integrated cross-subject scenarios. Command verbs: Evaluate, Advise, Recommend with full justification, Critically assess, Consider all perspectives.

ACA QUESTION CHARACTERISTICS:
- Longer scenarios than most other bodies — 200-500 words for Professional level questions
- Ethics integrated throughout — professional duties, conflicts, reporting obligations
- Professional scepticism emphasis — questioning, challenging, corroborating
- Technical precision required — specific IFRS/UK GAAP references, Companies Act references
- Presentation matters — headed responses, structured paragraphs, professional language

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
`,

  AAT: `
QUALIFICATION PROFILE — AAT STANDARD (internal calibration only):

EXAM STRUCTURE AWARENESS:
- Level 2 Foundation: Bookkeeping Transactions (BTRN), Bookkeeping Controls (BKCL), Introduction to Payroll (ITPF), Business Environment (BENV)
- Level 3 Advanced: Financial Accounting (FAPS), Management Accounting (MATS), Tax Processes (TPFB), Business Awareness (BUAW), Synoptic (AVSY)
- Level 4 Professional: Financial Statements of Limited Companies (FSLC), Management Accounting Decision & Control (MDCL), Budgeting (MABU), Business Tax (BNTA), Personal Tax (PNTA), Audit & Assurance (AUDT), Cash & Financial Management (CAFM), Credit & Debt Management (CDMT), Synoptic

TIER-SPECIFIC CALIBRATION:
Level 2 Foundation: Procedural competency. Debit and credit mechanics, basic source documents, VAT at 20%, simple payroll. Very clean single-step questions. Students new to accounting. Command verbs: Identify, Enter, Calculate (single step), State, Complete.
Level 3 Advanced: Application and analysis. Trial balance, accruals/prepayments, depreciation methods, inventory valuation, basic management accounting. Multi-step but bounded scenarios. Command verbs: Calculate, Prepare, Identify errors, Explain, Apply.
Level 4 Professional: Professional judgement and complex application. Limited company financial statements, standard costing, complex tax, working capital management. Extended written requirements. Students completing the full AAT pathway. Command verbs: Prepare, Evaluate, Calculate and comment, Advise, Analyse.

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
// SUBJECT TECHNICAL CONTEXT — Issues 4 & 5 fix
// Upgraded to match Content Factory depth. Law and Ethics added.
// ═══════════════════════════════════════════════════════════════════════════════
const SUBJECT_TECHNICAL_CONTEXT: Record<string, string> = {

  'Financial Reporting': `
FINANCIAL REPORTING — TECHNICAL STANDARDS:

CORE IFRS STANDARDS (reference by number — never reproduce standard text):
IFRS 1 (First-time adoption), IFRS 2 (Share-based payment — equity vs cash-settled), IFRS 3 (Business combinations — goodwill: full goodwill vs proportionate NCI method), IFRS 5 (Non-current assets held for sale — classification criteria, measurement at lower of carrying amount and FVLCTS), IFRS 7 (Financial instruments disclosures), IFRS 8 (Operating segments), IFRS 9 (Financial instruments — classification: amortised cost / FVOCI / FVTPL; ECL model three stages), IFRS 10 (Consolidated financial statements — control definition: power + variable returns + link), IFRS 11 (Joint arrangements — joint operation vs joint venture distinction), IFRS 12 (Disclosure of interests in other entities), IFRS 13 (Fair value measurement — three-level hierarchy), IFRS 15 (Revenue — five-step model: identify contract, identify POs, determine transaction price, allocate, recognise), IFRS 16 (Leases — lessee: ROU asset and lease liability; lessor: finance vs operating distinction).

KEY IAS STANDARDS:
IAS 1 (Presentation — current/non-current classification, OCI items), IAS 2 (Inventories — NRV write-down, FIFO/weighted average; LIFO prohibited under IFRS), IAS 7 (Cash flow statements — direct/indirect method, classification of interest and dividends), IAS 8 (Accounting policies — prior period errors vs changes in estimates), IAS 10 (Events after reporting period — adjusting vs non-adjusting), IAS 12 (Deferred tax — temporary differences NOT timing differences; deferred tax asset recognition criteria), IAS 16 (PPE — cost vs revaluation model; component accounting), IAS 19 (Employee benefits — defined contribution vs defined benefit; actuarial gains/losses in OCI), IAS 20 (Government grants — matching principle), IAS 21 (Foreign exchange — functional vs presentation currency; monetary vs non-monetary items), IAS 23 (Borrowing costs — qualifying asset capitalisation), IAS 27 (Separate financial statements), IAS 28 (Associates — equity method; significant influence at 20%+), IAS 32 (Financial instruments presentation — liability vs equity classification), IAS 33 (EPS — basic and diluted), IAS 36 (Impairment — CGU methodology; value in use vs FVLCTS; goodwill impairment), IAS 37 (Provisions — obligating event + probable outflow + reliable estimate; contingent liabilities disclose only), IAS 38 (Intangibles — research expense vs development capitalise criteria), IAS 40 (Investment property — cost vs fair value model).

PRECISION REQUIREMENTS:
- All figures in journals to nearest pound unless stated otherwise
- Clearly label IFRS vs UK GAAP where both apply — state which framework
- IFRS 15 five steps must be applied sequentially — shortcutting step identification fails marks
- IAS 36 CGU: allocate goodwill then test — impairment loss reduces goodwill first then pro-rata to other assets (not below recoverable amount)
- IFRS 16 lessee: right-of-use asset = present value of lease payments + initial direct costs + restoration provision; interest on liability is finance cost, not operating cost
- IAS 19 defined benefit: current service cost in P&L, net interest on net liability in P&L, remeasurement gains/losses in OCI (NEVER reclassified to P&L)

COMMON CONFUSIONS:
- IAS 36: students test individual assets not CGUs — always allocate goodwill to CGU first
- IFRS 16: students put entire lease payment in P&L — split into interest (finance cost) and principal repayment
- IAS 19 pensions: students put actuarial gains/losses in P&L — they go in OCI permanently
- IFRS 15: students recognise revenue at invoice date — must assess performance obligation satisfaction
- IAS 37: students capitalise contingent liabilities — disclose only unless probable and reliably measurable
`,

  'Financial Accounting': `
FINANCIAL ACCOUNTING — TECHNICAL STANDARDS:

DOUBLE ENTRY MECHANICS:
Assets and expenses: increase with DEBIT, decrease with CREDIT.
Liabilities, equity, and income: increase with CREDIT, decrease with DEBIT.
Every transaction: total debits must equal total credits — always.

CORE ACCOUNTING MECHANICS:
Accruals basis: match income and expenses to the period they relate to, not cash received/paid.
Prepayments: asset (DEBIT prepayment, CREDIT expense — reduce expense for period).
Accruals: liability (DEBIT expense, CREDIT accrual — increase expense for period).
Irrecoverable debts: DEBIT irrecoverable debt expense, CREDIT trade receivables.
Allowance for doubtful debts: DEBIT bad debt expense (increase in allowance), CREDIT allowance account. Net receivables = gross receivables less allowance.

DEPRECIATION:
Straight-line: (Cost - Residual value) / Useful life = annual charge. Carrying amount = Cost - Accumulated depreciation.
Reducing balance: Carrying amount at start of year × Rate% = annual charge.
Disposal: Remove cost and accumulated depreciation. Profit or loss on disposal = Proceeds - Carrying amount at disposal date.

INVENTORY VALUATION:
FIFO: First units purchased are first units sold. Closing inventory valued at most recent prices.
Weighted average cost: Total cost of inventory available / Total units available = average cost per unit. Applied to each issue.
NRV rule: Inventory valued at LOWER of cost and net realisable value. NRV = estimated selling price less estimated costs to complete and sell.

CONTROL ACCOUNTS:
Sales ledger control account: Opening balance + Credit sales = Cash received + Discounts allowed + Returns inwards + Irrecoverable debts + Closing balance.
Purchases ledger control account: Cash paid + Discounts received + Returns outwards + Closing balance = Opening balance + Credit purchases.
Reconcile control accounts to individual ledger totals — differences indicate errors.

BANK RECONCILIATION:
Balance per cash book ≠ balance per bank statement due to: unpresented cheques (in cash book, not yet on statement), outstanding lodgements (in cash book, not yet on statement), direct debits/standing orders (on statement, not yet in cash book), bank charges/interest (on statement, add to cash book).
Adjusted cash book balance = Bank statement balance + Outstanding lodgements - Unpresented cheques.

COMPANY, PARTNERSHIP, AND SOLE TRADER ACCOUNTS:
Partnership: profit sharing ratio; partners' current accounts vs capital accounts; goodwill on admission/retirement.
Limited company: share capital (ordinary vs preference), share premium, retained earnings, revaluation reserve. Dividends reduce retained earnings — not an expense in P&L.

COMMON CONFUSIONS:
- Accrued income (asset) vs prepaid expense (asset) vs accrued expense (liability) vs deferred income (liability) — students confuse direction of adjustment
- Reducing balance depreciation: students apply rate to cost not carrying amount in year 2+
- Allowance for doubtful debts: only the CHANGE in allowance hits P&L, not the full balance
- Partnership goodwill: raise at full value, credit to all partners in old ratio; eliminate in new ratio
`,

  'Management Accounting': `
MANAGEMENT ACCOUNTING — TECHNICAL STANDARDS:

COST CLASSIFICATIONS:
Fixed costs: unchanged with activity level within relevant range (rent, depreciation SL, insurance).
Variable costs: change proportionally with activity (direct materials, direct labour if paid per unit, variable overhead).
Semi-variable: fixed element plus variable element — use high-low method to split.
High-low method: Variable cost per unit = (Highest cost - Lowest cost) / (Highest activity - Lowest activity). Fixed cost = Total cost at either level - (Variable cost per unit × Activity level).
Step-fixed: fixed within activity range but jumps at capacity thresholds.

CONTRIBUTION ANALYSIS:
Contribution = Selling price per unit - Variable cost per unit.
Total contribution = Contribution per unit × Units sold.
Profit = Total contribution - Fixed costs.
C/S ratio (contribution to sales) = Contribution per unit / Selling price per unit.
Breakeven point (units) = Fixed costs / Contribution per unit.
Breakeven point (revenue) = Fixed costs / C/S ratio.
Margin of safety = Budgeted sales - Breakeven sales (express as units or %).

ABSORPTION COSTING vs MARGINAL COSTING:
Absorption: fixed overheads included in product cost. Closing inventory includes fixed overhead.
Marginal: fixed overheads treated as period cost. Closing inventory excludes fixed overhead.
Profit reconciliation: Absorption profit - Marginal profit = Change in inventory × Fixed overhead absorption rate per unit.
(When inventory increases: absorption profit > marginal profit. When inventory falls: absorption profit < marginal profit.)

OVERHEAD ABSORPTION:
Budgeted OAR = Budgeted fixed overhead / Budgeted activity (machine hours or labour hours — state which).
Absorbed overhead = OAR × Actual activity.
Under/over absorption = Absorbed overhead - Actual overhead incurred.
Over-absorption: actual activity > budgeted OR actual overhead < budgeted (credit to P&L).
Under-absorption: actual activity < budgeted OR actual overhead > budgeted (debit to P&L).

ALL STANDARD COST VARIANCES (adverse = A, favourable = F):
Material price variance = (Standard price - Actual price) × Actual quantity purchased.
Material usage variance = (Standard quantity for actual production - Actual quantity used) × Standard price.
Labour rate variance = (Standard rate - Actual rate) × Actual hours paid.
Labour efficiency variance = (Standard hours for actual production - Actual hours worked) × Standard rate.
Variable overhead expenditure variance = (Standard variable OH rate × Actual hours worked) - Actual variable OH.
Variable overhead efficiency variance = (Standard hours for actual production - Actual hours worked) × Standard variable OH rate.
Fixed overhead expenditure variance = Budgeted fixed OH - Actual fixed OH.
Fixed overhead volume variance = Absorbed fixed OH - Budgeted fixed OH (absorption costing only).
Fixed overhead capacity variance = (Actual hours worked - Budgeted hours) × Standard fixed OH rate.
Fixed overhead efficiency variance = (Standard hours for actual production - Actual hours worked) × Standard fixed OH rate.

BUDGETING:
Flexed budget: restate fixed budget at actual volume level — variable costs flex, fixed costs do not.
Zero-based budgeting: justify every cost from scratch each period — no base budget.
Activity-based budgeting: use cost drivers to set budgets — aligned to ABC costing.
Rolling budget: continuously updated — drop earliest period, add future period.

COMMON CONFUSIONS:
- Material price variance: applied to quantity PURCHASED not quantity used — students apply to used quantity
- Adverse vs favourable signs: actual cost > standard = adverse (spend more = bad); actual hours < standard = favourable efficiency (do it faster = good)
- Absorption profit vs marginal profit reconciliation: students confuse direction of adjustment with inventory movement
- OAR: must use BUDGETED figures for both numerator and denominator — actual figures give actual rate not OAR
`,

  'Audit and Assurance': `
AUDIT AND ASSURANCE — TECHNICAL STANDARDS:

AUDIT RISK MODEL:
Audit risk = Inherent risk × Control risk × Detection risk.
Inherent risk: susceptibility of an assertion to material misstatement ignoring controls (complexity, judgement, related parties, management bias, industry risk).
Control risk: risk that misstatement would not be prevented or detected by internal controls.
Detection risk: risk that auditor's procedures fail to detect material misstatement. Auditor controls detection risk through nature, timing, and extent of procedures.
Higher inherent/control risk → lower acceptable detection risk → more/better audit evidence needed.

KEY ISA REFERENCES (state by number):
ISA 200: Overall objectives of the independent auditor.
ISA 210: Agreeing terms of audit engagement.
ISA 220: Quality management for audit.
ISA 230: Audit documentation.
ISA 240: Auditor's responsibilities relating to fraud — distinguish error (unintentional) from fraud (intentional). Management override of controls is key fraud risk.
ISA 250: Laws and regulations.
ISA 260: Communication with those charged with governance.
ISA 265: Communicating deficiencies in internal control.
ISA 300: Planning an audit.
ISA 315: Identifying and assessing risks of material misstatement — understand entity, environment, internal control.
ISA 320: Materiality — planning materiality (typically 1-2% revenue or 5-10% profit before tax or 1-2% total assets), performance materiality set below planning materiality.
ISA 330: Auditor's responses to assessed risks — tests of controls, substantive procedures.
ISA 402: Audit considerations relating to entities using service organisations.
ISA 450: Evaluation of misstatements.
ISA 500: Audit evidence — sufficient (quantity) and appropriate (quality: relevance + reliability).
ISA 505: External confirmations.
ISA 510: Initial audit engagements — opening balances.
ISA 520: Analytical procedures.
ISA 530: Audit sampling.
ISA 540: Auditing accounting estimates.
ISA 550: Related parties.
ISA 560: Subsequent events — adjusting vs non-adjusting distinction mirrors IAS 10.
ISA 570: Going concern — indicators (financial, operational, other); obtain sufficient appropriate evidence; evaluate management's assessment.
ISA 580: Written representations.
ISA 600: Audits of group financial statements.
ISA 620: Using the work of an auditor's expert.
ISA 700: Forming an opinion and reporting.
ISA 701: Key audit matters (listed entities).
ISA 705: Modifications to opinion — qualified (material but not pervasive), adverse (material and pervasive), disclaimer (unable to obtain sufficient appropriate evidence, effects could be material and pervasive).
ISA 706: Emphasis of matter paragraphs.
ISA 710: Comparative information.
ISA 720: Other information in documents containing audited financial statements.
ISA 800/805: Special purpose frameworks.

AUDIT ASSERTIONS:
For classes of transactions: occurrence, completeness, accuracy, cut-off, classification.
For account balances: existence, completeness, rights and obligations, accuracy/valuation/allocation.
For presentation and disclosure: occurrence and rights/obligations, completeness, classification/understandability, accuracy/valuation.
Direction of testing matters: completeness (trace from records to source — test for omissions); existence/occurrence (trace from financial statements back to source documents — test for overstatement).

AUDIT PROCEDURES:
Inspection (documents and tangible assets), Observation, Inquiry (weakest alone — needs corroboration), Confirmation (external — strongest for receivables), Recalculation, Reperformance, Analytical procedures.
Tests of controls: test operating effectiveness of controls. Substantive procedures: test amounts and disclosures.

COMMON CONFUSIONS:
- Students give vague procedures ("check invoices") — always state: what document, what assertion, what the auditor looks for
- Students confuse direction of testing for completeness vs existence — completeness tests outward from records; existence tests inward from statements
- ISA 570 going concern: auditor evaluates management's assessment — does not perform their own independent going concern assessment
- ISA 705: qualified opinion = material but NOT pervasive (disagree on one item); adverse = material AND pervasive (statements misleading overall); disclaimer = cannot obtain sufficient appropriate evidence
`,

  'Taxation': `
TAXATION — TECHNICAL STANDARDS:

CRITICAL CAVEAT RULE — MANDATORY ON ALL TAX CONTENT:
Every rate, threshold, allowance, and band cited must carry an explicit note that it is illustrative and should be verified against current HMRC guidance or official authority for the jurisdiction. State the tax year assumed (e.g. "Using illustrative UK rates — verify with current authority").

UK TAX FRAMEWORK (illustrative — verify current rates):
Income tax: personal allowance (illustrative: £12,570); basic rate band (illustrative: 20% on £12,571-£50,270); higher rate (illustrative: 40% on £50,271-£125,140); additional rate (illustrative: 45% above £125,140). Personal allowance tapered: £1 reduction per £2 over £100,000 income.
National Insurance: Class 1 employee (illustrative: 12% on earnings between primary and upper thresholds, 2% above); Class 1 employer (illustrative: 13.8% above secondary threshold); Class 2 and 4 for self-employed. NIC is NOT income tax — separate calculation.
Corporation tax: illustrative main rate applies to profits above £250,000; small profits rate for profits up to £50,000; marginal relief for £50,001-£250,000. Associated companies affect thresholds.
VAT: standard rate 20%, reduced rate 5%, zero rate 0%. Exempt supplies (no input tax recovery on costs relating to exempt supplies). Partial exemption: de minimis rules.
Capital gains: annual exempt amount (illustrative); residential property rate vs other asset rate. Business Asset Disposal Relief (illustrative: 10% up to lifetime limit). Chattel exemption and wasting chattel rules.

INCOME TAX COMPUTATION STRUCTURE:
Gross income → less allowable reliefs → statutory total income → less personal allowance → taxable income → apply bands to get income tax liability → less tax reducers → income tax payable.
Trading income: adjusted profit (start with accounting profit, add back disallowable expenditure, deduct capital allowances). Capital allowances: Annual Investment Allowance (AIA), main pool writing down allowance (illustrative: 18%), special rate pool (illustrative: 6%), first year allowances.
Employment income: salary + benefits in kind. Benefits: company car (illustrative: list price × CO2 percentage), fuel benefit, private medical, use of assets (20% of annual value).

CORPORATION TAX:
Accounting period usually = accounting year. Payment dates vary by size (small: 9 months and 1 day after year end; large: quarterly instalments). Associated companies affect thresholds and payment obligations.
Chargeable gain for companies: disposal proceeds - allowable costs - indexation allowance (for periods before indexation frozen). No annual exempt amount for companies.

COMMON CONFUSIONS:
- NIC is not collected through income tax — separate calculation with different thresholds
- Exempt vs zero-rated VAT: exempt = no VAT charged, no input tax recovery; zero-rated = no VAT charged, but input tax on related costs IS recoverable
- Personal allowance tapering: starts at £100,000 not £125,140
- Corporation tax: no personal allowance; gains taxed at corporation tax rates not CGT rates
- Capital allowances: AIA applies to both plant and machinery and integral features; WDA only after AIA used
`,

  'Financial Management': `
FINANCIAL MANAGEMENT — TECHNICAL STANDARDS:

TIME VALUE OF MONEY:
Present value: PV = FV / (1+r)^n. Annuity factor: [1-(1+r)^-n] / r. Perpetuity: CF / r. Growing perpetuity: CF / (r-g).
All discount factors calculated to stated decimal places — do not round intermediate workings.
Real vs nominal: (1 + nominal rate) = (1 + real rate) × (1 + inflation rate) — Fisher equation. Use nominal cash flows with nominal rate; real cash flows with real rate — never mix.

INVESTMENT APPRAISAL:
NPV: sum of present values of all cash flows including initial investment (negative). Positive NPV = accept (increases shareholder wealth). NPV of mutually exclusive projects: choose highest positive NPV.
IRR: discount rate at which NPV = 0. Accept if IRR > cost of capital. IRR by interpolation: IRR ≈ L + [NPV_L / (NPV_L - NPV_H)] × (H - L) where L = lower rate, H = higher rate.
MIRR: more reliable than IRR for non-conventional cash flows. MIRR = [(FV of reinvested inflows / PV of investment outflows)^(1/n)] - 1.
Payback: time to recover initial investment from net cash inflows. Simple and discounted payback. Limitation: ignores time value and post-payback cash flows.
ROCE (accounting rate of return): Average annual accounting profit / Average investment × 100.

WACC AND CAPITAL STRUCTURE:
WACC = (Ke × Ve/(Ve+Vd)) + (Kd(1-t) × Vd/(Ve+Vd)). Use MARKET VALUES (not book values) for Ve and Vd.
Cost of equity — dividend growth model: Ke = (D1/P0) + g where D1 = D0(1+g), g estimated from historic growth or retention ratio × ROE.
Cost of equity — CAPM: Ke = Rf + β(Rm - Rf). β is systematic (market) risk only. Rf = risk-free rate. (Rm - Rf) = equity risk premium.
Cost of debt: post-tax. Irredeemable: Kd = Interest(1-t) / Market value. Redeemable: IRR of after-tax cash flows to redemption.
Modigliani-Miller (with tax): VL = VU + TD. Gearing increases firm value due to tax shield on debt interest (up to financial distress costs).

BETA AND GEARING:
Ungearing beta: βa = βe × [Ve/(Ve + Vd(1-t))]. Regearing: βe = βa × [Ve + Vd(1-t)] / Ve.
When appraising a project in a new industry: ungear the proxy company's beta, regear at the investing company's capital structure.

WORKING CAPITAL:
Operating cycle (days) = Inventory days + Receivables days - Payables days.
Inventory days = (Inventory / Cost of sales) × 365. Receivables days = (Receivables / Revenue) × 365. Payables days = (Payables / Cost of sales) × 365.
EOQ = √(2CoD/Ch) where Co = ordering cost per order, D = annual demand, Ch = holding cost per unit per year.
Factoring: with recourse (credit risk stays with company) vs without recourse (factor takes credit risk). Invoice discounting: confidential, company retains sales ledger.

FOREIGN EXCHANGE:
Direct quote (domestic per foreign) vs indirect quote (foreign per domestic).
Forward rate: higher forward rate = currency at forward discount (worth less in future).
PPP: expected exchange rate = spot × (1 + domestic inflation) / (1 + foreign inflation).
Interest rate parity: forward rate = spot × (1 + domestic interest rate) / (1 + foreign interest rate).
Hedging: forward contract (certain rate), money market hedge (borrow/invest to create natural hedge), options (right but not obligation — pay premium, retain upside).

COMMON CONFUSIONS:
- Nominal vs real rates: students mix cash flows and discount rates from different bases — always pair nominal with nominal, real with real
- IRR interpolation: students use book value debt in WACC — always use market values
- Beta ungearing/regearing: students forget the (1-t) tax shield term in the formula
- WACC: students use book values not market values — always state market value weightings
- Forward exchange: students misread which currency is at premium/discount
`,

  'Performance Management': `
PERFORMANCE MANAGEMENT — TECHNICAL STANDARDS:

ADVANCED VARIANCE ANALYSIS:
All ten standard cost variances as stated in Management Accounting context.
Planning vs operational variances: separate variances into those caused by poor planning (planning variance — not controllable by operations) and those caused by operational performance (operational variance — controllable). Planning variance = revised standard vs original standard. Operational variance = actual vs revised standard.
Mix and yield variances: for multi-input processes.
Material mix variance = (Actual total quantity in standard mix - Actual total quantity in actual mix) × Standard cost per unit.
Material yield variance = (Actual yield - Standard yield from actual input) × Standard cost per unit of output.
Sales mix variance and sales quantity variance: split the sales volume variance.

ACTIVITY-BASED COSTING (ABC):
Identify activities → assign costs to cost pools → identify cost drivers → calculate cost driver rates → assign costs to products.
ABC vs traditional absorption: products using more of the cost driver bear more overhead. High-volume simple products under-costed by traditional; low-volume complex products over-costed.
ABC better reflects economic reality of overhead consumption — supports better pricing and product mix decisions.

BALANCED SCORECARD (Kaplan and Norton):
Four perspectives: Financial (lag indicators — ROI, profit, revenue growth), Customer (satisfaction, retention, market share, acquisition), Internal Business Process (efficiency, quality, innovation, cycle time), Learning and Growth (employee skills, systems, organisational culture).
Cause and effect linkages: improved learning → better processes → improved customer outcomes → improved financial results.
Strategy maps: visual representation of cause-and-effect relationships across all four perspectives.

FITZGERALD AND MOON — PERFORMANCE MEASUREMENT IN SERVICES:
Results dimensions: Competitiveness (relative market performance), Financial performance.
Determinants dimensions: Quality of service, Flexibility, Resource utilisation, Innovation.
Dimensions and standards and rewards framework: standards must be achievable, fair, and linked to rewards.

DIVISIONAL PERFORMANCE MEASURES:
ROI = Profit / Capital employed × 100. Higher ROI = better. Risk: division rejects positive NPV projects that would lower divisional ROI below current level (dysfunctional behaviour).
RI = Profit - (Capital employed × Cost of capital). Higher RI = better. Advantage: divisions accept all projects with positive RI — congruent with firm's NPV maximisation.
EVA = NOPAT - (WACC × Capital invested). NOPAT = Net operating profit after tax. Adjustments to accounting profit: R&D capitalised, operating leases capitalised, goodwill amortisation added back. EVA aligns divisional decisions with shareholder value creation.

TRANSFER PRICING:
General rule: Transfer price = Marginal cost of transferring division + Opportunity cost per unit to transferring division.
When transferring division has spare capacity: TP = Marginal cost (no opportunity cost).
When at full capacity: TP = Marginal cost + Contribution lost per unit (contribution forgone from lost external sales).
Negotiated range: minimum TP = transferring division's floor; maximum TP = receiving division's ceiling (external market price or NRV of output).
Dual pricing: transferring division credits market price; receiving division debits marginal cost — difference eliminated on consolidation.

COMMON CONFUSIONS:
- ROI vs RI for investment decisions: ROI leads to rejection of positive NPV projects when project ROI < current divisional ROI; RI avoids this — always use RI or EVA for new investment decisions
- ABC cost driver rates: students divide total costs by number of products — must divide cost pool by volume of cost driver
- Balanced scorecard perspectives: students list four perspectives but fail to show cause-and-effect linkages — the linkages are the intellectual content
- Transfer pricing at full capacity: students quote marginal cost — must add opportunity cost when division is at full capacity
`,

  'Strategic Business': `
STRATEGIC BUSINESS — TECHNICAL STANDARDS:

EXTERNAL ANALYSIS FRAMEWORKS:
PESTLE: Political, Economic, Social, Technological, Legal, Environmental. Each factor should be specific to the scenario — generic PESTLE lists score poorly. Identify the IMPACT on the organisation, not just the factor.
Porter's Five Forces: Threat of new entrants (barriers to entry: capital requirements, economies of scale, brand loyalty, switching costs, regulatory barriers), Bargaining power of suppliers (concentration, switching costs, forward integration threat), Bargaining power of buyers (volume, switching costs, backward integration threat), Threat of substitutes (price-performance trade-off), Competitive rivalry (concentration, differentiation, exit barriers, growth rate). Conclusion: overall industry attractiveness.
Porter's Value Chain: Primary activities (inbound logistics, operations, outbound logistics, marketing and sales, service); Support activities (firm infrastructure, HR management, technology development, procurement). Margin = Value created - Cost. Identify where competitive advantage is built.

STRATEGIC OPTIONS FRAMEWORKS:
Ansoff Matrix: Market penetration (existing markets, existing products — lowest risk), Market development (new markets, existing products), Product development (new products, existing markets), Diversification (new products, new markets — highest risk, related vs unrelated).
BCG Matrix: Stars (high growth, high share — invest), Cash cows (low growth, high share — harvest), Question marks (high growth, low share — invest or divest), Dogs (low growth, low share — divest). Limitation: only uses two dimensions; market share does not always indicate competitive advantage.
SWOT: Internal strengths and weaknesses; external opportunities and threats. TOWS analysis: match strengths to opportunities (SO), strengths to threats (ST), address weaknesses with opportunities (WO), minimise weaknesses and threats (WT).

COMPETITIVE STRATEGY (Porter's Generic Strategies):
Cost leadership: lowest cost producer in the industry — not lowest price but lowest cost. Requires sustained cost advantages. Stuck in the middle = no sustainable competitive advantage.
Differentiation: product/service perceived as unique by buyers. Premium price justified by perceived value. Difficult to sustain without continued investment.
Focus (cost or differentiation): serve a narrow segment better than broad competitors.

STAKEHOLDER MANAGEMENT:
Mendelow's power/interest matrix: High power, high interest = Key players (manage closely); High power, low interest = Keep satisfied; Low power, high interest = Keep informed; Low power, low interest = Minimal effort.
Stakeholder mapping informs communication strategy and risk management.

RISK AND ETHICS:
COSO framework: Control environment, Risk assessment, Control activities, Information and communication, Monitoring. Enterprise risk management extends this.
Risk appetite: amount of risk an organisation is willing to accept in pursuit of its strategy.
Professional ethics: integrity, objectivity, professional competence, confidentiality, professional behaviour (IESBA fundamental principles). Threats: self-interest, self-review, advocacy, familiarity, intimidation. Safeguards: profession-wide, firm-wide, engagement-specific.

CRITICAL APPLICATION RULE:
Marks are awarded for APPLICATION to the specific scenario — not for defining frameworks. A response that defines PESTLE without applying it to the organisation scores poorly. Always: identify the factor → explain why it matters to THIS organisation → state the strategic implication or required response.
`,

  'Bookkeeping': `
BOOKKEEPING — TECHNICAL STANDARDS:

FUNDAMENTAL DEBIT/CREDIT RULES:
Assets: increase with DEBIT, decrease with CREDIT. (Cash, receivables, inventory, PPE, prepayments.)
Liabilities: increase with CREDIT, decrease with DEBIT. (Trade payables, accruals, loans, VAT payable.)
Equity: increase with CREDIT, decrease with DEBIT. (Capital, retained earnings, share capital.)
Income/Revenue: increase with CREDIT, decrease with DEBIT. (Sales, rental income, interest received.)
Expenses: increase with DEBIT, decrease with CREDIT. (Purchases, wages, rent, depreciation charge.)
Drawings (sole trader/partnership): increase with DEBIT (treated like an asset/expense for posting purposes).

SOURCE DOCUMENTS AND DAYBOOKS:
Sales invoice → Sales day book → DEBIT sales ledger control account, CREDIT VAT account and sales account.
Purchase invoice → Purchases day book → CREDIT purchases ledger control account, DEBIT VAT account and purchases account.
Credit note received → Purchases returns day book → DEBIT purchases ledger control account, CREDIT purchases returns.
Credit note issued → Sales returns day book → CREDIT sales ledger control account, DEBIT sales returns.
Cash receipts → Cash receipts book → DEBIT cash/bank, CREDIT appropriate accounts.
Cash payments → Cash payments book → CREDIT cash/bank, DEBIT appropriate accounts.
Petty cash → Petty cash book → imprest system: top up to fixed float. DEBIT expenses, CREDIT petty cash.

VAT ACCOUNTING:
Output VAT (on sales): liability — CREDIT VAT control account.
Input VAT (on purchases): asset — DEBIT VAT control account.
VAT payable to HMRC = Output VAT - Input VAT. If negative: VAT repayment from HMRC.
Standard rate 20% (illustrative — verify current rate). VAT-inclusive price ÷ 1.2 = VAT-exclusive price. VAT amount = VAT-inclusive price × 1/6.

LEDGER ACCOUNTS AND TRIAL BALANCE:
Post every transaction to at least two accounts. Balance T-accounts: total both sides, larger side total goes on both sides, difference is the balance (carried down on larger side, brought down on smaller side).
Trial balance: list all ledger balances — debit balances in debit column, credit balances in credit column. Total debits = total credits if no errors.
Errors NOT revealed by trial balance: error of omission, error of commission, error of principle, compensating errors, error of original entry, reversal of entries.
Errors REVEALED by trial balance: transposition error (if digits reversed, usually single entry), partial entry (one side of entry missing), casting error on one side only.

BANK RECONCILIATION PROCEDURE:
1. Update cash book for items on bank statement not in cash book (direct debits, bank charges, interest, dishonoured cheques).
2. Corrected cash book balance = balance to appear in financial statements.
3. Reconcile to bank statement: Bank statement balance + Outstanding lodgements - Unpresented cheques = Corrected cash book balance.

COMMON CONFUSIONS:
- Credit sale: DEBIT trade receivables (asset increases), CREDIT sales (income increases) — NOT the other way.
- Discount allowed (given to customer): DEBIT discount allowed (expense), CREDIT trade receivables.
- Discount received (received from supplier): DEBIT trade payables, CREDIT discount received (income).
- Contra entry: trade receivable is also a supplier — DEBIT trade payables, CREDIT trade receivables. No cash involved.
- Depreciation posting: DEBIT depreciation charge (expense), CREDIT accumulated depreciation (contra-asset) — do NOT credit the asset account directly (unless using simple T-account).
`,

  'Corporate Reporting': `
CORPORATE REPORTING — TECHNICAL STANDARDS:

COMPLEX GROUP ACCOUNTING:
IFRS 3 goodwill — full goodwill method: Goodwill = Fair value of consideration transferred + Fair value of NCI at acquisition - Fair value of net identifiable assets. NCI at fair value includes NCI's share of goodwill.
IFRS 3 goodwill — proportionate NCI method: Goodwill = Fair value of consideration transferred - Parent's share of fair value of net identifiable assets. NCI does not include goodwill under this method.
NCI in statement of financial position: NCI at acquisition + NCI share of post-acquisition retained earnings +/- NCI share of post-acquisition OCI movements.
Intragroup eliminations: eliminate 100% of intragroup sales and purchases; unrealised profit on intragroup inventory (PURP) eliminated in full with adjustment to NCI if subsidiary is seller.
Step acquisitions: on obtaining control, remeasure previously held interest to fair value through P&L. Goodwill calculated at date control obtained.
Disposal: derecognise assets and liabilities; derecognise NCI; recognise proceeds; recognise remaining interest at fair value if losing control; gain/loss in P&L.

IAS 28 EQUITY METHOD (ASSOCIATES):
Initial recognition: investment at cost. Post-acquisition: increase for investor's share of profit, decrease for share of loss, adjust for share of OCI movements.
Carrying amount: Cost + Share of post-acquisition retained earnings +/- Share of post-acquisition OCI.
Impairment of investment in associate: assessed as a single asset (not individual underlying assets).

IAS 12 DEFERRED TAX:
Temporary differences (NOT timing differences — IFRS uses temporary differences): difference between carrying amount of asset/liability and tax base.
Taxable temporary difference → deferred tax LIABILITY (carrying amount > tax base for assets).
Deductible temporary difference → deferred tax ASSET (carrying amount < tax base for assets) — recognise only if probable future taxable profits available.
Business combinations: recognise deferred tax on fair value adjustments to identifiable assets and liabilities — this increases goodwill.

IFRS 9 ECL MODEL:
Stage 1: No significant increase in credit risk since origination — 12-month ECL.
Stage 2: Significant increase in credit risk since origination — lifetime ECL.
Stage 3: Credit-impaired — lifetime ECL; interest revenue on net carrying amount only (not gross).
ECL = Probability of default × Exposure at default × Loss given default.

IFRS 2 SHARE-BASED PAYMENT:
Equity-settled: measure at fair value of equity instrument at grant date; expense over vesting period; no remeasurement after grant date. Cumulative charge = (Fair value at grant × Total expected to vest / Total vesting period × Years elapsed).
Cash-settled: measure at fair value of liability at each reporting date; remeasure at every year end until settlement. This creates P&L volatility.

COMMON CONFUSIONS:
- Goodwill impairment: once goodwill is impaired it cannot be reversed (contrast with other assets under IAS 36)
- Deferred tax: students calculate timing differences (old UK GAAP approach) instead of temporary differences
- IFRS 9 stages: students recognise lifetime ECL immediately on origination — Stage 1 is 12-month ECL only
- Equity-settled vs cash-settled SBP: students remeasure equity-settled instruments — only cash-settled instruments are remeasured
- NCI in step acquisition: students forget to remeasure previously held interest to fair value when control is obtained
`,

  'Business Economics': `
BUSINESS ECONOMICS — TECHNICAL STANDARDS:

MICROECONOMICS:
Supply and demand: equilibrium where quantity supplied = quantity demanded. Price mechanism allocates resources. Shifts vs movements along curves: price → movement along curve; non-price factor (income, tastes, input costs, technology) → shift of curve.
Elasticity: Price elasticity of demand (PED) = % change in quantity demanded / % change in price. |PED| > 1 = elastic; |PED| < 1 = inelastic; |PED| = 1 = unit elastic. Elastic demand → price rise reduces total revenue. Inelastic demand → price rise increases total revenue.
Income elasticity of demand (YED): positive = normal good; negative = inferior good; YED > 1 = luxury.
Cross-price elasticity: positive = substitutes; negative = complements.
Market structures: Perfect competition (price takers, normal profit long run, P = MC), Monopolistic competition (short-run supernormal profit, long-run normal profit, brand differentiation), Oligopoly (interdependence, price rigidity, kinked demand, collusion risk, game theory), Monopoly (price setter, supernormal profit sustained, welfare loss, natural monopoly justifies regulation).

MACROECONOMICS:
National income: GDP (output = expenditure = income approaches). GDP = C + I + G + (X-M). Circular flow of income: injections (investment I, government spending G, exports X) vs withdrawals (savings S, taxes T, imports M). Equilibrium: injections = withdrawals.
Multiplier: 1 / (1 - MPC) = 1 / MPS (in closed economy with no government). In open economy: 1 / (MPS + MPT + MPM).
Aggregate demand (AD) and aggregate supply (AS): equilibrium determines national output and price level. AD = C + I + G + (X-M). LRAS vertical (natural rate of output). SRAS upward sloping.
Business cycle: boom, slowdown, recession (two consecutive quarters of negative GDP growth), recovery. Leading, lagging, and coincident indicators.

FISCAL AND MONETARY POLICY:
Fiscal policy: government spending and taxation. Expansionary (increase G, cut T) → increases AD. Contractionary → decreases AD. Automatic stabilisers: unemployment benefits (rise in recession, reducing fall in AD), progressive taxation.
Monetary policy: interest rates (central bank tool). Higher interest rates → higher cost of borrowing → lower consumption and investment → lower AD → lower inflation. Quantitative easing: central bank purchases assets to increase money supply.
Inflation: demand-pull (AD too high) vs cost-push (SRAS shifts left). Target: UK illustrative 2% CPI. Phillip's curve: short-run trade-off between unemployment and inflation; long-run vertical (natural rate of unemployment).

INTERNATIONAL TRADE AND EXCHANGE RATES:
Comparative advantage: country should specialise in good with lowest opportunity cost — not necessarily the absolute cheapest producer.
Terms of trade: index of export prices / index of import prices × 100. Improvement = exports buy more imports.
Balance of payments: current account (trade in goods and services, income, transfers), capital account, financial account. Current account deficit financed by capital/financial account surplus.
Exchange rate: appreciation → exports more expensive, imports cheaper → worsens trade balance (J-curve effect short term). Depreciation → exports cheaper, imports more expensive → Marshall-Lerner condition: sum of price elasticities of demand for exports and imports must exceed 1 for depreciation to improve current account.

APPLICATION RULE:
Marks are awarded for applying economic concepts to the specific scenario described. A generic definition of comparative advantage scores poorly without applying it to the actual countries and goods in the scenario. Always: state the principle → calculate or identify how it applies to the given numbers/context → state the implication for the decision or policy.
`,

  'Law and Ethics': `
LAW AND ETHICS — TECHNICAL STANDARDS:

CONTRACT LAW:
Essential elements: offer (clear, certain, communicated), acceptance (unconditional, mirror image, communicated), consideration (something of value, past consideration not valid, adequacy not required but sufficiency required), intention to create legal relations (commercial = presumed; domestic/social = presumed not), capacity (companies, minors, mental incapacity).
Invitation to treat vs offer: advertisements, price lists, goods on display = invitation to treat (not offers). Fisher v Bell principle. Counter-offer kills original offer (Hyde v Wrench).
Termination of offer: revocation (before acceptance, must be communicated), rejection, counter-offer, lapse of time, death, failure of condition.
Vitiating factors: misrepresentation (false statement of fact inducing contract — innocent, negligent, fraudulent; remedies: rescission ± damages), mistake (common, mutual, unilateral — narrow circumstances for void contract), duress (economic duress now recognised), undue influence, illegality.
Breach of contract: actual breach (refusal to perform) vs anticipatory breach (advance notice of non-performance). Remedies: damages (put claimant in position had contract been performed — expectation loss; Hadley v Baxendale remoteness rule), specific performance (equitable, not awarded where damages adequate), injunction, quantum meruit.

COMPANY LAW:
Separate legal personality: Salomon v Salomon & Co Ltd — company is distinct legal person from its members. Lifting the corporate veil: fraud, sham, agency, group structures in limited circumstances.
Types of company: private limited (Ltd), public limited (plc — minimum share capital illustrative requirement), unlimited, community interest.
Directors' duties (Companies Act 2006 codification): act within powers, promote success of the company (s.172 — have regard to: long-term consequences, employees, suppliers, community, environment, reputation, fairness to members), exercise independent judgement, exercise reasonable care skill and diligence (objective + subjective test), avoid conflicts of interest, not accept benefits from third parties, declare interest in proposed transaction.
Shareholders' rights: vote at general meetings, receive dividends if declared, receive information, pre-emption rights on new share issues (may be disapplied).

EMPLOYMENT LAW:
Employee vs independent contractor: control test, integration test, economic reality test — distinction matters for tax, NIC, employment rights.
Key employment rights: minimum wage (illustrative rate — verify current), working time regulations (48-hour average week, rest breaks, paid annual leave), unfair dismissal (continuous employment threshold — illustrative, verify current), redundancy pay, discrimination law.
Protected characteristics (Equality Act 2010): age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, sexual orientation.

PROFESSIONAL ETHICS:
IESBA (International Ethics Standards Board for Accountants) fundamental principles: Integrity (honest and straightforward), Objectivity (no bias or conflicts), Professional competence and due care (maintain knowledge, act diligently), Confidentiality (do not disclose without authority or legal/professional right), Professional behaviour (comply with laws, do not discredit profession).
Threats to fundamental principles: Self-interest (financial interest in client outcome), Self-review (reviewing own prior work), Advocacy (promoting client position to point of compromising objectivity), Familiarity (close relationship causing loss of objectivity), Intimidation (deterred from acting objectively by threats).
Safeguards: profession-wide (education, CPD, professional standards, disciplinary procedures), firm-wide (quality control, ethics partners, rotation policies), engagement-specific (additional review, separate teams, disclosure to those charged with governance).
Money laundering: three stages (placement, layering, integration). Reporting obligations: suspicious activity report (SAR) to NCA. Tipping-off offence: must not tell client that a SAR has been filed. Failure to report is also an offence.
Whistleblowing: protected disclosure (qualifying disclosure in reasonable belief, to prescribed person). Public Interest Disclosure Act protections.

COMMON CONFUSIONS:
- Invitation to treat vs offer: students say a shop display is an offer — it is an invitation to treat; the customer makes the offer at the till
- Directors' duties: students cite fiduciary duty generally — must identify the specific codified duty from Companies Act 2006
- Confidentiality: not absolute — legal/professional right to disclose overrides (court order, professional body request, public interest, anti-money laundering reporting obligation)
- Unfair dismissal vs wrongful dismissal: unfair = statutory right, employment tribunal; wrongful = breach of contract, court claim, no qualifying period
`,

  'default': `
TECHNICAL ACCURACY — GENERAL STANDARDS:
All calculations must be verified. All accounting entries must balance (debits = credits).
All references to standards, rates, or thresholds must be caveated as illustrative and subject to change.
All invented figures must be specific and non-round. All invented company names must be realistic.
Explanations must teach — not just state the correct answer.
`,

  'ETICPA / CPA': `
QUALIFICATION PROFILE — ETICPA CPA (internal calibration only):
Established under Proclamation No. 1372/2025, the ETiCPA CPA is Ethiopia's national professional accounting credential. The detailed examination syllabus is under active development as of 2026. Questions must therefore be calibrated to the broad professional competency domains of the qualification: financial reporting under IFRS as adopted in Ethiopia, audit and assurance under ISAs, Ethiopian taxation under ERCA, management accounting, and professional ethics under IFAC standards.

EXAM STRUCTURE AWARENESS:
- Examination format is under development. Calibrate to professional-level constructed response and scenario-based questions appropriate for a CPA-level candidate.
- Difficulty register: Foundation questions test knowledge and application. Intermediate questions require multi-step reasoning and Ethiopian context application. Advanced questions require professional judgement, evaluation, and advisory responses.

QUESTION CALIBRATION:
- All scenarios must use Ethiopian Birr (ETB) as currency.
- All business scenarios must reference Ethiopian companies, Ethiopian regulatory bodies (ERCA, AABE), and Ethiopian commercial law.
- Financial reporting questions must reference IFRS standards by number and title, applied to Ethiopian public interest entities.
- Taxation questions must reference ERCA, Ethiopian income tax schedules (Schedule A for employment, Schedule C for business), VAT under Ethiopian VAT Proclamation, and withholding tax. Always caveat that rates are subject to change.
- Audit questions must reference ISAs by number and apply them to the Ethiopian regulatory environment.
- Ethics questions must reference the IFAC Code of Ethics / IESBA framework.
- Never mention ETiCPA or ETICPA in the question text or explanation. Use "professional accounting examination" or "CPA examination level" instead.
- MCQ distractors must reflect common errors in Ethiopian accounting practice — misapplication of IFRS to Ethiopian entities, ERCA filing errors, incorrect tax schedule classification.
`,

  'ETICPA / ATQ': `
QUALIFICATION PROFILE — ETICPA ATQ (internal calibration only):
The ETiCPA ATQ is a two-level qualification: Level 1 Foundation Technician and Level 2 Advanced Technician. Questions must be calibrated to the specific level and module selected.

LEVEL 1 — FOUNDATION TECHNICIAN (Introduction to Accounting, Cost Accounting, Business Skills, Ethiopian Business Law):
- Examination format: Structured assessments. Objective and short-answer questions.
- Difficulty register: Foundation only. Build from first principles. Every term defined before use. Ethiopian business context throughout.
- Introduction to Accounting: Double entry, books of prime entry, ledger accounts, trial balance, basic financial statements. Ethiopian Birr throughout.
- Cost Accounting: Cost classification, absorption costing basics, FIFO and weighted average inventory valuation.
- Business Skills: Professional communication, numeracy, teamwork, digital tools.
- Ethiopian Business Law: Ethiopian Commercial Code, types of business entity, contract law, employment law basics.
- MCQ distractors: Debit/credit confusion, incorrect cost classification, wrong entity type under Ethiopian Commercial Code.
- Never mention ETiCPA or ETICPA in question text. Use "accounting technician level" instead.

LEVEL 2 — ADVANCED TECHNICIAN (Financial Accounting, Management Accounting, Assurance Controls and Ethics, Ethiopian Taxation, Ethiopian Public Sector Accounting):
- Examination format: Scenario-based assessments. Constructed response and calculation questions.
- Difficulty register: Intermediate and Advanced. Assume Level 1 knowledge. Multi-step scenarios with Ethiopian business context.
- Financial Accounting: Full financial statements under IFRS for SMEs. Accruals, prepayments, depreciation, bad debts. Partnership and company accounts.
- Management Accounting: Marginal and absorption costing, contribution analysis, break-even, budgeting, variance analysis.
- Assurance Controls and Ethics: Internal controls, internal audit role, fraud prevention, IFAC Code of Ethics.
- Ethiopian Taxation: ERCA administration, Schedule A employment income tax, Schedule C business income tax (presumptive and actual), VAT, withholding tax, turnover tax, filing obligations.
- Ethiopian Public Sector Accounting: IFMIS, cash vs accruals basis, government budget structure, public procurement.
- All scenarios use Ethiopian Birr. All tax scenarios reference ERCA and caveat rates as subject to change.
- MCQ distractors: IFRS for SMEs misapplication, wrong tax schedule, incorrect VAT treatment, public vs private sector accounting confusion.
- Never mention ETiCPA or ETICPA in question text. Use "accounting technician level" instead.
`,
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRACTOR ENGINEERING LIBRARY
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
// CALC TOKEN BUDGETS — Issue 2 fix
// Dynamic author budget based on count, type, and difficulty.
// Auditor budget tiered by question count.
// ═══════════════════════════════════════════════════════════════════════════════
function calcTokenBudgets(count: number, questionType: string, difficulty: string): { author: number; auditor: number } {
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
  const author  = Math.min(16000, Math.max(4000, Math.ceil(count * base * mult)))
  const auditor = count <= 10 ? 8000 : count <= 20 ? 12000 : 16000
  return { author, auditor }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD SLIM BUNDLE — Issue 1 fix
// Sends only stems, options, and correctIndex for all questions.
// Full explanations included for first 3 questions only.
// Prevents auditor token overflow on large batches.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildSlimBundle(bundle: any): any {
  return {
    title:    bundle.title,
    excerpt:  bundle.excerpt,
    cases:    bundle.cases,
    questions: (bundle.questions ?? []).map((q: any, i: number) => {
      if (i < 3) {
        // Full data for first 3 questions
        return q
      }
      // Slim: stem, options, correctIndex only — no explanation text
      return {
        id:           q.id,
        type:         q.type,
        questionText: q.questionText,
        options:      q.options,
        correctIndex: q.correctIndex,
        caseId:       q.caseId,
        primaryTopic: q.primaryTopic,
        difficulty:   q.difficulty,
      }
    }),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHOR PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildAuthorPrompt(cfg: {
  qualification: string; subject: string; topic: string
  questionType: string; difficulty: string; count: number
  framework: string; examBody: string; rounding: string; noiseLevel: string
}): string {

  const qualProfile  = QUALIFICATION_PROFILES[cfg.qualification] ?? QUALIFICATION_PROFILES.ACCA
  const subjectCtx   = SUBJECT_TECHNICAL_CONTEXT[cfg.subject] ?? SUBJECT_TECHNICAL_CONTEXT['default']
  const resolvedTier = TIER_MAP[cfg.qualification]?.[cfg.difficulty] ?? cfg.difficulty
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

  // Issue 6 fix — correct scenario case mathematics
  const casesNeeded   = Math.ceil(cfg.count / 4)
  const baseQPerCase  = Math.floor(cfg.count / casesNeeded)
  const remainder     = cfg.count - baseQPerCase * (casesNeeded - 1)

  const scenarioBlock = isScenario ? `
${SCENARIO_ENGINEERING}

CASE GROUPING FOR THIS BATCH:
- Generate ${casesNeeded} distinct case exhibits
- Cases 1 to ${casesNeeded - 1}: each has exactly ${baseQPerCase} linked questions
- Case ${casesNeeded} (final case): has exactly ${remainder} linked questions
- Total = ${cfg.count} questions across ${casesNeeded} cases
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

  // Issue 7 fix — correctIndex distribution instruction
  const correctIndexDistribution = (isMCQ || isScenario) ? `
CORRECT ANSWER POSITION DISTRIBUTION — MANDATORY:
Distribute correct answers evenly across positions 0, 1, 2, 3.
Across ${cfg.count} questions, aim for approximately equal use of each correctIndex value (0, 1, 2, 3).
Do NOT cluster correct answers at position 0 or any single position.
Do NOT use the same correctIndex for more than ${Math.ceil(cfg.count / 2)} questions in a batch.
Deliberately vary the position of the correct answer for every question.
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
PART 2 — TIER AND DIFFICULTY CALIBRATION
═══════════════════════════════════════════════════════
QUALIFICATION: ${cfg.qualification}
EXAM TIER: ${resolvedTier}
DIFFICULTY LEVEL: ${difficultySpec[cfg.difficulty] ?? difficultySpec.intermediate}

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

═══════════════════════════════════════════════════════
PART 5 — QUESTION CONSTRUCTION RULES
═══════════════════════════════════════════════════════

${isMCQ || isScenario ? DISTRACTOR_LIBRARY : ''}
${correctIndexDistribution}
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
PART 6 — ABSOLUTE PROHIBITIONS
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
// Uses slim bundle — Issue 1 fix
// ═══════════════════════════════════════════════════════════════════════════════
function buildAuditorPrompt(bundle: any, cfg: any): string {
  const slimBundle = bundle
  return `You are a Chief Examiner conducting a quality audit of a set of practice questions.
Your role is to identify any questions that fail to meet professional examination standards and specify exactly what must be fixed.

QUALIFICATION STANDARD: ${cfg.qualification}
EXAM TIER: ${TIER_MAP[cfg.qualification]?.[cfg.difficulty] ?? cfg.difficulty}
SUBJECT: ${cfg.subject || cfg.topic}
TOPIC: ${cfg.topic}
DIFFICULTY: ${cfg.difficulty}

NOTE: Full question data is provided for the first 3 questions. For remaining questions, stems, options, and correctIndex are provided — audit these for technical accuracy, distractor quality, and correctIndex validity.

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

EXPLANATION QUALITY (first 3 questions only):
[ ] Does the explanation use the required structure (OVERVIEW / METHOD / SOLUTION or OVERVIEW / WHY CORRECT / WHY OTHERS WRONG / KEY TAKEAWAY)?
[ ] Does the explanation explain WHY each wrong option is wrong?
[ ] Are calculations shown step by step with no backticks or code blocks?
[ ] Does the KEY TAKEAWAY capture a genuinely memorable professional insight?

QUESTION QUALITY:
[ ] Is the stem 3+ sentences with specific figures and company name?
[ ] Does the question test a DISTINCT sub-topic from other questions in the set?
[ ] Is the question at the correct difficulty level for ${TIER_MAP[cfg.qualification]?.[cfg.difficulty] ?? cfg.difficulty}?
[ ] Is the question original (not a reproduction of a known exam question)?

CORRECT INDEX DISTRIBUTION:
[ ] Are correctIndex values distributed across 0, 1, 2, 3 — not clustered at one position?

COMPLIANCE:
[ ] No professional body names mentioned (ACCA, CIMA, ICAEW, AAT, etc.)?
[ ] No backticks or code blocks anywhere?
[ ] No round numbers (all invented figures specific)?
[ ] No real company names?

BUNDLE TO AUDIT:
${JSON.stringify(slimBundle, null, 2)}

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
      // Issue 8 fix — flag placeholder options as validation errors
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
// COERCER — safe defaults on partial output
// Issue 8 fix: placeholder options flagged, NOT silently patched
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
      // Ensure exactly 4 options exist structurally
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        q.options = Array.isArray(q.options) ? [...q.options, ...Array(4).fill('—')].slice(0, 4) : ['—', '—', '—', '—']
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) q.correctIndex = 0
      // Deduplicate options — but do NOT replace '—' placeholders silently
      // Issue 8: placeholders are flagged by validateBundle as errors requiring regeneration
      const seen = new Set<string>()
      q.options = q.options.map((o: string, oi: number) => {
        const s = String(o ?? '').trim()
        if (!s) return `Option ${String.fromCharCode(65 + oi)}`
        // Only deduplicate non-placeholder options
        if (s === '—') return s
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

    // Calculate dynamic token budgets — Issue 2 fix
    const { author: authorBudget, auditor: auditorBudget } = calcTokenBudgets(
      Number(count), questionType, difficulty
    )

    // ── PASS 1: Author generates questions ───────────────────────────────────
    const authorPrompt = buildAuthorPrompt(cfg)

    const authorMessage = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: authorBudget,
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
    // Uses slim bundle (Issue 1 fix) and tiered token budget (Issue 2 fix)
    let auditErrors: string[] = []
    let fixedCount = 0

    try {
      const auditorPrompt = buildAuditorPrompt(bundle, cfg)
      const auditorMessage = await client.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: auditorBudget,
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
