import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'Ethiopian Taxation | ATQ Level 2 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Ethiopian Taxation — ATQ Level 2 Advanced Technician. ERCA tax administration, income tax for individuals and businesses, VAT and customs duty.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/ethiopian-taxation',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-2/ethiopian-taxation' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
