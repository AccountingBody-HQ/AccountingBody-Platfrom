import type { Metadata } from 'next'
import { headers } from 'next/headers'
import FindWorkClient from './FindWorkClient'
import { ownerCanonical } from '@/lib/canonical'
import { getRequestBrand } from '@/lib/brand-server'

export async function generateMetadata(): Promise<Metadata> {
  const { isEthioTax } = await getRequestBrand()
  return {
    title: 'Find Work | Accounting & Finance Recruitment',
    description: isEthioTax
      ? 'Register as a candidate with EthioTax. We place accounting and finance professionals in permanent and contract roles.'
      : 'Register as a candidate with Accounting Body or EthioTax. We place accounting and finance professionals in permanent and contract roles.',
    ...ownerCanonical('accountingbody', '/jobs/find-work'),
  }
}

export default async function FindWorkPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <FindWorkClient isEthioTax={isEthioTax} />
}
