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

export const ICAEW_STUDY_LINKS: NavLink[] = [
  { label: 'ACCA',        href: '/study/acca',   badge: 'Popular', description: 'All 13 ACCA papers covered' },
  { label: 'CIMA',        href: '/study/cima',                      description: 'Certificate to Strategic level' },
  { label: 'AAT',         href: '/study/aat',                       description: 'Level 2, 3 and 4 coverage' },
  { label: 'ICAEW / ACA', href: '/study/icaew',                     description: 'ACA qualification pathway' },
]
