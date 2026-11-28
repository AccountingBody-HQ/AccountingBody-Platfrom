// Level packs: how deep to write and how to pitch questions for each level of
// study. INTERNAL ONLY — the labels and the body names in these texts are
// calibration for the writer and never appear in published text.
import type { LevelId } from '../types'

export interface LevelPack {
  id: LevelId
  /** Internal label only; never in published text. */
  internalLabel: string
  /** How deep to write (from the content generator's qualification profiles). */
  depth: string
  /** How to pitch questions (from the question generator's profiles and tier map). */
  questionCalibration: string
}

const ACCA_DEPTH = `QUALIFICATION CALIBRATION — PROFESSIONAL ACCOUNTANCY (APPLIED KNOWLEDGE THROUGH STRATEGIC PROFESSIONAL):
This qualification spans three tiers with materially different demands at each.

APPLIED KNOWLEDGE TIER (Business and Technology, Management Accounting, Financial Accounting):
- Examination format: Computer-based, objective test questions and multi-task questions. Two hours.
- Content calibration: Build from first principles. Assume no prior accountancy knowledge at this tier. Define every term before using it. Prioritise procedural accuracy and conceptual clarity over nuance.
- Command verb register: identify, define, state, explain, describe, calculate, prepare, classify.
- Marking expectations: One or two marks per point. Accuracy of mechanics is paramount. Partial credit for correct method with arithmetic error.
- Worked example standard: Simple, single-issue scenarios. One company, one transaction type, clear numbers. Full journal entries and ledger postings where relevant.
- What students struggle with here: debit and credit confusion, accruals and prepayments mechanics, absorption costing allocation, marginal vs absorption profit differences.

APPLIED SKILLS TIER (Corporate and Business Law, Performance Management, Taxation, Financial Reporting, Audit and Assurance, Financial Management):
- Examination format: Computer-based, mix of objective test and constructed response questions. Three hours.
- Content calibration: Assume knowledge of fundamentals. Focus on application, multi-step reasoning, and the interaction between rules. Scenarios are more complex — a company with multiple issues, not a single clean transaction.
- Command verb register: calculate, prepare, apply, analyse, explain, compare, discuss, assess, interpret.
- Marking expectations: Mix of technical marks (calculations, identifications) and application marks (applying rules to the scenario). Professional marks awarded for structure and presentation in written questions.
- Worked example standard: Multi-step scenarios with realistic complexity. A company with adjustments, a tax computation with multiple sources of income, an audit with three or four risk areas.
- What students struggle with here: applying theory to unseen scenarios, time management across objective and written sections, missing the verb instruction (explain vs calculate vs discuss).

STRATEGIC PROFESSIONAL TIER (Strategic Business Leader, Strategic Business Reporting, plus two option papers):
- Examination format: Strategic Business Leader is a four-hour integrated case study. Strategic Business Reporting and options are three-hour constructed response. All handwritten or typed essay-format responses.
- Content calibration: Assume full technical competence in the underlying subject. Focus on evaluation, synthesis, professional judgement, and the ability to advise — not just describe. Scenarios involve ambiguity, competing options, and ethical dimensions.
- Command verb register: evaluate, advise, critically assess, recommend, justify, discuss with reference to, analyse the implications of, assess the risks of.
- Marking expectations: Professional marks for structure, clarity, and professional tone. Application marks for linking technical knowledge to the scenario. Judgment marks for reaching a defensible conclusion. Marks available for considering multiple perspectives.
- Worked example standard: Complex multi-entity scenarios. A group with subsidiaries in multiple jurisdictions. A company facing a restructuring with tax, financial reporting, and audit implications simultaneously. Board-level advisory context.
- What students struggle with here: failing to reach a conclusion (analysing without advising), writing technically correct content that does not answer the specific question asked, poor professional presentation, not allocating time proportionately to marks.`

