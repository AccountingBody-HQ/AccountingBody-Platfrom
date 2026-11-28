// Subject packs: the technical standards each subject must meet. Ported from
// the content generator (first) and the question generator (second, where it
// adds something new). Subjects with no existing text use the general text.
import { SUBJECT_KEYS, type SubjectKey } from '../types'

// ── From the content generator ───────────────────────────────────────────────

const CG_FINANCIAL_REPORTING = `SUBJECT TECHNICAL STANDARDS — FINANCIAL REPORTING:
- Primary framework: International Financial Reporting Standards (IFRS) as the default. Reference UK GAAP (FRS 102, FRS 105) and US GAAP (ASC) where material differences exist.
- Key standards to reference by number: IFRS 1 (First-time adoption), IFRS 2 (Share-based payment), IFRS 3 (Business combinations), IFRS 5 (Non-current assets held for sale), IFRS 7 (Financial instruments: disclosures), IFRS 8 (Operating segments), IFRS 9 (Financial instruments), IFRS 10 (Consolidated financial statements), IFRS 11 (Joint arrangements), IFRS 12 (Disclosure of interests in other entities), IFRS 13 (Fair value measurement), IFRS 15 (Revenue from contracts with customers), IFRS 16 (Leases), IAS 1 (Presentation of financial statements), IAS 2 (Inventories), IAS 7 (Statement of cash flows), IAS 8 (Accounting policies), IAS 10 (Events after the reporting period), IAS 12 (Income taxes), IAS 16 (Property, plant and equipment), IAS 19 (Employee benefits), IAS 20 (Government grants), IAS 21 (Effects of changes in foreign exchange rates), IAS 23 (Borrowing costs), IAS 24 (Related party disclosures), IAS 27 (Separate financial statements), IAS 28 (Investments in associates and joint ventures), IAS 32 (Financial instruments: presentation), IAS 33 (Earnings per share), IAS 36 (Impairment of assets), IAS 37 (Provisions, contingent liabilities and contingent assets), IAS 38 (Intangible assets), IAS 40 (Investment property), IAS 41 (Agriculture).
- Reference standards by name and number only — never reproduce standard text verbatim.
- Precision required: Every recognition and measurement principle must be stated accurately. Do not blend IFRS and UK GAAP without explicit labelling. Deferred tax must distinguish temporary differences from permanent differences and apply the correct rate.
- Common student confusions: IAS 37 vs IFRS 9 for financial liabilities; IAS 36 impairment testing methodology (CGU identification, VIU vs FVLCD); IFRS 15 five-step model application to variable consideration; IFRS 16 lessee accounting (right-of-use asset and lease liability — not operating lease off-balance sheet); IAS 19 defined benefit pension (actuarial gains/losses in OCI, not P&L).
- Worked examples must show journal entries in plain Dr/Cr format. All figures specific and non-round.`

const CG_FINANCIAL_ACCOUNTING = `SUBJECT TECHNICAL STANDARDS — FINANCIAL ACCOUNTING:
- Core mechanics: Double entry bookkeeping, trial balance extraction, adjustments (accruals, prepayments, depreciation, bad and doubtful debts, inventory write-down), preparation of income statement and statement of financial position for sole traders, partnerships, and companies.
- Key concepts: Accruals basis (recognise income when earned, expense when incurred — not when cash changes hands), going concern, consistency, materiality, prudence. Apply the Conceptual Framework (IASB 2018) for recognition and measurement where relevant.
- For company accounts: Share capital (ordinary and preference), share premium, retained earnings, revaluation reserve, other comprehensive income. Distinguish equity from liability for financial instruments (IAS 32).
- Partnership accounts: Capital and current accounts, profit-sharing ratios, admission/retirement of partners (goodwill treatment), dissolution.
- Common student confusions: Accrued income (asset) vs accrued expense (liability); prepaid expense (asset) vs deferred income (liability); reducing balance depreciation calculation (apply rate to carrying amount, not cost); correct treatment of disposal — accumulated depreciation must be removed along with cost.
- Worked examples: Show full double entry for every adjustment. Balance off accounts explicitly. Extract corrected trial balance. Prepare financial statements from adjusted trial balance. All figures non-round.`

