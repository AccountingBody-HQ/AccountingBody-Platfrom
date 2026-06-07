import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ATQ Level 1 — Foundation Technician | ETICPA Study Notes',
  description: 'ETICPA ATQ Level 1 Foundation Technician — four modules covering Introduction to Accounting, Cost Accounting, Business Skills and Ethiopian Business Law. Free study notes.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