const CIMA_DEPTH = `QUALIFICATION CALIBRATION — MANAGEMENT ACCOUNTANCY (OPERATIONAL THROUGH STRATEGIC):
This qualification is structured around three levels with increasing integration and strategic focus.

OPERATIONAL LEVEL (Enterprise Operations, Performance Operations, Financial Operations):
- Examination format: Objective test (OT) — 90-minute computer-based exams. Short and medium numerical and written questions.
- Content calibration: Breadth over depth at this level. Covers the full functional landscape of management accountancy — costing, financial accounting, technology, and business environment. Build from first principles. Clear procedural guidance.
- Command verb register: identify, calculate, prepare, classify, state, explain, describe, outline.
- Marking expectations: Objective marks for correct answers. No partial credit in OT format — accuracy of final answer is required. Method marks not available.
- Worked example standard: Clean, single-concept examples. Full variance analysis workings. Absorption vs marginal profit reconciliation. Step-by-step cash flow preparation.
- What students struggle with here: time pressure on OT format, confusing absorption and marginal approaches, working capital cycle calculations, mixing up standard cost card components.

MANAGEMENT LEVEL (Management Case Study sits across all three pillars):
- Examination format: OT for individual papers. Integrated Case Study exam (three hours) using pre-seen and unseen material.
- Content calibration: Apply and analyse. Assume Operational level knowledge. Focus on interpreting management accounting information, evaluating options, and identifying risks. Scenarios require candidates to connect financial and non-financial performance.
- Command verb register: analyse, evaluate, apply, interpret, assess, compare, identify risks, recommend.
- Marking expectations: Technical marks for correct calculations. Analytical marks for identifying the right issues in the scenario. Application marks for linking tools to the specific business context.
- Worked example standard: A business with a specific strategic problem. Activity-based costing revealing cross-subsidy between product lines. Transfer pricing dispute between divisions. Budgetary control with mix and yield variances.
- What students struggle with here: moving from calculation to interpretation, failing to identify what the numbers mean for the business, not using the pre-seen case context effectively.

STRATEGIC LEVEL (Strategic Case Study is the gateway to membership):
- Examination format: Objective test for individual papers. Strategic Case Study is a three-hour integrated exam requiring board-level advisory responses.
- Content calibration: Integrate and recommend. Assume full management accountancy competence. Content must connect financial strategy, risk management, and performance management into coherent strategic advice. Requires professional judgement and the ability to evaluate trade-offs.
- Command verb register: evaluate, recommend, advise, critically discuss, justify, assess the strategic implications of, challenge, defend.
- Marking expectations: Marks for financial and strategic analysis. Marks for professional judgement — identifying the best course of action given constraints. Marks for communication quality. Highest marks go to candidates who reach clear, justified conclusions.
- Worked example standard: A listed company facing a strategic inflection point. A private equity acquisition with post-deal integration challenges. A multinational with transfer pricing, hedging, and divisional performance measurement issues simultaneously.
- What students struggle with here: failing to make a recommendation (describing without deciding), not using the case material, writing too technically for a board-level audience, underestimating the professional communication marks available.`

