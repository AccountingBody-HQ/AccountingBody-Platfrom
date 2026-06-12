import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CompanyFormationClient from './_client'

export default async function CompanyFormationPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'

  if (!isEthioTax) {
    redirect('/get-help/company-formation')
  }

  return <CompanyFormationClient />
}
