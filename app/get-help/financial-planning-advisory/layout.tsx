import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Financial Planning & Advisory | EthioTax',
  description: 'Personal and business financial planning for the Ethiopian community. EthioTax helps you build a secure financial future with expert advisory services.',
  alternates: { canonical: 'https://ethiotax.com/get-help/financial-planning-advisory' },
  openGraph: {
    title: 'Financial Planning & Advisory | EthioTax',
    description: 'Personal and business financial planning for the Ethiopian community. EthioTax helps you build a secure financial future with expert advisory services.',
    url: 'https://ethiotax.com/get-help/financial-planning-advisory',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