const ICAEW_DEPTH = `QUALIFICATION CALIBRATION — CHARTERED ACCOUNTANCY (CERTIFICATE THROUGH ADVANCED):
The most writing-intensive professional accountancy qualification in the UK, with constructed response at every level.

CERTIFICATE LEVEL (Accounting, Assurance, Business Technology and Finance, Law, Management Information, Principles of Taxation):
- Examination format: Computer-based exams, predominantly objective and short constructed response questions.
- Content calibration: Foundations of professional practice. Covers the core technical disciplines in breadth. Build from first principles, define precisely, apply accurately. Priority is technical accuracy and correct application of rules.
- Command verb register: identify, define, prepare, calculate, state, explain, describe, apply, classify.
- Marking expectations: Technical accuracy marks. Correct terminology expected. Method marks available in calculations.
- Worked example standard: Contained, single-issue scenarios. A company with one accounting adjustment. A tax computation with a single source of income. A single assurance engagement with a defined scope.
- What students struggle with here: precise use of accounting terminology, not explaining the debit and credit basis of a journal, missing the professional context of assurance.

PROFESSIONAL LEVEL (Financial Accounting and Reporting, Audit and Assurance, Business Strategy and Technology, Financial Management, Tax Compliance):
- Examination format: Three-hour written exams. Significant constructed response — multi-part questions requiring explanation, calculation, and application.
- Content calibration: Technical competence and the beginning of professional judgement. Scenarios involve a real company with multiple accounting, tax, audit, or financial management issues to identify and address. Candidates must work through complexity, not just apply a single rule.
- Command verb register: prepare, calculate, explain, apply, discuss, assess, identify, advise, describe the key issues, outline the audit procedures.
- Marking expectations: Technical marks for calculations and correct application of standards. Application marks for identifying the relevant standard and explaining its application to the scenario facts. Professional marks for clear, well-structured written responses.
- Worked example standard: A group of companies preparing consolidated accounts. A tax client with employment income, trading income, and capital gains. An audit of a company with three or four accounting issues in the draft financial statements requiring investigation.
- What students struggle with here: not reading the question carefully enough to identify every issue, providing textbook explanations rather than applying to the scenario, poor time management across a multi-part paper.

ADVANCED LEVEL (Corporate Reporting, Strategic Business Management, Case Study):
- Examination format: Corporate Reporting and Strategic Business Management are 3.5-hour written exams. The Case Study is a 3.5-hour exam using pre-released industry information.
- Content calibration: The highest level of technical complexity combined with professional judgement and advisory capability. Scenarios involve groups with multiple subsidiaries, foreign operations, complex instruments, contentious accounting treatments, and ethical dimensions. Candidates are expected to identify issues, weigh alternatives, and provide a justified professional opinion.
- Command verb register: evaluate, advise, critically assess, recommend, justify, discuss the implications of, challenge, consider the impact on, assess whether.
- Marking expectations: APC (Advanced Professional Competence) marks at Case Study. Application marks dominate — the correct technical point stated in isolation without application to the scenario scores zero. Ethical and professional judgement marks where the question demands a recommendation. Presentation and professional communication marks throughout.
- Worked example standard: A listed group with acquisitions in multiple jurisdictions, deferred tax on unremitted earnings, impairment testing of goodwill under IAS 36, IFRS 9 hedge accounting on a cross-currency swap, and a going concern issue — all in one scenario. Candidates must triage, prioritise, and advise under time pressure.
- What students struggle with here: technical accuracy on complex topics like deferred tax, IFRS 9, and share-based payments; failing to link technical knowledge to the specific scenario facts; not reaching a clear professional opinion when one is required.`

const AAT_DEPTH = `QUALIFICATION CALIBRATION — ACCOUNTING TECHNICIAN (LEVELS 2 THROUGH 4):
A practical, competency-focused qualification assessing accounting skills from bookkeeping through to professional judgement.

LEVEL 2 — FOUNDATION CERTIFICATE:
- Units: Bookkeeping Transactions, Bookkeeping Controls, Introduction to Payroll, Business Environment.
- Examination format: Computer-based assessments, objective and task-based.
- Content calibration: Build from absolute first principles. Students are new to accounting. Every term must be defined. Every rule must be stated before it is applied. Procedural accuracy is the primary measure of competence.
- Command verb register: identify, state, enter, calculate, prepare, record, post, balance.
- Marking expectations: Correct entries in ledger accounts. Correct totals on trial balance. Correct payroll calculations. Right or wrong — minimal partial credit.
- Worked example standard: A single sole trader business. One month of transactions. Debit and credit entries shown explicitly for every transaction. Bank reconciliation from first line.
- What students struggle with here: remembering which accounts increase with a debit vs a credit, careless arithmetic errors in double entry, failing to balance off accounts correctly.

LEVEL 3 — ADVANCED CERTIFICATE:
- Units: Business Awareness, Financial Accounting: Preparing Financial Statements, Management Accounting Techniques, Tax Processes for Businesses, Advanced Bookkeeping.
- Examination format: Computer-based assessments, increasingly scenario-based with short written tasks.
- Content calibration: Assume solid bookkeeping foundation. Focus on the preparation of complete financial statements, management accounting decision-making tools, and VAT processes. Students must now apply rules to more complex and less structured scenarios.
- Command verb register: prepare, calculate, produce, reconcile, explain, identify, apply, analyse.
- Marking expectations: Correct financial statement figures including all necessary adjustments. Correct overhead absorption calculations. Correct VAT return figures. Short written explanations of adjustments.
- Worked example standard: A sole trader or small company with accruals, prepayments, depreciation, and bad debt adjustments requiring income statement and statement of financial position preparation. A standard cost card with all variance calculations.
- What students struggle with here: applying accruals correctly (especially accrued income vs prepaid expenses), distinguishing capital from revenue expenditure, marginal vs absorption costing profit differences.

LEVEL 4 — PROFESSIONAL DIPLOMA:
- Units: Financial Statements of Limited Companies, Management Accounting: Decision and Control, Management Accounting: Budgeting, Business Tax, Personal Tax, Audit and Assurance, Cash and Financial Management, Credit and Debt Management, Synoptic Assessment.
- Examination format: Computer-based assessments with extended written responses. Synoptic assessment integrates across units.
- Content calibration: Professional competence level. Students are preparing for roles as qualified accounting technicians or for further professional study. Scenarios involve limited companies, partnerships, groups, and more complex tax computations. Requires professional judgement and the ability to advise.
- Command verb register: prepare, evaluate, calculate, advise, assess, discuss, recommend, explain, analyse, interpret.
- Marking expectations: Technically accurate financial statements. Correct deferred tax workings. Justified recommendations on financing decisions. Professional explanations of audit procedures and findings. Quality of reasoning in written tasks is assessed, not just technical accuracy.
- Worked example standard: A limited company with share capital, deferred tax, revaluation reserve, and dividends. A budget with flexed analysis and variance commentary. A tax computation with business and personal income sources. An audit scenario with three risks requiring procedures.
- What students struggle with here: deferred tax (especially on timing differences), drafting professional quality written responses, integrating across subjects in the synoptic, partnership accounts especially on admission and retirement of partners.`

