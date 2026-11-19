import { headers } from 'next/headers'
import FindWorkManageClient from './FindWorkManageClient'
import { getRequestBrand } from '@/lib/brand-server'

export async function generateMetadata() {
  const { name } = await getRequestBrand()
  return {
    title: `Manage Your Candidate Profile | ${name} Recruitment`,
    description: 'Update your candidate profile, role preferences, and availability.',
    // Private, token-gated self-service page (token read client-side from the
    // URL) with no outbound content links — nothing for a crawler to index or
    // follow onward.
    robots: { index: false, follow: false },
  }
}

export default async function FindWorkManagePage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <FindWorkManageClient isEthioTax={isEthioTax} />
}
