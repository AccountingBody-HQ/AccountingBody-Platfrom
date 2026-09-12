import type { Metadata } from 'next'
import { headers } from 'next/headers'
import CompanyFormationClient from './_client'
import ServicePageClient from '../_service-page-client'
import { canonicalMetadata } from '@/lib/canonical'

// Moved here from ./layout.tsx for consistency with ../page.tsx (/get-help) —
// title/description/openGraph sub-fields carried over verbatim; only
// alternates.canonical and openGraph.url are corrected.
export async function generateMetadata(): Promise<Metadata> {
  const { alternates, openGraph } = await canonicalMetadata('/get-help/company-formation')
  return {
    title: 'Company Formation | EthioTax',
    description: 'Set up your UK or Ethiopian company with confidence. EthioTax guides you through every step of company formation with expert support and local knowledge.',
    alternates,
    openGraph: {
      title: 'Company Formation | EthioTax',
      description: 'Set up your UK or Ethiopian company with confidence. EthioTax guides you through every step of company formation with expert support and local knowledge.',
      siteName: 'EthioTax',
      locale: 'en_GB',
      type: 'website',
      url: openGraph.url,
    },
  }
}

export default async function CompanyFormationPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (isEthioTax) return <CompanyFormationClient />
  return <ServicePageClient params={{ slug: 'company-formation' }} />
}
