import { headers } from 'next/headers'
import ManageListingClient from './ManageListingClient'

export const metadata = {
  title: 'Manage Your Job Listing | AccountingBody',
  // Private, token-gated self-service page. Its own content links out to
  // /jobs/listings (already indexable on its own) — keep follow so that
  // link equity still flows, even though this page itself shouldn't rank.
  robots: { index: false, follow: true },
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
