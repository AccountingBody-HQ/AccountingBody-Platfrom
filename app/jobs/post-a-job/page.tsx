import type { Metadata } from 'next'
import { headers } from 'next/headers'
import PostAJobClient from './PostAJobClient'
import { ownerCanonical } from '@/lib/canonical'
import { getRequestBrand } from '@/lib/brand-server'
import { brandText } from '@/lib/et-wording'

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getRequestBrand()
  return {
    title: `Post a Job | ${brand.compactName} — Accounting & Finance Recruitment`,
    description: brandText(brand.isEthioTax, `Post your accounting or finance job vacancy on ${brand.compactName}. Reach thousands of qualified ACCA, CIMA, ICAEW and AAT professionals. Listings reviewed and live within 24 hours.`),
    ...ownerCanonical('accountingbody', '/jobs/post-a-job'),
  }
}

export default async function PostAJobPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <PostAJobClient isEthioTax={isEthioTax} />
}
