import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'Introduction to Accounting Mock Exam | EthioTax ETICPA',
  description: 'Take a free 50-question mock exam for the ETICPA ATQ Level 1 Introduction to Accounting module. Questions are randomly selected and balanced across all topics.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/introduction-to-accounting/mock-exam',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-1/introduction-to-accounting/mock-exam' },
}

export default function MockExamLayout({ children }: { children: React.ReactNode }) {
  return children
}
