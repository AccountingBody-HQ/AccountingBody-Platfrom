import Link from 'next/link'
import { headers } from 'next/headers'

export default async function PostAJobSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  // session_id is accepted for a future Phase-2 read-back (e.g. showing the
  // listing's live status inline) — the webhook is the source of truth for
  // payment confirmation, so no verification call is made here in Phase 1.
  await searchParams
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const gold = '#C9982A'

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#F8F7F4' }}>
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(22,163,74,0.1)' }}>
          <svg className="w-8 h-8" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-navy-950 text-2xl md:text-3xl mb-4" style={{ letterSpacing: '-0.02em' }}>
          Thank you — your listing is under review.
        </h1>
        <p className="text-slate-500 text-base leading-relaxed mb-10">
          Payment received. Our team reviews every listing before it goes live — you&apos;ll receive an email within 24 hours when your job is published.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/jobs/listings"
            className="h-11 px-6 rounded-xl text-sm font-semibold text-white flex items-center justify-center transition-opacity hover:opacity-90"
            style={{ background: brand }}>
            Browse live jobs
          </Link>
          <Link href="/jobs/post-a-job"
            className="h-11 px-6 rounded-xl text-sm font-semibold flex items-center justify-center transition-opacity hover:opacity-90"
            style={{ border: `2px solid ${gold}`, color: gold }}>
            Post another job
          </Link>
        </div>
      </div>
    </main>
  )
}
