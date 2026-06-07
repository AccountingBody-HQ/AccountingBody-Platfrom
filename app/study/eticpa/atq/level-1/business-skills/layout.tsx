import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Business Skills | ATQ Level 1 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Business Skills — ATQ Level 1 Foundation Technician. Professional communication, workplace competencies, IT in finance, ethics and personal effectiveness.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/business-skills',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
