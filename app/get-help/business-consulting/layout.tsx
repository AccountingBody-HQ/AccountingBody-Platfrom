import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Business Consulting | EthioTax',
  description: 'Strategic business consulting for Ethiopian entrepreneurs and businesses. EthioTax helps you plan, grow and succeed with expert guidance at every stage.',
  alternates: { canonical: 'https://ethiotax.com/get-help/business-consulting' },
  openGraph: {
    title: 'Business Consulting | EthioTax',
    description: 'Strategic business consulting for Ethiopian entrepreneurs and businesses. EthioTax helps you plan, grow and succeed with expert guidance at every stage.',
    url: 'https://ethiotax.com/get-help/business-consulting',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
