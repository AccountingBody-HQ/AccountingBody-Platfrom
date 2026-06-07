import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ATQ Level 2 — Advanced Technician | ETICPA Study Notes',
  description: 'ETICPA ATQ Level 2 Advanced Technician — five modules covering Financial Accounting, Management Accounting, Assurance Controls and Ethics, Ethiopian Taxation and Ethiopian Public Sector Accounting. Free study notes.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
