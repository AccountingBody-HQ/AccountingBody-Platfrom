import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'About EthioTax | Accounting & Tax for the Ethiopian Community' },
  description: 'EthioTax is a managed professional services firm built exclusively for the Ethiopian diaspora. We deliver accounting, tax, audit, payroll and business consulting worldwide.',
  openGraph: {
    title: { absolute: 'About EthioTax | Accounting & Tax for the Ethiopian Community' },
    description: 'EthioTax is a managed professional services firm built exclusively for the Ethiopian diaspora. We deliver accounting, tax, audit, payroll and business consulting worldwide.',
    url: 'https://ethiotax.com/about-ethiotax',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