const CG_MANAGEMENT_ACCOUNTING = `SUBJECT TECHNICAL STANDARDS — MANAGEMENT ACCOUNTING:
- Cost classification: Fixed, variable, semi-variable (step and mixed). Distinguish relevant from sunk costs for decision-making. Direct vs indirect costs. Product vs period costs.
- Absorption costing: Overhead absorption rate = budgeted overhead / budgeted activity base. Under/over absorption = actual overhead minus absorbed overhead. Reconcile absorption and marginal profit: fixed overhead in opening and closing inventory.
- Marginal costing: Contribution = selling price minus variable costs. Contribution/sales ratio. Break-even point = fixed costs / contribution per unit. Margin of safety = (budgeted sales - break-even sales) / budgeted sales.
- Standard costing and variance analysis — memorise these formulas exactly:
  Material price variance: (standard price - actual price) x actual quantity purchased.
  Material usage variance: (standard quantity for actual output - actual quantity used) x standard price.
  Labour rate variance: (standard rate - actual rate) x actual hours worked.
  Labour efficiency variance: (standard hours for actual output - actual hours worked) x standard rate.
  Variable overhead expenditure variance: (standard variable overhead rate x actual hours - actual variable overhead).
  Variable overhead efficiency variance: (standard hours - actual hours) x standard variable overhead rate.
  Fixed overhead expenditure variance: budgeted fixed overhead - actual fixed overhead.
  Fixed overhead volume variance (absorption only): (actual output - budgeted output) x standard fixed overhead per unit.
  Sales price variance: (actual price - standard price) x actual volume.
  Sales volume variance: (actual volume - budgeted volume) x standard contribution per unit (marginal) or standard profit per unit (absorption).
  Mix and yield variances for materials and labour where relevant.
- Budgeting: Incremental vs zero-based. Flexed budgets — always flex to actual volume before computing variances. Rolling budgets. Participative vs imposed. Behavioural implications.
- Common student confusions: Applying material price variance to quantity used rather than purchased; computing fixed overhead volume variance under marginal costing (it does not exist — there is no volume variance under marginal); failing to flex the budget before calculating variances.`

const CG_AUDIT_ASSURANCE = `SUBJECT TECHNICAL STANDARDS — AUDIT AND ASSURANCE:
- Governing framework: International Standards on Auditing (ISAs) as the primary reference. Reference by number and title.
- Key ISAs: ISA 200 (Overall objectives), ISA 210 (Agreeing the terms), ISA 220 (Quality management), ISA 230 (Audit documentation), ISA 240 (Fraud), ISA 250 (Laws and regulations), ISA 260 (Communication with those charged with governance), ISA 265 (Communicating deficiencies), ISA 300 (Planning), ISA 315 (Identifying and assessing risks of material misstatement), ISA 320 (Materiality), ISA 330 (Responses to assessed risks), ISA 402 (Service organisations), ISA 450 (Evaluation of misstatements), ISA 500 (Audit evidence), ISA 505 (External confirmations), ISA 510 (Initial audit engagements), ISA 520 (Analytical procedures), ISA 530 (Audit sampling), ISA 540 (Accounting estimates), ISA 550 (Related parties), ISA 560 (Subsequent events), ISA 570 (Going concern), ISA 580 (Written representations), ISA 600 (Group audits), ISA 620 (Using an expert), ISA 700 (Forming an opinion), ISA 701 (Key audit matters), ISA 705 (Modifications to opinion), ISA 706 (Emphasis of matter), ISA 720 (Other information).
- Audit assertions: Existence, occurrence, completeness, accuracy, valuation, cut-off, classification, rights and obligations, presentation and disclosure. Always link procedures to the specific assertion being tested.
- Audit risk model: Audit risk = inherent risk x control risk x detection risk. Risk assessment procedures, tests of controls, substantive procedures.
- Common student confusions: Confusing audit objectives (ISA 200) with management assertions; describing procedures that are too vague ("check the invoices" instead of "agree a sample of invoices to the purchase order, goods received note, and supplier statement"); not specifying the direction of testing (testing for overstatement vs understatement requires different approaches); confusing emphasis of matter paragraphs with modified opinions.
- Worked examples: Scenario with specific audit risks, specific procedures linked to assertions, specific deficiency with consequences and recommendation.`

