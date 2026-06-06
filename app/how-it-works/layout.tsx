import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'See how EthioTax manages your accounting, tax and business needs from start to finish. A fully managed service built exclusively for the Ethiopian community.',
  alternates: { canonical: 'https://ethiotax.com/how-it-works' },
  openGraph: {
    title: 'How It Works',
    description: 'See how EthioTax manages your accounting, tax and business needs from start to finish. A fully managed service built exclusively for the Ethiopian community.',
    url: 'https://ethiotax.com/how-it-works',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
