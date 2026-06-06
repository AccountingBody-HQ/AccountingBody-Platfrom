import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit & Assurance | EthioTax',
  description: 'Independent audit and assurance services for Ethiopian businesses. EthioTax delivers thorough, professional audits that give you and your stakeholders confidence.',
  alternates: { canonical: 'https://ethiotax.com/get-help/audit-assurance' },
  openGraph: {
    title: 'Audit & Assurance | EthioTax',
    description: 'Independent audit and assurance services for Ethiopian businesses. EthioTax delivers thorough, professional audits that give you and your stakeholders confidence.',
    url: 'https://ethiotax.com/get-help/audit-assurance',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
