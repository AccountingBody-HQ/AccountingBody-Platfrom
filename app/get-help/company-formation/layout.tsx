import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Company Formation | EthioTax',
  description: 'Set up your UK or Ethiopian company with confidence. EthioTax guides you through every step of company formation with expert support and local knowledge.',
  openGraph: {
    title: 'Company Formation | EthioTax',
    description: 'Set up your UK or Ethiopian company with confidence. EthioTax guides you through every step of company formation with expert support and local knowledge.',
    url: 'https://ethiotax.com/get-help/company-formation',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
