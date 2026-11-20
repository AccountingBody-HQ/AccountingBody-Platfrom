import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'Assurance, Controls & Ethics | ATQ Level 2 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Assurance, Controls & Ethics — ATQ Level 2 Advanced Technician. Internal controls, audit procedures, professional ethics, risk assessment and assurance engagements.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-2/assurance-controls-ethics',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-2/assurance-controls-ethics' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