const CG_TAXATION = `SUBJECT TECHNICAL STANDARDS — TAXATION:
- CRITICAL RULE: All tax rates, thresholds, allowances, and reliefs must carry an explicit caveat: "(rates applicable for the tax year stated in your study materials — verify with HMRC or the relevant authority for current figures)". This is non-negotiable. Tax law changes every Finance Act.
- UK tax framework (default unless otherwise specified): Income tax, National Insurance contributions, corporation tax, capital gains tax, inheritance tax, VAT, stamp duty land tax. Reference the Taxes Acts and VATA 1994 in general terms — never reproduce legislative text.
- Income tax: Sources of income (employment, self-employment, savings, dividends, property, other). Personal allowance, basic/higher/additional rate bands. Gift Aid extension of basic rate band. Pension contributions. Employment income — benefits in kind (P11D), expense claims.
- Corporation tax: Qualifying period, taxable total profits (trading income + non-trading loan relationships + chargeable gains + property income - qualifying charitable donations). Capital allowances (AIA, main pool, special rate pool, structures and buildings allowance). Research and development relief.
- VAT: Standard, reduced, zero-rated, exempt. Partial exemption. VAT registration threshold (caveat as subject to annual change). Input and output tax. Bad debt relief. Group VAT registration.
- Capital gains tax: Disposal proceeds minus allowable costs. Annual exempt amount. Principal private residence relief. Business asset disposal relief (entrepreneurs relief). Chattels rules.
- Common student confusions: Using the wrong tax year rates; treating exempt supplies as zero-rated for VAT purposes (they are fundamentally different — exempt restricts input tax recovery); applying CGT annual exempt amount to non-individual taxpayers; corporation tax losses — the order of offset matters.
- All worked examples: Use invented taxpayer names (not real people), specific non-round figures, and state explicitly the assumed tax year for all computations.`

const CG_FINANCIAL_MANAGEMENT = `SUBJECT TECHNICAL STANDARDS — FINANCIAL MANAGEMENT:
- Investment appraisal: Net present value (NPV) using discount factor tables. Internal rate of return (IRR) by interpolation — formula: IRR = lower rate + [NPV at lower rate / (NPV at lower rate - NPV at higher rate)] x (higher rate - lower rate). Modified IRR (MIRR). Payback period. Accounting rate of return (ARR = average annual profit / average investment). Discounted payback.
- Cost of capital: WACC = (E/V x Re) + (D/V x Rd x (1-T)). Cost of equity by CAPM: Re = Rf + Beta(Rm - Rf). Dividend growth model: Re = (D1/P0) + g. Cost of debt: post-tax cost of irredeemable debt = Kd(1-T)/market value. For redeemable debt use IRR of cash flows to redemption.
- CAPM and beta: Asset beta (ungeared) vs equity beta (geared). Ungear: Ba = Be x [E/(E+D(1-T))]. Regear for new project risk. Modigliani-Miller propositions with and without tax.
- Working capital management: Cash conversion cycle = inventory days + receivables days - payables days. Optimal cash balance (Baumol model, Miller-Orr model). Receivables — factoring, invoice discounting. Inventory — EOQ = square root of (2CoD/Ch).
- Foreign exchange and interest rate risk: Transaction, translation, economic exposure. Forward contracts, money market hedge, currency futures, options. Interest rate risk: FRAs, interest rate futures, interest rate swaps, caps and floors.
- Business valuation: P/E ratio method, dividend yield method, asset-based (net assets, NRV, replacement cost), dividend growth model, free cash flow to equity, enterprise value (EV/EBITDA).
- Common student confusions: Using nominal cash flows with real discount rates (or vice versa); ignoring tax relief on debt in WACC; confusing the IRR interpolation formula (it is linear interpolation — not exact); failing to include working capital investment and recovery in project NPV; mixing up MIRR and IRR.`

