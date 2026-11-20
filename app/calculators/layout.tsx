import type { Metadata } from 'next'
import { ownerCanonical } from '@/lib/canonical'

// page.tsx here is 'use client' and cannot export generateMetadata itself —
// this layout exists solely to supply canonical/og:url for that page. It
// changes nothing about how the page renders.
export async function generateMetadata(): Promise<Metadata> {
  return { ...ownerCanonical('accountingbody', '/calculators') }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
