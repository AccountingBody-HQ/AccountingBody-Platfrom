// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTING & FINANCE KEYWORD TAXONOMY
// Single source of truth for all keyword logic across the platform.
//
// Structure:
//   KEYWORD_TAXONOMY        — organised by category, for future AI/search use
//   ACCOUNTING_FINANCE_KEYWORDS — flat array for relevance filtering
//   PROVIDER_QUERY_KEYWORDS — curated subset for API provider query terms
//
// To add a term: add it to the correct category in KEYWORD_TAXONOMY.
// It will automatically flow into both derived exports.
// Never hardcode keywords anywhere else.
// ─────────────────────────────────────────────────────────────────────────────

export const KEYWORD_TAXONOMY = {

  // ── Qualifications — global ───────────────────────────────────────────────
  qualifications_global: [
    'ACA', 'ACCA', 'CIMA', 'CPA', 'CFA', 'ICAEW', 'ICAS',
    'AAT', 'ATT', 'CTA', 'CIOT', 'CIA', 'CMA', 'CGMA',
    'CIPFA', 'CFE', 'CGA', 'ACAG',
    'chartered accountant', 'chartered certified accountant',
    'qualified accountant', 'part qualified', 'newly qualified',
    'finalist', 'ACA qualified', 'ACCA qualified', 'CIMA qualified',
    'ACA studier', 'ACCA studier', 'CIMA studier',
    'AAT qualified', 'ATT qualified', 'CTA qualified',
    'ICAEW member', 'ACCA affiliate',
  ],

  // ── Qualifications — African & regional ───────────────────────────────────
  qualifications_regional: [
    'ICPAK', 'ICAN', 'ETICPA', 'SAICA', 'ICAZ', 'NBAA',
    'ICPAU', 'ICPA', 'ICPAM', 'ISCA', 'ICAI',
  ],

  // ── Core role titles ──────────────────────────────────────────────────────
  roles_core: [
    'accountant', 'auditor', 'bookkeeper', 'comptroller', 'controller',
    'treasurer', 'actuary', 'underwriter', 'analyst',
    'financial accountant', 'group accountant', 'senior accountant',
    'junior accountant', 'staff accountant', 'assistant accountant',
    'accounts assistant', 'finance assistant', 'accounting assistant',
    'finance officer', 'finance executive', 'finance coordinator',
    'finance administrator', 'finance clerk', 'accounts clerk',
    'billing clerk', 'ledger clerk', 'purchase ledger clerk',
    'sales ledger clerk',
    'accounts senior', 'accounts supervisor',
    'accounts coordinator', 'accounts administrator',
    'accounts operations', 'accounts technician', 'bursar',
    'school bursar', 'accounts lead',
  ],

  // ── Seniority & leadership ────────────────────────────────────────────────
  roles_senior: [
    'CFO', 'chief financial officer', 'finance director', 'FD',
    'financial controller', 'group financial controller',
    'chief accountant', 'head of finance', 'director of finance',
    'director of accounting', 'head of accounting',
    'VP finance', 'VP FP&A', 'group finance director',
    'deputy CFO', 'associate director finance', 'finance lead',
    'controllership', 'head of controllership', 'group controller',
    'regional controller', 'divisional accountant', 'regional accountant',
    'head of tax', 'head of treasury', 'head of audit',
    'head of reporting', 'head of FP&A', 'head of commercial finance',
    'finance manager', 'accounts manager', 'finance business partner',
    'finance partner', 'business partnering',
    'financial director', 'financial control',
    'head of financial control', 'finance and operations director',
    'finance operations director', 'director of financial control',
  ],

  // ── Audit & assurance ─────────────────────────────────────────────────────
  roles_audit: [
    'external auditor', 'internal auditor', 'audit manager',
    'audit senior', 'audit assistant', 'audit associate',
    'audit director', 'senior auditor', 'audit partner',
    'statutory audit', 'assurance', 'forensic accountant',
    'forensic accounting', 'forensic audit', 'fraud examiner',
    'internal audit', 'external audit',
  ],

  // ── Tax ───────────────────────────────────────────────────────────────────
  roles_tax: [
    'tax accountant', 'tax manager', 'tax director', 'tax analyst',
    'tax adviser', 'tax advisor', 'tax consultant', 'tax specialist',
    'tax associate', 'tax partner', 'tax compliance', 'tax planning',
    'tax reporting', 'VAT', 'VAT manager', 'VAT accountant',
    'VAT analyst', 'transfer pricing', 'corporate tax', 'personal tax',
    'indirect tax', 'direct tax', 'international tax',
    'private client tax', 'tax and consulting', 'audit and tax',
    'tax consulting', 'tax technology', 'tax advisory',
    'trust and tax', 'tax accounts', 'trust tax',
    'trust accountant', 'trust manager', 'private client',
  ],

  // ── Financial reporting & technical ───────────────────────────────────────
  roles_reporting: [
    'financial reporting', 'financial reporting manager',
    'group reporting', 'statutory reporting', 'management reporting',
    'consolidation', 'statutory accounts', 'annual report',
    'technical accountant', 'consolidation accountant',
    'group financial accountant', 'reporting accountant',
    'financial reporting analyst', 'financial reporting manager',
    'IFRS', 'UK GAAP', 'US GAAP', 'GAAP', 'FRS102',
    'revenue recognition', 'lease accounting',
    'reporting manager', 'reporting analyst',
    'external reporting', 'internal reporting',
    'client reporting', 'capital reporting',
    'regulatory reporting manager', 'reporting specialist',
    'finance reporting',
    'capital management', 'international reporting',
    'group financial reporting',
  ],

  // ── FP&A & commercial ─────────────────────────────────────────────────────
  roles_fpa: [
    'FP&A', 'financial planning', 'financial planning and analysis',
    'FP&A analyst', 'FP&A manager', 'FP&A director',
    'budgeting', 'forecasting', 'planning and analysis',
    'commercial finance', 'commercial analyst', 'commercial accountant',
    'commercial finance manager', 'finance analyst', 'financial analyst',
    'business analyst', 'finance business partner',
    'P&L', 'profit and loss', 'variance analysis',
    'finance process', 'finance ops',
    'financial operations analyst',
  ],

  // ── Treasury & cash ───────────────────────────────────────────────────────
  roles_treasury: [
    'treasury', 'treasurer', 'treasury analyst', 'treasury manager',
    'treasury accountant', 'treasury director', 'head of treasury',
    'cash management', 'cash flow', 'liquidity', 'foreign exchange',
    'FX', 'hedging', 'working capital',
  ],

  // ── Transactional finance ─────────────────────────────────────────────────
  roles_transactional: [
    'accounts payable', 'accounts receivable', 'AP', 'AR',
    'credit control', 'credit controller', 'credit manager',
    'billing', 'invoicing', 'purchase ledger', 'sales ledger',
    'general ledger', 'GL accountant', 'AR analyst', 'AP analyst',
    'AR manager', 'AP manager', 'payroll', 'payroll manager',
    'payroll accountant', 'payroll specialist', 'payroll administrator',
    'payroll officer', 'payroll analyst', 'expenses',
    'collections analyst', 'collections manager', 'debtor management',
    'fixed assets', 'fixed asset accountant', 'capex', 'opex',
    'capex accountant', 'WIP accountant', 'reconciliation',
    'billings manager', 'billings analyst', 'billings specialist',
    'invoicing manager', 'revenue operations analyst',
  ],

  // ── Cost & management accounting ──────────────────────────────────────────
  roles_cost: [
    'cost accountant', 'cost accounting', 'cost analyst',
    'cost controller', 'cost manager', 'management accountant',
    'management accounts', 'management accounting',
    'management reporting', 'costing', 'standard costing',
    'product costing', 'project accounting', 'project accountant',
    'project finance',
  ],

  // ── Fund & investment accounting ──────────────────────────────────────────
  roles_fund: [
    'fund accountant', 'fund accounting', 'fund administrator',
    'investment accountant', 'portfolio accountant',
    'NAV', 'net asset value', 'hedge fund', 'private equity',
    'venture capital', 'asset management', 'wealth management',
    'portfolio analyst', 'portfolio manager', 'investment analyst',
    'equity analyst', 'financial modelling', 'financial modeling',
    'valuation analyst', 'valuation manager',
    'mergers and acquisitions', 'M&A analyst', 'deal analyst',
    'transaction services', 'due diligence', 'corporate finance analyst',
    'fund administration', 'fund administration specialist',
    'fund operations', 'fund reporting', 'valuations director',
    'valuations manager', 'forex trader', 'FX trader',
    'structured finance', 'pension risk transfer',
    'pricing manager', 'pricing analyst',
  ],

  // ── Risk & compliance ─────────────────────────────────────────────────────
  roles_risk: [
    'financial risk', 'risk analyst', 'risk manager',
    'compliance', 'compliance officer', 'compliance manager',
    'compliance analyst', 'regulatory reporting',
    'financial crime', 'AML', 'AML analyst', 'anti-money laundering',
    'KYC', 'KYC analyst', 'SOX', 'Sarbanes-Oxley',
    'internal controls', 'COSO', 'credit risk', 'market risk',
    'operational risk', 'enterprise risk',
    'credit portfolio', 'portfolio management', 'credit analyst',
  ],

  // ── Systems & ERP ─────────────────────────────────────────────────────────
  software: [
    'SAP', 'SAP finance', 'SAP FICO', 'Oracle', 'Oracle finance',
    'Oracle financials', 'Xero', 'Xero accountant',
    'QuickBooks', 'QuickBooks accountant', 'Sage', 'Sage accountant',
    'Sage Intacct', 'NetSuite', 'NetSuite accountant', 'Workday',
    'Dynamics', 'D365', 'Dynamics 365 finance', 'Dynamics finance',
    'Power BI', 'Hyperion', 'OneStream', 'Anaplan', 'Cognos', 'TM1',
    'BlackLine', 'Concur', 'Coupa', 'ERP', 'ERP finance',
    'ERP consultant', 'ERP analyst', 'systems accountant',
    'finance systems', 'accounting software', 'cloud accounting',
  ],

  // ── Sector & employer type ────────────────────────────────────────────────
  sectors: [
    'Big Four', 'Big 4', 'mid-tier', 'practice', 'industry',
    'financial services', 'banking', 'retail banking',
    'investment banking', 'commercial banking', 'insurance', 'fintech',
    'real estate', 'property', 'retail', 'manufacturing',
    'public sector', 'charity', 'not for profit', 'NFP',
    'professional services', 'energy finance', 'oil and gas finance',
    'shipping finance', 'aviation finance', 'media finance',
    'film finance', 'tech finance', 'healthcare finance',
    'pharma finance', 'construction finance', 'retail finance',
    'hospitality finance', 'real estate finance', 'property accountant',
    'property finance', 'charity accountant', 'charity finance',
    'NGO finance', 'third sector finance', 'public finance',
    'local government finance', 'NHS finance',
    'actuarial analyst', 'actuarial consultant',
    'pension accountant', 'pension administrator', 'pensions finance',
    'shared services', 'finance shared services', 'GBS finance',
    'Grant Thornton', 'BDO', 'RSM', 'Mazars',
  ],

  // ── Practice & outsourced ─────────────────────────────────────────────────
  practice: [
    'practice accountant', 'public practice', 'accounting practice',
    'accounts preparation', 'bookkeeping service', 'outsourced accounting',
    'outsourced CFO', 'fractional CFO', 'virtual CFO',
    'interim finance director', 'interim financial controller',
    'interim CFO', 'interim accountant', 'finance contract',
    'accounting contract', 'interim finance', 'locum accountant',
    'audit partner', 'tax partner', 'practice manager',
  ],

  // ── Emerging & specialist ─────────────────────────────────────────────────
  emerging: [
    'ESG reporting', 'sustainability reporting', 'carbon accounting',
    'crypto accounting', 'digital assets finance', 'revenue operations',
    'finance transformation', 'financial operations',
    'finance operations', 'insolvency', 'restructuring',
    'forensic account', 'pension accountant',
  ],

  // ── Study & graduate ──────────────────────────────────────────────────────
  graduate: [
    'finance graduate', 'accounting graduate', 'finance trainee',
    'accounting trainee', 'finance apprentice', 'accounting apprentice',
    'graduate scheme', 'school leaver', 'finance internship',
    'accounting internship',
  ],

} as const

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED EXPORTS — do not edit these directly, edit KEYWORD_TAXONOMY above
// ─────────────────────────────────────────────────────────────────────────────

