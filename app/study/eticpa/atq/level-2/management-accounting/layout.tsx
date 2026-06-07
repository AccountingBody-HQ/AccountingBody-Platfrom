import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Management Accounting | ATQ Level 2 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Management Accounting — ATQ Level 2 Advanced Technician. Budgeting, variance analysis, performance measurement, decision making and management reporting.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/management-accounting',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
