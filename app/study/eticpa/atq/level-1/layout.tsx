import type { Metadata } from 'next'
import { metadata as eticpa } from '@/app/study/eticpa/layout'

export const metadata: Metadata = {
  title: 'ATQ Level 1 — Foundation Technician | ETICPA Study Notes',
  description: 'ETICPA ATQ Level 1 Foundation Technician — four modules covering Introduction to Accounting, Cost Accounting, Business Skills and Ethiopian Business Law. Free study notes.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1',
  },
  // og:title/og:description stay the ETICPA values this page inherited; og:url is its own (D272).
  openGraph: { ...eticpa.openGraph, url: 'https://ethiotax.com/study/eticpa/atq/level-1' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
