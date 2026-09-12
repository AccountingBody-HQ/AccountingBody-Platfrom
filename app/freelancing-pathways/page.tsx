import { headers } from 'next/headers'
import type { Metadata } from 'next'
import FreelancingPathwaysClient from './FreelancingPathwaysClient'
import { canonicalMetadata } from '@/lib/canonical'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:       'Freelancing Pathways | Accounting & Finance',
    description: 'Explore freelancing as an accounting or finance professional. Whether you are looking for work, recently graduated, or employed and ready to build your own practice — we can help.',
    ...(await canonicalMetadata('/freelancing-pathways')),
  }
}

export default async function FreelancingPathwaysPage() {
  const headersList = await headers()
  const isEthioTax  = headersList.get('x-et-platform') === 'ethiotax'
  return <FreelancingPathwaysClient isEthioTax={isEthioTax} />
}