const CG_PERFORMANCE_MANAGEMENT = `SUBJECT TECHNICAL STANDARDS — PERFORMANCE MANAGEMENT:
- Advanced variance analysis: Planning vs operational variances. Mix and yield variances (materials and sales). Lifecycle costing. Target costing: target cost = competitive price - required profit margin; cost gap = current cost - target cost.
- Activity-based costing: Cost pools, cost drivers, cost driver rates. ABC vs traditional absorption costing — when does ABC give materially different product costs? Cross-subsidy identification.
- Performance measurement frameworks: Balanced scorecard (Kaplan and Norton) — financial, customer, internal business process, learning and growth perspectives. Each perspective requires lead and lag indicators. Fitzgerald and Moon's Building Block model: dimensions (results, determinants), standards (ownership, achievability, equity), rewards. Divisional performance: ROI = (controllable profit / investment) x 100. RI = controllable profit - (imputed interest rate x investment). Economic profit (EVA) = NOPAT - (WACC x invested capital).
- Transfer pricing: Market-based, cost-based (full cost, marginal cost, cost-plus), negotiated. Transfer pricing range: minimum (marginal cost + opportunity cost in selling division) to maximum (market price or external purchase price in buying division). International transfer pricing and tax authorities.
- Not-for-profit performance: Value for money (economy, efficiency, effectiveness). Input, output, outcome measures. Difficulty of measuring outputs without profit signal.
- Common student confusions: Confusing ROI and RI — ROI can discourage positive NPV investments; RI aligns better with shareholder value maximisation. Mixing up the balanced scorecard perspective labels. Computing the transfer pricing range incorrectly — the minimum price is the relevant cost to the selling division including opportunity cost, not just marginal cost when there is a capacity constraint.`

const CG_STRATEGIC_BUSINESS = `SUBJECT TECHNICAL STANDARDS — STRATEGIC BUSINESS:
- Strategic analysis frameworks: PESTLE (Political, Economic, Social, Technological, Legal, Environmental). Porter's Five Forces (threat of new entrants, bargaining power of buyers, bargaining power of suppliers, threat of substitutes, competitive rivalry). Porter's Value Chain (primary and support activities). SWOT analysis (internal strengths/weaknesses, external opportunities/threats). Ansoff's growth matrix (market penetration, market development, product development, diversification). BCG matrix (stars, cash cows, question marks, dogs).
- Strategic options: Generic strategies (cost leadership, differentiation, focus). Blue ocean strategy. Related vs unrelated diversification. Organic growth vs acquisition vs joint venture.
- Stakeholder analysis: Mendelow's matrix (power vs interest). Stakeholder engagement strategies. Agency theory.
- Change management: Lewin's force field analysis. Kotter's eight-step model. McKinsey 7S. Resistance to change — sources and management.
- Digital transformation: Cloud computing, big data and analytics, artificial intelligence, robotic process automation, blockchain. Impact on business models and the accountancy profession.
- Ethics: IFAC Code of Ethics principles (integrity, objectivity, professional competence and due care, confidentiality, professional behaviour). Threats (self-interest, self-review, advocacy, familiarity, intimidation) and safeguards.
- Application rule: Never state strategic frameworks as definitions. Always apply to the specific scenario provided. The marker awards marks for application, not for defining what PESTLE stands for.`