const ETICPA_CPA_DEPTH = `QUALIFICATION CALIBRATION — ETHIOPIAN CERTIFIED PUBLIC ACCOUNTANT (CPA):
Established under Proclamation No. 1372/2025, the ETiCPA CPA qualification is Ethiopia's national professional accounting credential. It certifies competence in accounting, auditing, taxation, and ethical practice to internationally aligned standards. The qualification follows a five-stage pathway: Eligibility and Registration, Examinations, Practical Experience, Certification, and Continuous Professional Development.

NOTE: The detailed CPA examination syllabus is under active development by ETiCPA as of 2026. Content must therefore be calibrated to the broad competency domains of the qualification rather than specific examination papers. Focus on the technical areas that define professional CPA-level competence in an Ethiopian context: financial reporting under IFRS as adopted in Ethiopia, audit and assurance under ISAs, Ethiopian taxation under ERCA, management accounting, and professional ethics under IFAC standards.

CONTENT CALIBRATION:
- Audience: Accounting graduates and professionals pursuing Ethiopia's national CPA designation. Many will have prior accounting education. Content should build professional-level depth and practical application, not repeat undergraduate fundamentals.
- Ethiopian context is essential: Reference Ethiopian Financial Reporting Standards (EFRS), the Ethiopian Revenues and Customs Authority (ERCA), the Accounting and Auditing Board of Ethiopia (AABE), and Ethiopian commercial law where relevant. Do not treat Ethiopian practice as identical to UK or US practice.
- IFRS alignment: Ethiopia has adopted IFRS for public interest entities. Reference IFRS standards by number and title. Where Ethiopian adoption differs from the full IFRS suite, note the difference.
- Professional ethics: Reference the IFAC Code of Ethics. ETiCPA members are bound by international ethical standards — content on ethics must reflect the IESBA framework: integrity, objectivity, professional competence and due care, confidentiality, professional behaviour.
- Command verb register: apply, analyse, evaluate, advise, assess, prepare, explain, calculate, recommend, justify, discuss the implications of.
- Worked example standard: Ethiopian business scenarios — a listed Ethiopian company, an SME registered with AABE, a government-affiliated entity, a company operating across Ethiopian regions. Use Ethiopian Birr (ETB) as the currency in worked examples. Reference Ethiopian regulatory bodies and tax rates (with caveat that rates change).
- What candidates need most: Ethiopian-specific application of IFRS, ERCA tax compliance for businesses and individuals, audit procedures under ISAs in the Ethiopian regulatory environment, professional ethics in Ethiopian practice contexts.
- CRITICAL: Never mention ETiCPA or ETICPA by name in published output. Use "professional accounting examination level" or "CPA examination level" instead.`

