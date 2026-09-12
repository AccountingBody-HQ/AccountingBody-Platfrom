import type { Metadata } from 'next'
import { canonicalMetadata } from '@/lib/canonical'

// page.tsx here is 'use client' and cannot export generateMetadata itself —
// this layout exists solely to supply canonical/og:url for that page. It
// changes nothing about how the page renders.
//
// The valid slug set lives in a private `services` object inside page.tsx
// (not exported, and out of scope to change here), so this layout cannot
// check the slug against it without duplicating that list. For an unknown
// slug, page.tsx's own `if (!service) notFound()` still fires and the
// response is a 404 regardless of what this function returns — a canonical
// tag is not actionable on a non-200 response, so an unvalidated slug
// reaching here is inert, not misleading.
//
// params matches the plain-object convention page.tsx already uses in this
// directory (not the Promise<> convention used elsewhere in this codebase).
export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  return { ...(await canonicalMetadata(`/global-payroll/${params.slug}`)) }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
