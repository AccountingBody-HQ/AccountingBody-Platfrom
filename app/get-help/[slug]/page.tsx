import { headers } from 'next/headers'
import ServicePageClient from '../_service-page-client'

export default async function GetHelpSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <ServicePageClient params={{ slug }} isEthioTax={isEthioTax} />
}
