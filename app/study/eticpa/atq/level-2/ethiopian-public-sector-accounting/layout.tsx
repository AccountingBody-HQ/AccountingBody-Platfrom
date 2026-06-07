import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ethiopian Public Sector Accounting | ATQ Level 2 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Ethiopian Public Sector Accounting — ATQ Level 2 Advanced Technician. Public financial management, government accounting standards, budget execution and public sector audit.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/ethiopian-public-sector-accounting',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
