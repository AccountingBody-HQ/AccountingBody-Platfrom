import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'
export const metadata: Metadata = {
  title: 'Management Accounting Mock Exam | EthioTax ETICPA',
  description: 'Practice the Management Accounting mock exam for ETICPA ATQ Level 2. 50 questions drawn from a pool of 437+ practice questions.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/management-accounting/mock-exam',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-2/management-accounting/mock-exam' },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