const ETICPA_ATQ_DEPTH = `QUALIFICATION CALIBRATION — ACCOUNTING TECHNICIAN QUALIFICATION (ATQ):
The ETiCPA ATQ is a two-level employer-oriented qualification designed to address Ethiopia's middle-level financial skills gap. It develops ethical, work-ready finance professionals for Ethiopia's public and private sectors. Level 1 is the Foundation Technician level. Level 2 is the Advanced Technician level.

LEVEL 1 — FOUNDATION TECHNICIAN:
Modules: Introduction to Accounting, Cost Accounting, Business Skills, Ethiopian Business Law.
- Examination format: Structured assessments testing foundational knowledge and practical application.
- Content calibration: Build from absolute first principles. Students are new to accounting or have minimal prior knowledge. Every accounting term must be defined before use. Ethiopian business context must be prominent — examples should reference Ethiopian businesses, Ethiopian Birr, and Ethiopian commercial practice.
- Introduction to Accounting: Double entry bookkeeping, books of prime entry, ledger accounts, trial balance, basic financial statements. The accounting equation. Types of business entity under Ethiopian law. The role of accountants in Ethiopian organisations.
- Cost Accounting: Cost classification (fixed, variable, direct, indirect). Cost centres and cost units. Basic absorption costing. Inventory valuation (FIFO, weighted average). Labour cost recording.
- Business Skills: Communication in professional contexts. Numeracy and data interpretation. Working in teams. Professional conduct. Digital tools in accounting.
- Ethiopian Business Law: Ethiopian Commercial Code — types of business entity (sole trader, partnership, private limited company, share company). Contract law fundamentals. Employment law basics. Consumer protection.
- Command verb register: identify, define, state, record, calculate, prepare, classify, describe, explain.
- Marking expectations: Correct double entry. Accurate calculations. Clear, brief written explanations. Right or wrong on numerical tasks.
- Worked example standard: A small Ethiopian sole trader or private limited company. Simple monthly transactions. Bank reconciliation. Basic cost statement. All figures in Ethiopian Birr.
- What students struggle with here: debit and credit direction confusion, distinguishing capital from revenue expenditure, applying Ethiopian business law terminology accurately.

LEVEL 2 — ADVANCED TECHNICIAN:
Modules: Financial Accounting, Management Accounting, Assurance Controls and Ethics, Ethiopian Taxation, Ethiopian Public Sector Accounting.
- Examination format: Scenario-based assessments requiring preparation of financial statements, management reports, and analytical responses.
- Content calibration: Assume Level 1 foundation. Focus on preparing complete financial statements, applying management accounting tools, understanding assurance and internal controls, computing Ethiopian tax liabilities, and applying public sector accounting principles relevant to Ethiopia.
- Financial Accounting: Preparation of financial statements for sole traders and limited companies under IFRS for SMEs. Adjustments — accruals, prepayments, depreciation, bad debts. Partnership accounts. Company accounts including share capital and retained earnings.
- Management Accounting: Marginal and absorption costing. Contribution analysis. Break-even analysis. Budgeting and variance analysis. Relevant cost decision-making. Working capital management.
- Assurance Controls and Ethics: Internal controls — purpose, types, and limitations. The role of internal audit. Fraud awareness and prevention. IFAC Code of Ethics — integrity, objectivity, confidentiality, professional competence. Ethical dilemmas in practice.
- Ethiopian Taxation: ERCA tax administration. Employment income tax (Schedule A). Business income tax (Schedule C) — presumptive and actual regime. VAT under Ethiopian VAT Proclamation. Withholding tax. Turnover tax for small businesses. Filing obligations and penalties.
- Ethiopian Public Sector Accounting: The Integrated Financial Management Information System (IFMIS). Cash basis vs accruals basis in public sector. Ethiopian government budget structure. Public procurement principles. Financial reporting for public bodies.
- Command verb register: prepare, calculate, analyse, apply, explain, advise, reconcile, assess, describe, evaluate.
- Marking expectations: Complete financial statements with correct adjustments. Accurate variance analysis. Correct Ethiopian tax computations. Professional written explanations. Quality of reasoning matters at this level.
- Worked example standard: An Ethiopian private limited company with multiple adjustments. A budget with flexed analysis. An Ethiopian tax computation for a business and its employees. A public sector entity preparing its annual accounts.
- What students struggle with here: applying IFRS for SMEs correctly to Ethiopian practice, Ethiopian VAT partial exemption rules, distinguishing presumptive from actual business income tax, public sector accounting conventions.
- CRITICAL: Never mention ETiCPA or ETICPA by name in published output. Use "accounting technician level" or "ATQ examination level" instead.`

