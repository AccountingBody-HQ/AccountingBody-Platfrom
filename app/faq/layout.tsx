import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Got questions about EthioTax? Find answers to the most common questions about our accounting, tax and business consulting services for the Ethiopian community.',
  openGraph: {
    title: 'Frequently Asked Questions',
    description: 'Got questions about EthioTax? Find answers to the most common questions about our accounting, tax and business consulting services for the Ethiopian community.',
    url: 'https://ethiotax.com/faq',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