const CG_BOOKKEEPING = `SUBJECT TECHNICAL STANDARDS — BOOKKEEPING:
- Double entry rules: Assets increase with debit, decrease with credit. Liabilities increase with credit, decrease with debit. Equity increases with credit, decreases with debit. Income increases with credit, decreases with debit. Expenses increase with debit, decrease with credit. Memorise — never approximate.
- The accounting equation: Assets = Liabilities + Equity. Every transaction must keep this equation in balance. A debit to one account must have an equal credit to another.
- Source documents: Purchase invoices (evidence of expense or asset purchase), sales invoices (evidence of revenue earned), receipts, bank statements, remittance advices, credit notes, petty cash vouchers. Each document links to a specific day book and ledger entry.
- Day books: Sales day book, purchases day book, sales returns day book, purchases returns day book, cash book (with discount columns), petty cash book.
- Ledger accounts: Sales ledger (individual customer accounts — debtors), purchase ledger (individual supplier accounts — creditors), nominal ledger (all other accounts). Control accounts reconcile the individual ledger totals to the nominal ledger.
- Bank reconciliation: Balance per bank statement ± timing differences (outstanding deposits and unpresented cheques) = balance per cash book. Errors and omissions (bank charges, direct debits not yet recorded) adjust the cash book balance.
- Trial balance extraction: All debit balances in debit column, all credit balances in credit column. Totals must agree. A balancing trial balance does not guarantee no errors (compensating errors, errors of principle, errors of omission, errors of commission, errors of original entry, reversal of entries).
- Common student confusions: Treating a credit sale as a debit to sales (it is a debit to receivables, credit to sales); forgetting to record both sides of a cash discount (discount allowed reduces receivables AND reduces income); bank overdraft is a credit balance in the nominal ledger, not a debit.`

const CG_CORPORATE_REPORTING = `SUBJECT TECHNICAL STANDARDS — CORPORATE REPORTING:
- Complex group accounting: Consolidated statement of financial position (goodwill calculation, non-controlling interest — full goodwill vs proportionate methods, pre-acquisition reserves), consolidated income statement (eliminating intragroup trading, unrealised profit on inventory, dividends), consolidated statement of cash flows.
- Business combinations: IFRS 3 acquisition method. Goodwill = consideration transferred + fair value of NCI + fair value of previously held equity - fair value of identifiable net assets at acquisition date. Contingent consideration at fair value on acquisition date and re-measured at each subsequent reporting date.
- Associates and joint ventures: IAS 28 equity method. Share of post-acquisition profit, dividends reduce carrying amount. Impairment of investment in associate.
- Deferred tax: IAS 12. Temporary differences (not timing differences — the IAS 12 concept is broader). Deferred tax liability on accelerated capital allowances, revaluation gains, undistributed earnings of subsidiaries. Deferred tax asset on trading losses carried forward (only if probable future taxable profit). Deferred tax on share-based payments (IFRS 2). Tax base vs carrying amount.
- Financial instruments: IFRS 9 classification (amortised cost, FVOCI, FVTPL — based on business model and SPPI test). Expected credit loss model (12-month ECL on Stage 1, lifetime ECL on Stage 2 and 3). Hedge accounting (fair value hedge, cash flow hedge, net investment hedge) — only if criteria met.
- Share-based payments: IFRS 2. Equity-settled — fair value at grant date, spread over vesting period, adjusted for leavers but not market conditions. Cash-settled — fair value at each reporting date, full remeasurement.
- Common student confusions: Using the wrong goodwill method for NCI; deferred tax on a revaluation surplus (tax effect goes to OCI, not P&L); the difference between IFRS 9 amortised cost and FVOCI for debt instruments (FVOCI recycles gains/losses on disposal; amortised cost does not); IFRS 2 — adjusting for non-market conditions but not market conditions during the vesting period.`

