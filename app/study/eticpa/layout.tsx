import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ETICPA Study Notes | CPA & ATQ Qualification | EthioTax',
  description: 'Study notes, worked examples and exam guides for the ETICPA CPA and ATQ qualifications — built for Ethiopian finance professionals worldwide.',
  alternates: { canonical: 'https://ethiotax.com/study/eticpa' },
  openGraph: {
    title: 'ETICPA Study Notes | CPA & ATQ Qualification | EthioTax',
    description: 'Study notes, worked examples and exam guides for the ETICPA CPA and ATQ qualifications — built for Ethiopian finance professionals worldwide.',
    url: 'https://ethiotax.com/study/eticpa',
  },
}

export default function ETICPALayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
