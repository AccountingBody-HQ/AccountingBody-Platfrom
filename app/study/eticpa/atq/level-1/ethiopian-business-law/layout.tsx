import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ethiopian Business Law | ATQ Level 1 | ETICPA Study Notes',
  description: 'Free ETICPA study notes for Ethiopian Business Law — ATQ Level 1 Foundation Technician. Ethiopian commercial law, contract law, business organisations, employment law and regulatory framework.',
  alternates: {
    canonical: 'https://ethiotax.com/study/eticpa/atq/level-1/ethiopian-business-law',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
