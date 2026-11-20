import type { Metadata } from 'next'
import { ownerCanonical } from '@/lib/canonical'
import { getRequestBrand } from '@/lib/brand-server'
import { EthioTaxViewProvider } from '@/components/EthioTaxViewContext'

// page.tsx here is 'use client' and cannot export generateMetadata itself —
// this layout supplies canonical/og:url for that page, and the request's view
// (EthioTax or Accounting Body) for its wording (ET-10).
export async function generateMetadata(): Promise<Metadata> {
  return { ...ownerCanonical('accountingbody', '/calculators') }
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { isEthioTax } = await getRequestBrand()
  return <EthioTaxViewProvider isEthioTax={isEthioTax}>{children}</EthioTaxViewProvider>
}
