import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getJobById } from '@/lib/jobs'

export const dynamic = 'force-dynamic'

// Phase 1 stub: the in-platform application pipeline (job_applications
// table + submission UI + CV upload) is built in Phase 2. Until then, a
// "platform" apply_method listing lands here and shows the employer's own
// application instructions (folded into the job description at creation —
// see PostAJobClient.tsx) rather than accepting a real submission.
export default async function ApplyToJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = await getJobById(id)
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'

  if (!job || job.status !== 'active') {
    notFound()
  }

  return (
    <main className="min-h-screen" style={{ background: '#F8F7F4' }}>
      <section className="py-16">
        <div className="container-site max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-10">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#2dd4bf' }}>Hiring Direct</span>
            <h1 className="font-display text-navy-950 text-2xl md:text-3xl mt-2 mb-1" style={{ letterSpacing: '-0.02em' }}>
              {job.title}
            </h1>
            <p className="text-slate-500 text-sm mb-8">{job.company_name} · {job.location_text}</p>

            <div className="rounded-xl border border-slate-200 p-6 mb-8 whitespace-pre-line text-sm text-slate-600 leading-relaxed">
              {job.description}
            </div>

            <div className="rounded-xl p-5" style={{ background: 'rgba(12,26,61,0.04)' }}>
              <p className="text-sm font-semibold text-navy-950 mb-1">Applying to this role</p>
              <p className="text-sm text-slate-500">
                Please follow the application instructions above. In-platform applications with CV upload are coming soon.
              </p>
            </div>

            <Link href="/jobs/listings"
              className="inline-flex items-center gap-2 mt-8 text-sm font-semibold"
              style={{ color: brand }}>
              ← Back to all jobs
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
