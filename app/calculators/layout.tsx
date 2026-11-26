import type { Metadata } from 'next'
import { ownerCanonical } from '@/lib/canonical'
import { getRequestBrand } from '@/lib/brand-server'
import { EthioTaxViewProvider } from '@/components/EthioTaxViewContext'
import { brandText } from '@/lib/et-wording'

// page.tsx here is 'use client' and cannot export generateMetadata itself —
// this layout supplies its title (the root template adds the brand), its
// description (the page's visible intro sentence, word for word, for the
// request's brand), canonical/og:url, and the request's view (EthioTax or
// Accounting Body) for its wording (ET-10).
export async function generateMetadata(): Promise<Metadata> {
  const { isEthioTax } = await getRequestBrand()
  return {
    title: 'Accounting Calculators',
    description: brandText(isEthioTax, '24 free instant calculators for ACCA, CIMA, ICAEW and AAT students. Results update as you type. No signup required.'),
    ...ownerCanonical('accountingbody', '/calculators'),
  }
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { isEthioTax } = await getRequestBrand()
  return <EthioTaxViewProvider isEthioTax={isEthioTax}>{children}</EthioTaxViewProvider>
}
