import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Financial Accounting | ATQ Level 2 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Financial Accounting — ATQ Level 2 Advanced Technician. Financial statements under Ethiopian GAAP, accounting standards, company accounts and consolidated statements.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/financial-accounting',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
