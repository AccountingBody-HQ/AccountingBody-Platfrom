import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'Ethiopian Business Law | ATQ Level 1 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Ethiopian Business Law — ATQ Level 1 Foundation Technician. Ethiopian commercial law, contract law, business organisations, employment law and regulatory framework.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/ethiopian-business-law',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-1/ethiopian-business-law' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
