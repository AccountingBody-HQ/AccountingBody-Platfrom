import type { Metadata } from 'next'
import { canonicalMetadata } from '@/lib/canonical'

// page.tsx here is 'use client' and cannot export generateMetadata itself —
// this layout exists solely to supply canonical/og:url for that page. It
// changes nothing about how the page renders. This layout also wraps
// app/global-payroll/[slug]/**, but that segment has its own layout.tsx
// defining its own `alternates`, which — per Next's metadata resolution
// (resolve-metadata.js: each segment's `alternates` fully replaces, never
// merges with, the parent's) — takes over for every /global-payroll/[slug]
// page. This layout's canonical only actually applies to /global-payroll
// itself.
export async function generateMetadata(): Promise<Metadata> {
  return { ...(await canonicalMetadata('/global-payroll')) }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
