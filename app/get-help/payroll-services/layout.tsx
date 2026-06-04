import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payroll Services | EthioTax',
  description: 'Reliable payroll services for Ethiopian businesses. EthioTax manages your payroll accurately and on time so you can focus on running your business.',
  openGraph: {
    title: 'Payroll Services | EthioTax',
    description: 'Reliable payroll services for Ethiopian businesses. EthioTax manages your payroll accurately and on time so you can focus on running your business.',
    url: 'https://ethiotax.com/get-help/payroll-services',
    siteName: 'EthioTax',
    locale: 'en_GB',
    type: 'website',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
