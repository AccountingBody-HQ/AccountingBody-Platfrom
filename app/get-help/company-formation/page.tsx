import type { Metadata } from 'next'
import { headers } from 'next/headers'
import CompanyFormationClient from './_client'
import ServicePageClient from '../_service-page-client'
import { canonicalMetadata, ownerCanonical } from '@/lib/canonical'

// Moved here from ./layout.tsx for consistency with ../page.tsx (/get-help) —
// title/description/openGraph sub-fields carried over verbatim; only
// alternates.canonical and openGraph.url are corrected.
//
// A split page (owner rule D272): the EthioTax view shows the EthioTax
// company-formation page and names ethiotax.com; the Accounting Body view
// shows the generic service page, whose owner is still pending, so it keeps
// the host-based value.
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const { alternates, openGraph } = isEthioTax
    ? ownerCanonical('ethiotax', '/get-help/company-formation')
    : await canonicalMetadata('/get-help/company-formation')
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
