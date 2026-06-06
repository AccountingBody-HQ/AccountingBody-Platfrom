import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tax Filing & Compliance | EthioTax',
  description: 'Expert tax filing and compliance services for the Ethiopian diaspora. EthioTax handles your UK and international tax obligations with precision and care.',
  alternates: { canonical: 'https://ethiotax.com/get-help/tax-filing-compliance' },
  openGraph: {
    title: 'Tax Filing & Compliance | EthioTax',
    description: 'Expert tax filing and compliance services for the Ethiopian diaspora. EthioTax handles your UK and international tax obligations with precision and care.',
    url: 'https://ethiotax.com/get-help/tax-filing-compliance',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
