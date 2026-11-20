import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'Business Skills | ATQ Level 1 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Business Skills — ATQ Level 1 Foundation Technician. Professional communication, workplace competencies, IT in finance, ethics and personal effectiveness.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/business-skills',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-1/business-skills' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
