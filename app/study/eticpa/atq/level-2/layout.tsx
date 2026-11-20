import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'ATQ Level 2 — Advanced Technician | ETICPA Study Notes',
  description: 'ETICPA ATQ Level 2 Advanced Technician — five modules covering Financial Accounting, Management Accounting, Assurance Controls and Ethics, Ethiopian Taxation and Ethiopian Public Sector Accounting. Free study notes.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-2' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
