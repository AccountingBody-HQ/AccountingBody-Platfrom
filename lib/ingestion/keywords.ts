// Canonical accounting & finance relevance keyword set.
// A job must contain at least one of these (case-insensitive) to pass relevance validation.
// Add new terms here — never hardcode elsewhere.

export const ACCOUNTING_FINANCE_KEYWORDS: string[] = [
  // Core role titles
  'accountant', 'auditor', 'bookkeeper', 'comptroller', 'controller',
  'treasurer', 'actuary', 'underwriter', 'analyst',

  // Seniority + role combinations
  'chief financial officer', 'CFO', 'finance director', 'FD',
  'financial controller', 'group financial controller',
  'chief accountant', 'group accountant', 'management accountant',
  'assistant accountant', 'accounts assistant', 'finance manager',
  'finance business partner', 'finance analyst', 'financial analyst',
  'senior accountant', 'junior accountant', 'staff accountant',
  'VP finance', 'head of finance', 'director of finance',

  // Audit & assurance
  'external auditor', 'internal auditor', 'audit manager',
  'audit senior', 'audit assistant', 'audit associate',
  'statutory audit', 'assurance', 'forensic accountant',
  'forensic audit',

  // Tax
  'tax accountant', 'tax manager', 'tax director', 'tax analyst',
  'tax adviser', 'tax advisor', 'tax consultant', 'tax specialist',
  'VAT', 'VAT manager', 'VAT accountant', 'transfer pricing',
  'corporate tax', 'personal tax', 'indirect tax', 'direct tax',
  'international tax', 'tax compliance', 'tax planning',
  'ATT', 'CTA', 'CIOT',

  // Financial reporting & technical
  'financial reporting', 'financial reporting manager',
  'group reporting', 'statutory reporting', 'management reporting',
  'consolidation', 'statutory accounts', 'annual report',
  'IFRS', 'UK GAAP', 'US GAAP', 'technical accounting',
  'revenue recognition', 'lease accounting',

  // FP&A & commercial
  'FP&A', 'financial planning', 'financial planning and analysis',
  'budgeting', 'forecasting', 'planning and analysis',
  'commercial finance', 'commercial analyst', 'business analyst',
  'commercial accountant', 'business partner',

  // Treasury & cash
  'treasury', 'treasurer', 'treasury analyst', 'treasury manager',
  'cash management', 'cash flow', 'liquidity', 'foreign exchange',
  'FX', 'hedging', 'treasury accountant',

  // Transactional finance
  'accounts payable', 'accounts receivable', 'AP', 'AR',
  'credit control', 'credit controller', 'billing', 'invoicing',
  'purchase ledger', 'sales ledger', 'ledger', 'reconciliation',
  'payroll', 'payroll manager', 'payroll accountant',
  'expenses', 'fixed assets',

  // Cost & management accounting
  'cost accountant', 'cost accounting', 'cost analyst',
  'management accounts', 'variance analysis', 'costing',
  'standard costing', 'product costing', 'project accounting',

  // Fund & investment accounting
  'fund accountant', 'fund accounting', 'investment accountant',
  'portfolio accountant', 'NAV', 'net asset value',
  'hedge fund', 'private equity', 'venture capital',
  'asset management', 'wealth management',

  // Risk & compliance
  'financial risk', 'risk analyst', 'risk manager',
  'compliance', 'compliance officer', 'regulatory reporting',
  'financial crime', 'AML', 'KYC', 'SOX', 'Sarbanes-Oxley',
  'internal controls', 'COSO',

  // Qualifications
  'ACA', 'ACCA', 'CIMA', 'CPA', 'CFA', 'ICAEW', 'ICAS',
  'AAT', 'CIPFA', 'CIA', 'CMA', 'CGMA', 'chartered accountant',
  'chartered certified accountant', 'qualified accountant',
  'part qualified', 'newly qualified', 'finalist',

  // Software & systems
  'SAP', 'Oracle', 'Xero', 'QuickBooks', 'Sage', 'NetSuite',
  'Workday', 'Dynamics', 'D365', 'Power BI', 'Hyperion',
  'OneStream', 'Anaplan', 'Cognos', 'TM1', 'BlackLine',
  'Concur', 'Coupa',

  // Sector / employer type
  'Big Four', 'Big 4', 'mid-tier', 'practice', 'industry',
  'financial services', 'banking', 'insurance', 'fintech',
  'real estate', 'property', 'retail', 'manufacturing',
  'public sector', 'charity', 'not for profit', 'NFP',
  'professional services',

  // Employment type qualifiers (help catch relevant contract/temp roles)
  'finance contract', 'accounting contract', 'interim finance',
  'interim accountant', 'interim CFO', 'interim financial controller',
  'locum accountant',
]
