import type { Metadata } from 'next'
import { headers } from 'next/headers'
import FindWorkClient from './FindWorkClient'
import { canonicalMetadata } from '@/lib/canonical'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Find Work | Accounting & Finance Recruitment',
    description: 'Register as a candidate with Accounting Body or EthioTax. We place accounting and finance professionals in permanent and contract roles.',
    ...(await canonicalMetadata('/jobs/find-work')),
  }
}

export default async function FindWorkPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <FindWorkClient isEthioTax={isEthioTax} />
}
