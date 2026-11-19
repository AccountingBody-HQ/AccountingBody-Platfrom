// lib/brand-server.ts — the request's brand for server components and
// generateMetadata. Reads the same header as the root layout (app/layout.tsx);
// names come from lib/brand.ts.
import { headers } from 'next/headers'
import { brandName, compactBrandName, isEthioTaxHeader, type BrandName } from '@/lib/brand'

export interface RequestBrand {
  isEthioTax: boolean
  name: BrandName
  compactName: 'AccountingBody' | 'EthioTax'
}

export async function getRequestBrand(): Promise<RequestBrand> {
  const isEthioTax = isEthioTaxHeader(await headers())
  return { isEthioTax, name: brandName(isEthioTax), compactName: compactBrandName(isEthioTax) }
}