const CG_BUSINESS_ECONOMICS = `SUBJECT TECHNICAL STANDARDS — BUSINESS ECONOMICS:
- Microeconomics: Supply and demand analysis. Elasticity — price elasticity of demand (PED = % change in quantity demanded / % change in price), income elasticity, cross elasticity. Market structures: perfect competition (price taker, MC=MR in equilibrium), monopolistic competition, oligopoly (strategic interdependence, game theory), monopoly (price maker, potential deadweight loss, regulation).
- Costs and revenues: Short-run production (fixed and variable factors, diminishing returns). Cost curves — ATC, AVC, AFC, MC. Long-run average cost curve (economies and diseconomies of scale). Revenue curves under different market structures.
- Macroeconomics: GDP measurement (expenditure, income, output methods). Business cycle. Inflation (CPI, RPI, causes — demand-pull, cost-push, monetary). Unemployment (frictional, structural, cyclical, seasonal). Balance of payments (current account, capital and financial account). Exchange rates — determination, purchasing power parity.
- Fiscal and monetary policy: Fiscal policy — government spending and taxation. Automatic stabilisers. Crowding out. Monetary policy — interest rates, quantitative easing, inflation targeting. Roles of central banks.
- International trade: Comparative advantage (Ricardo). Terms of trade. Protectionism (tariffs, quotas, subsidies). WTO framework. Free trade agreements. Impact of exchange rate changes on trade flows (J-curve effect).
- Application rule: Economics content must connect theory to business decision-making. A graph or formula is only worth including if it is then applied to a realistic business scenario. Theoretical definitions without application are insufficient.`

// ── From the question generator ──────────────────────────────────────────────

const QG_FINANCIAL_REPORTING = `FINANCIAL REPORTING — TECHNICAL STANDARDS:
IFRS 15 (Revenue — five-step model), IFRS 16 (Leases — ROU asset and lease liability), IFRS 9 (Financial instruments — ECL model three stages), IFRS 3 (Business combinations — goodwill), IFRS 10 (Control definition), IFRS 13 (Fair value — three-level hierarchy).
IAS 36 (Impairment — CGU methodology; value in use vs FVLCTS), IAS 37 (Provisions — obligating event + probable + reliable estimate), IAS 38 (Intangibles — research expense vs development capitalise), IAS 19 (Defined benefit — actuarial gains/losses in OCI NEVER P&L), IAS 12 (Deferred tax — temporary differences, NOT timing differences).
COMMON CONFUSIONS: IAS 36 students test individual assets not CGUs. IFRS 16 students put entire lease payment in P&L. IAS 19 students put actuarial gains/losses in P&L.`

const QG_FINANCIAL_ACCOUNTING = `FINANCIAL ACCOUNTING — TECHNICAL STANDARDS:
Assets/expenses: increase with DEBIT. Liabilities/equity/income: increase with CREDIT.
Accruals basis: match income/expenses to period. Prepayments = asset. Accruals = liability.
Depreciation: SL = (Cost - Residual) / Life. RB = Carrying amount × Rate%.
Inventory: FIFO or weighted average. NRV = lower of cost and net realisable value.
COMMON CONFUSIONS: Allowance for doubtful debts — only the CHANGE hits P&L. RB depreciation — apply rate to carrying amount not cost in year 2+.`

const QG_MANAGEMENT_ACCOUNTING = `MANAGEMENT ACCOUNTING — TECHNICAL STANDARDS:
High-low method: Variable cost per unit = (Highest cost - Lowest cost) / (Highest activity - Lowest activity).
Contribution = Selling price - Variable cost. Breakeven (units) = Fixed costs / Contribution per unit.
Absorption vs Marginal: Absorption profit - Marginal profit = Change in inventory × Fixed OAR.
ALL VARIANCES: Material price = (Std price - Actual price) × Actual qty purchased. Material usage = (Std qty for actual prod - Actual qty) × Std price. Labour rate = (Std rate - Actual rate) × Actual hours. Labour efficiency = (Std hours for actual prod - Actual hours) × Std rate.
COMMON CONFUSIONS: Material price variance — applied to qty PURCHASED not used. OAR — use BUDGETED figures only.`