// Flat array of every keyword — used for relevance filtering
export const ACCOUNTING_FINANCE_KEYWORDS: string[] = Object.values(KEYWORD_TAXONOMY).flat()

// Curated subset for API provider query terms — roles and qualifications only.
// These are the terms sent as search queries to external APIs (Adzuna etc).
// Kept focused so API calls return precise, relevant results.
export const PROVIDER_QUERY_KEYWORDS: string[] = [
  ...KEYWORD_TAXONOMY.qualifications_global,
  ...KEYWORD_TAXONOMY.qualifications_regional,
  ...KEYWORD_TAXONOMY.roles_core,
  ...KEYWORD_TAXONOMY.roles_senior,
  ...KEYWORD_TAXONOMY.roles_audit,
  ...KEYWORD_TAXONOMY.roles_tax,
  ...KEYWORD_TAXONOMY.roles_reporting,
  ...KEYWORD_TAXONOMY.roles_fpa,
  ...KEYWORD_TAXONOMY.roles_treasury,
  ...KEYWORD_TAXONOMY.roles_transactional,
  ...KEYWORD_TAXONOMY.roles_cost,
  ...KEYWORD_TAXONOMY.roles_fund,
  ...KEYWORD_TAXONOMY.roles_risk,
]

// Curated keyword set for Adzuna API queries.
// These are sent as individual search terms to the Adzuna API.
// Adzuna fans out one API call per keyword, so this set must be
// broad enough for full coverage but focused enough to avoid
// rate limit exhaustion.
// Target: 50-80 high-signal, distinct terms that Adzuna returns
// different results for. Avoid near-duplicates that would return
// the same jobs.
export const ADZUNA_QUERY_KEYWORDS: string[] = [
  // Core roles
  'accountant', 'auditor', 'bookkeeper', 'treasurer', 'actuary',

  // Seniority
  'CFO', 'finance director', 'financial controller',
  'management accountant', 'assistant accountant',
  'finance manager', 'finance business partner',
  'head of finance', 'group accountant',

  // Audit
  'audit manager', 'internal auditor', 'external auditor',
  'forensic accountant',

  // Tax
  'tax accountant', 'tax manager', 'tax consultant',
  'VAT accountant', 'transfer pricing', 'corporate tax',

  // Reporting
  'financial reporting', 'consolidation accountant',
  'statutory accountant', 'management reporting',

  // FP&A
  'FP&A', 'financial planning', 'commercial finance',
  'financial analyst', 'finance analyst',

  // Treasury
  'treasury analyst', 'treasury manager', 'cash manager',

  // Transactional
  'accounts payable', 'accounts receivable', 'credit controller',
  'payroll manager', 'purchase ledger', 'sales ledger',
  'billing manager', 'cost accountant',

  // Fund & investment
  'fund accountant', 'investment accountant',
  'portfolio accountant',

  // Risk & compliance
  'compliance officer', 'risk analyst', 'AML analyst',
  'financial crime',

  // Qualifications — global
  'ACA', 'ACCA', 'CIMA', 'CPA', 'CFA', 'AAT', 'CIPFA',

  // Qualifications — African & regional
  'ICPAK', 'ICAN', 'SAICA', 'ICAZ',

  // Software (high signal for specialist roles)
  'SAP finance', 'Oracle finance', 'NetSuite accountant',

  // Sector
  'practice accountant', 'interim accountant',
  'outsourced accountant', 'fractional CFO',
]
