import type { Metadata } from 'next'
import { headers } from 'next/headers'
import PostAJobClient from './PostAJobClient'
import { canonicalMetadata } from '@/lib/canonical'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Post a Job | AccountingBody — Accounting & Finance Recruitment',
    description: 'Post your accounting or finance job vacancy on AccountingBody. Reach thousands of qualified ACCA, CIMA, ICAEW and AAT professionals. Listings reviewed and live within 24 hours.',
    ...(await canonicalMetadata('/jobs/post-a-job')),
  }
}

export default async function PostAJobPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <PostAJobClient isEthioTax={isEthioTax} />
}
