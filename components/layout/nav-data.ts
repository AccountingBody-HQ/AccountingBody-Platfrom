// components/layout/nav-data.ts
// Shared navigation data — imported by server wrapper and client component

export interface NavLink {
  label:        string
  href:         string
  badge?:       string
  description?: string
  external?:    boolean
}

export interface NavSection {
  id:        string
  label:     string
  href?:     string
  external?: boolean
  featured?: NavLink
  groups?:   { title: string; links: NavLink[] }[]
  cta?:      { label: string; href: string; description: string }
}

export const ETICPA_STUDY_LINKS: NavLink[] = [
  { label: 'ETICPA / CPA', href: '/study/eticpa', description: "Ethiopia's national CPA qualification" },
  { label: 'ACCA',         href: '/study/acca',   badge: 'Popular', description: 'All 13 ACCA papers covered' },
  { label: 'CIMA',         href: '/study/cima',   description: 'Certificate to Strategic level' },
  { label: 'AAT',          href: '/study/aat',    description: 'Level 2, 3 and 4 coverage' },
]

export const ET_GET_HELP_LINKS = {
  groups: [
    {
      title: 'Professional Services',
      links: [
        { label: 'Tax Filing & Compliance',    href: '/get-help/tax-filing-compliance',       description: 'UK, US, Canadian and Ethiopian tax returns' },
        { label: 'Accounting & Bookkeeping',   href: '/get-help/accounting-bookkeeping',      description: 'Accurate books and annual accounts' },
        { label: 'Business Consulting',        href: '/get-help/business-consulting',         description: 'Strategy, business plans and diaspora investment' },
        { label: 'Payroll Services',           href: '/get-help/payroll-services',            description: 'UK PAYE, Ethiopian payroll and pension' },
      ],
    },
    {
      title: 'More Services',
      links: [
        { label: 'Company Formation',          href: '/get-help/company-formation',           description: 'UK, US, Canadian and Ethiopian registration' },
        { label: 'Audit & Assurance',          href: '/get-help/audit-assurance',             description: 'Statutory audit and ETICPA-standard audit' },
        { label: 'Financial Planning',         href: '/get-help/financial-planning-advisory', description: 'Personal and business financial planning' },
      ],
    },
  ],
  cta: {
    label:       'View all services →',
    href:        '/get-help',
    description: 'EthioTax responds within 24 hours',
  },
}

export const ICAEW_STUDY_LINKS: NavLink[] = [
  { label: 'ACCA',        href: '/study/acca',   badge: 'Popular', description: 'All 13 ACCA papers covered' },
  { label: 'CIMA',        href: '/study/cima',                      description: 'Certificate to Strategic level' },
  { label: 'AAT',         href: '/study/aat',                       description: 'Level 2, 3 and 4 coverage' },
  { label: 'ICAEW / ACA', href: '/study/icaew',                     description: 'ACA qualification pathway' },
]

// ET Company Navigation Links — added Session 37
export const ET_COMPANY_LINKS = {
  groups: [
    {
      title: 'About',
      links: [
        { label: 'About EthioTax', href: '/about-ethiotax', description: 'Our mission, values and team of specialists' },
        { label: 'How It Works',   href: '/how-it-works',   description: 'A fully managed service, from start to finish' },
        { label: 'FAQ',            href: '/faq',            description: 'Everything you need to know about working with us' },
      ],
    },
    {
      title: 'Get Started',
      links: [
        { label: 'Enquire About a Service', href: '/get-help',     description: 'Tell us what you need — we respond within 24 hours' },
        { label: 'Talk to Us on WhatsApp',  href: '/wa',           description: 'Speak to our team directly' },
        { label: 'Join as a Provider',      href: '/firms-freelancers', description: 'Apply to join the EthioTax specialist network' },
      ],
    },
  ],
  cta: {
    label: 'About EthioTax →',
    href: '/about-ethiotax',
    description: 'Managed professional services for the Ethiopian community',
  },
}
