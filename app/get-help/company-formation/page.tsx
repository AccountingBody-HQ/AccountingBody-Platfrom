import { headers } from 'next/headers'
import CompanyFormationClient from './_client'
import ServicePageClient from '../_service-page-client'

export default async function CompanyFormationPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (isEthioTax) return <CompanyFormationClient />
  return <ServicePageClient params={{ slug: 'company-formation' }} />
}
