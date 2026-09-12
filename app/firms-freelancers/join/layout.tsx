import type { Metadata } from 'next'
import { canonicalMetadata } from '@/lib/canonical'

// page.tsx here is 'use client' and cannot export generateMetadata itself —
// this layout exists solely to supply canonical/og:url for that page. It
// changes nothing about how the page renders. No nested routes exist under
// this segment, so this layout's metadata governs this one page only.
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await canonicalMetadata('/firms-freelancers/join')) }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