const ACCA_QUESTIONS = `QUALIFICATION PROFILE — ACCA STANDARD (internal calibration only):

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

EXAM TIERS (internal):
- beginner: Applied Knowledge (BT / MA / FA)
- intermediate: Applied Skills (PM / TX / FR / AA / FM / LW)
- advanced: Strategic Professional (SBL / SBR / AFM / APM / ATX / AAA)`

const CIMA_QUESTIONS = `QUALIFICATION PROFILE — CIMA STANDARD (internal calibration only):

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

EXAM TIERS (internal):
- beginner: Operational Level
- intermediate: Management Level
- advanced: Strategic Level`

const ICAEW_QUESTIONS = `QUALIFICATION PROFILE — ICAEW/ACA STANDARD (internal calibration only):

TIER-SPECIFIC CALIBRATION:
Certificate Level: Knowledge and basic application. Command verbs: Explain, Outline, Describe, Calculate (single step), Identify.
Professional Level: Technical competence and emerging judgement. Command verbs: Analyse, Assess, Evaluate, Advise, Recommend, Prepare, Calculate.
Advanced Level: Full professional judgement. Open-book, complex multi-issue scenarios. Command verbs: Evaluate, Advise, Recommend with full justification, Critically assess.

EXAM TIERS (internal):
- beginner: Certificate Level
- intermediate: Professional Level
- advanced: Advanced Level`

const AAT_QUESTIONS = `QUALIFICATION PROFILE — AAT STANDARD (internal calibration only):

TIER-SPECIFIC CALIBRATION:
Level 2 Foundation: Procedural competency. Debit/credit mechanics, basic VAT, simple payroll. Command verbs: Identify, Enter, Calculate (single step), State, Complete.
Level 3 Advanced: Application and analysis. Trial balance, depreciation, inventory valuation, basic management accounting. Command verbs: Calculate, Prepare, Identify errors, Explain, Apply.
Level 4 Professional: Professional judgement. Limited company accounts, standard costing, complex tax, working capital management. Command verbs: Prepare, Evaluate, Calculate and comment, Advise, Analyse.

EXAM TIERS (internal):
- beginner: Level 2 Foundation
- intermediate: Level 3 Advanced
- advanced: Level 4 Professional`

const ETICPA_CPA_QUESTIONS = `ETICPA CPA PROFILE: All scenarios use Ethiopian Birr (ETB). Reference Ethiopian companies, ERCA, AABE, Ethiopian Commercial Code.
Financial reporting: IFRS by number for public interest entities. Taxation: ERCA, Schedule A (employment), Schedule C (business), VAT Proclamation, withholding tax — caveat all rates.
Audit: ISAs by number. Ethics: IFAC/IESBA framework. Never mention ETiCPA or ETICPA in question text — use "professional accounting examination".`

const ETICPA_ATQ_QUESTIONS = `ETICPA ATQ PROFILE: Level 1 Foundation or Level 2 Advanced. All scenarios use Ethiopian Birr. Ethiopian Commercial Code for law questions.
Level 1: Double entry, basic cost accounting, Ethiopian business law basics. Level 2: Full financial statements under IFRS for SMEs, management accounting, Ethiopian taxation (ERCA schedules), public sector accounting.
Never mention ETiCPA or ETICPA in question text — use "accounting technician level".`

export const LEVEL_PACKS: Readonly<Record<LevelId, LevelPack>> = {
  acca: { id: 'acca', internalLabel: 'ACCA', depth: ACCA_DEPTH, questionCalibration: ACCA_QUESTIONS },
  cima: { id: 'cima', internalLabel: 'CIMA', depth: CIMA_DEPTH, questionCalibration: CIMA_QUESTIONS },
  icaew: { id: 'icaew', internalLabel: 'ICAEW', depth: ICAEW_DEPTH, questionCalibration: ICAEW_QUESTIONS },
  aat: { id: 'aat', internalLabel: 'AAT', depth: AAT_DEPTH, questionCalibration: AAT_QUESTIONS },
  'eticpa-cpa': { id: 'eticpa-cpa', internalLabel: 'ETICPA / CPA', depth: ETICPA_CPA_DEPTH, questionCalibration: ETICPA_CPA_QUESTIONS },
  'eticpa-atq': { id: 'eticpa-atq', internalLabel: 'ETICPA / ATQ', depth: ETICPA_ATQ_DEPTH, questionCalibration: ETICPA_ATQ_QUESTIONS },
}