const QG_AUDIT_ASSURANCE = `AUDIT AND ASSURANCE — TECHNICAL STANDARDS:
Audit risk = Inherent risk × Control risk × Detection risk. Auditor controls detection risk only.
ISA 315 (Risk assessment), ISA 330 (Responses to risk), ISA 570 (Going concern), ISA 700 (Forming opinion), ISA 705 (Modifications — qualified=material not pervasive; adverse=material and pervasive; disclaimer=unable to obtain sufficient appropriate evidence).
Assertions for balances: existence, completeness, rights and obligations, accuracy/valuation.
Direction: completeness = trace outward from records. Existence = trace inward from statements.
COMMON CONFUSIONS: Students give vague procedures — always state what document, what assertion, what auditor looks for. ISA 705: qualified = material but NOT pervasive.`

const QG_TAXATION = `TAXATION — TECHNICAL STANDARDS:
CRITICAL CAVEAT: Every rate, threshold, allowance cited must carry explicit note that it is illustrative — verify against current HMRC guidance. State tax year assumed.
Income tax structure: personal allowance → basic rate → higher rate → additional rate. NIC is NOT income tax — separate calculation.
Corporation tax: main rate / small profits rate / marginal relief. Associated companies affect thresholds.
VAT: exempt (no input tax recovery) vs zero-rated (input tax IS recoverable) — students confuse these.
Capital gains: annual exempt amount, BADR (illustrative 10% up to lifetime limit).`

const QG_FINANCIAL_MANAGEMENT = `FINANCIAL MANAGEMENT — TECHNICAL STANDARDS:
NPV: positive = accept. IRR by interpolation: L + [NPV_L / (NPV_L - NPV_H)] × (H - L).
WACC: use MARKET VALUES not book values. Ke via CAPM = Rf + β(Rm - Rf) or dividend growth model.
Beta ungearing: βa = βe × [Ve/(Ve + Vd(1-t))]. Regearing: βe = βa × [Ve + Vd(1-t)] / Ve.
Real vs nominal: (1 + nominal) = (1 + real) × (1 + inflation). NEVER mix real cash flows with nominal rate.
COMMON CONFUSIONS: WACC — students use book values. IRR interpolation — use closest rates either side of zero NPV.`

const QG_PERFORMANCE_MANAGEMENT = `PERFORMANCE MANAGEMENT — TECHNICAL STANDARDS:
Planning vs operational variances. Mix and yield variances for multi-input processes.
ABC: identify activities → cost pools → cost drivers → driver rates → assign to products.
Balanced scorecard: Financial, Customer, Internal Process, Learning & Growth — cause-and-effect linkages matter.
ROI vs RI: ROI leads to rejecting positive NPV projects (dysfunctional). RI avoids this — use for new investment decisions.
EVA = NOPAT - (WACC × Capital invested). Adjustments: capitalise R&D, operating leases, add back goodwill amortisation.
Transfer pricing: TP = Marginal cost + Opportunity cost. At full capacity: add contribution forgone per unit.`

const QG_DEFAULT = `TECHNICAL ACCURACY — GENERAL STANDARDS:
All calculations must be verified. All accounting entries must balance (debits = credits).
All references to rates or thresholds must be caveated as illustrative and subject to change.
All invented figures must be specific and non-round. All invented company names must be realistic.
Explanations must teach — not just state the correct answer.`

function merge(...parts: string[]): string {
  return parts.filter((part, i) => parts.indexOf(part) === i).join('\n\n')
}

