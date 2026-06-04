import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accounting & Bookkeeping | EthioTax',
  description: 'Professional accounting and bookkeeping services tailored for Ethiopian businesses and individuals. Stay compliant and in control of your finances with EthioTax.',
  openGraph: {
    title: 'Accounting & Bookkeeping | EthioTax',
    description: 'Professional accounting and bookkeeping services tailored for Ethiopian businesses and individuals. Stay compliant and in control of your finances with EthioTax.',
    url: 'https://ethiotax.com/get-help/accounting-bookkeeping',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
