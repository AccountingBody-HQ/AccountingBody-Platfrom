import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'Introduction to Accounting | ATQ Level 1 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Introduction to Accounting — ATQ Level 1 Foundation Technician. The accounting equation, double-entry bookkeeping, trial balance and financial statements.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/introduction-to-accounting',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-1/introduction-to-accounting' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
