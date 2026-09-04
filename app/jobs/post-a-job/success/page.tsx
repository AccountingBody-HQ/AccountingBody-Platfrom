import Link from 'next/link'
import { headers } from 'next/headers'
import { CheckCircle2 } from 'lucide-react'

// Lemon Squeezy's redirect does not include a session/order identifier by
// default, and the webhook (not this page) is the source of truth for
// payment confirmation — so this page never depends on query params for
// its content.
export default async function PostAJobSuccessPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const gold = '#C9982A'

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center py-16 px-6">
      <div className="max-w-lg mx-auto w-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(20,184,166,0.1)' }}>
            <CheckCircle2 className="w-16 h-16" style={{ color: '#14b8a6' }} strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-navy-950 text-2xl md:text-3xl mb-4" style={{ letterSpacing: '-0.02em' }}>
            Your listing is under review
          </h1>
          <p className="text-slate-500 text-base leading-relaxed mb-4">
            We&apos;ll review your listing within 24 hours and email you when it&apos;s live. Check your inbox for a confirmation email with a link to manage your listing.
          </p>
          <p className="text-slate-500 text-base leading-relaxed mb-10">
            Once approved, your listing will appear at the top of our jobs board with a Hiring Direct badge.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/jobs/listings"
              className="flex-1 h-11 px-6 rounded-lg text-sm font-semibold text-white flex items-center justify-center transition-opacity hover:opacity-90"
              style={{ background: brand }}>
              Browse live jobs →
            </Link>
            <Link href="/jobs/post-a-job"
              className="flex-1 h-11 px-6 rounded-lg text-sm font-semibold flex items-center justify-center transition-opacity hover:opacity-90"
              style={{ border: `2px solid ${gold}`, color: gold }}>
              Post another job →
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
