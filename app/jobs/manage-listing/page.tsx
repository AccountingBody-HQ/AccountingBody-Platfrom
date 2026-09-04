import { headers } from 'next/headers'
import ManageListingClient from './ManageListingClient'

export const metadata = {
  title: 'Manage Your Job Listing | AccountingBody',
}

export default async function ManageListingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const sp = await searchParams
  const token = sp.token ?? ''
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <ManageListingClient token={token} isEthioTax={isEthioTax} />
}