/** The technical standards text for each subject key. */
export const SUBJECT_PACKS: Readonly<Record<SubjectKey, string>> = {
  'financial-accounting': merge(CG_FINANCIAL_REPORTING, CG_FINANCIAL_ACCOUNTING, CG_BOOKKEEPING, CG_CORPORATE_REPORTING, QG_FINANCIAL_REPORTING, QG_FINANCIAL_ACCOUNTING),
  'financial-management': merge(CG_FINANCIAL_MANAGEMENT, QG_FINANCIAL_MANAGEMENT),
  'management-accounting': merge(CG_MANAGEMENT_ACCOUNTING, CG_PERFORMANCE_MANAGEMENT, QG_MANAGEMENT_ACCOUNTING, QG_PERFORMANCE_MANAGEMENT),
  'financial-market': merge(QG_DEFAULT),
  'business-management': merge(CG_STRATEGIC_BUSINESS),
  'audit-assurance': merge(CG_AUDIT_ASSURANCE, QG_AUDIT_ASSURANCE),
  taxation: merge(CG_TAXATION, QG_TAXATION),
  economics: merge(CG_BUSINESS_ECONOMICS),
  'ethics-professional-standards': merge(QG_DEFAULT),
  'business-law-regulation': merge(QG_DEFAULT),
  general: merge(QG_DEFAULT),
}

export function subjectContext(key: SubjectKey): string {
  return SUBJECT_PACKS[key]
}

function isSubjectKey(value: string): value is SubjectKey {
  return (SUBJECT_KEYS as readonly string[]).indexOf(value) >= 0
}

// The content generator's subject names, in its order, with the key each maps to.
const NAMED_SUBJECTS: readonly [string, SubjectKey][] = [
  ['Financial Reporting', 'financial-accounting'],
  ['Financial Accounting', 'financial-accounting'],
  ['Management Accounting', 'management-accounting'],
  ['Audit and Assurance', 'audit-assurance'],
  ['Taxation', 'taxation'],
  ['Financial Management', 'financial-management'],
  ['Performance Management', 'management-accounting'],
  ['Strategic Business', 'business-management'],
  ['Bookkeeping', 'financial-accounting'],
  ['Corporate Reporting', 'financial-accounting'],
  ['Business Economics', 'economics'],
]

// The content generator's keyword rules, in its order.
const KEYWORD_RULES: readonly [string[], SubjectKey][] = [
  [['REPORT', 'FR', 'SBR', 'CR'], 'financial-accounting'],
  [['AUDIT', 'ASSUR', 'AA', 'AAA'], 'audit-assurance'],
  [['TAX', 'TX', 'ATX', 'PNTA', 'BNTA'], 'taxation'],
  [['MANAGEMENT ACC', 'MA)', 'PM', 'APM', 'MATS', 'MDCL'], 'management-accounting'],
  [['FINANCIAL ACC', 'FA)', 'FAPS', 'FSLC'], 'financial-accounting'],
  [['FINANCIAL MAN', 'FM)', 'AFM', 'F3', 'CAFM'], 'financial-management'],
  [['PERFORM', 'APM', 'P2', 'P3', 'MDCL'], 'management-accounting'],
  [['STRATEGIC', 'SBL', 'E3', 'SBM'], 'business-management'],
  [['BOOK', 'BTRN', 'BKCL', 'AVBK'], 'financial-accounting'],
  [['CORPORATE', 'GROUP', 'FSLC'], 'financial-accounting'],
  [['ECON', 'BA1', 'BENV', 'BUAW'], 'economics'],
  // Added for the subjects the old list did not have.
  [['ETHIC'], 'ethics-professional-standards'],
  [['LAW', 'LEGAL', 'REGULAT'], 'business-law-regulation'],
  [['MARKET'], 'financial-market'],
]

/** A subject key for any subject text: a key itself, then the old matching rules, else 'general'. */
export function toSubjectKey(text: string): SubjectKey {
  const lower = text.trim().toLowerCase()
  if (!lower) return 'general'
  if (isSubjectKey(lower)) return lower
  const upper = lower.toUpperCase()
  for (const [name, key] of NAMED_SUBJECTS) {
    if (upper.indexOf(name.toUpperCase()) >= 0) return key
  }
  for (const [words, key] of KEYWORD_RULES) {
    if (words.some(word => upper.indexOf(word) >= 0)) return key
  }
  return 'general'
}
