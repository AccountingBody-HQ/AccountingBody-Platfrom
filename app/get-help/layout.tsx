import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Help | EthioTax Professional Services',
  description: 'Explore EthioTax professional services — tax filing, accounting, payroll, business consulting, company formation, audit and financial planning for the Ethiopian community.',
  openGraph: {
    title: 'Get Help | EthioTax Professional Services',
    description: 'Explore EthioTax professional services — tax filing, accounting, payroll, business consulting, company formation, audit and financial planning for the Ethiopian community.',
    url: 'https://ethiotax.com/get-help',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
