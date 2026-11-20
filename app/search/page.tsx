// app/search/page.tsx
// Server page: reads the brand from the request (lib/brand.ts) and passes it to the client part,
// so the first HTML of /search already carries the right site name on both brands.
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { isEthioTaxHeader } from '@/lib/brand'
import { SearchInner } from './SearchClient'

export default async function SearchPage() {
  const isEthioTax = isEthioTaxHeader(await headers())
  return (
    <Suspense fallback={
      <div className="bg-navy-950 min-h-screen flex items-center justify-center">
        <h1 className="sr-only">Find what you need</h1>
        <svg className="w-8 h-8 text-gold-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <SearchInner isEthioTax={isEthioTax} />
    </Suspense>
  )
}
