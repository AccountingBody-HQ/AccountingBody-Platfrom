import Link from 'next/link'
import { headers } from 'next/headers'
import { CheckCircle2 } from 'lucide-react'

export default async function PostAJobSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  // session_id is accepted for a future Phase-2 read-back (e.g. showing the
  // listing's live status inline) — the webhook is the source of truth for
  // payment confirmation, so no verification call is made here in Phase 1.
  // Lemon Squeezy's redirect does not include this param by default, so
  // this page never depends on it for content.
  await searchParams
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const gold = '#C9982A'

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center py-16 px-6">
      <div className="max-w-lg mx-auto w-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(20,184,166,0.1)' }}>
            <CheckCircle2 className="w-9 h-9" style={{ color: '#14b8a6' }} strokeWidth={2} />
          </div>
          <h1 className="font-display text-navy-950 text-2xl md:text-3xl mb-4" style={{ letterSpacing: '-0.02em' }}>
            Your listing is under review
          </h1>
          <p className="text-slate-500 text-base leading-relaxed mb-10">
            We&apos;ll email you within 24 hours once your listing is live. Your job will appear at the top of our listings with a Hiring Direct badge.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/jobs/listings"
              className="h-11 px-6 rounded-lg text-sm font-semibold text-white flex items-center justify-center transition-opacity hover:opacity-90"
              style={{ background: brand }}>
              Browse live jobs →
            </Link>
            <Link href="/jobs/post-a-job"
              className="h-11 px-6 rounded-lg text-sm font-semibold flex items-center justify-center transition-opacity hover:opacity-90"
              style={{ border: `2px solid ${gold}`, color: gold }}>
              Post another job →
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
