import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'CPA — Certified Public Accountant | ETICPA Study Notes',
  description: 'ETICPA CPA — Certified Public Accountant qualification. The syllabus is currently under development by ETICPA. Study notes will be published as soon as the official papers are confirmed.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/cpa',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/cpa' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
