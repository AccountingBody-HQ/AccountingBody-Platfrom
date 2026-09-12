import type { Metadata } from 'next'
import { headers } from 'next/headers'
import ServicePageClient from '../_service-page-client'
import { canonicalMetadata } from '@/lib/canonical'

// No title/description here deliberately — this route never had one (it
// previously inherited ../layout.tsx's, which was wrong for every slug but
// one). Only canonical/og:url are added; title/description are commit 1
// of a different, not-yet-scheduled fix.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { ...(await canonicalMetadata(`/get-help/${slug}`)) }
}

export default async function GetHelpSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <ServicePageClient params={{ slug }} isEthioTax={isEthioTax} />
}
