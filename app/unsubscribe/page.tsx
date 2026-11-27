// app/unsubscribe/page.tsx
// PRIV-1: leave the newsletter. With a link from one of our e-mails the page
// only checks the link's signature on the server; it reads and writes no
// database row when it is opened. The change happens only when the visitor
// presses the button (POST /api/unsubscribe).
import type { Metadata } from 'next'
import { verifyUnsubscribeToken } from '@/lib/newsletter-tokens'
import { getRequestBrand } from '@/lib/brand-server'
import UnsubscribeForms, { type UnsubscribeMode } from './UnsubscribeForms'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { token } = await searchParams
  const raw = typeof token === 'string' ? token : ''
  const mode: UnsubscribeMode = !raw ? 'request' : (await verifyUnsubscribeToken(raw)) ? 'link' : 'bad-link'
  const { isEthioTax } = await getRequestBrand()
  return <UnsubscribeForms mode={mode} token={mode === 'link' ? raw : ''} isEthioTax={isEthioTax} />
}
