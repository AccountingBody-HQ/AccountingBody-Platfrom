import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getJobBySlug, getJobLifecycleState, getSimilarJobs, type Job } from '@/lib/jobs'
import {
  formatSalary,
  employmentTypeLabel,
  seniorityLabel,
  formatRelativeDate,
  formatAbsoluteDate,
} from '@/lib/job-format'
import { JobPostingStructuredData } from './structured-data'
import { ApplyButton } from './ApplyButton'

export const dynamic = 'force-dynamic'

// Memoised per-request (not across requests) so generateMetadata and the
// page component — which both need the same job — only hit Supabase once.
const getCachedJob = cache(async (slug: string) => getJobBySlug(slug))

interface ResolvedJob {
  job: Job
  isEthioTax: boolean
}

// Platform scoping: a job tagged e.g. platform=['et'] only should not be
// reachable by slug from the accountingbody.com host, mirroring the
// x-et-platform convention every other public page already uses. The slug
// itself is fetched regardless of platform (it's already globally unique),
// then rejected here if it doesn't belong to the requesting host's platform.
async function resolveJob(slug: string): Promise<ResolvedJob | null> {
  const job = await getCachedJob(slug)
  if (!job) return null
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const platform = isEthioTax ? 'et' : 'ab'
  if (!job.platform.includes(platform)) return null
  return { job, isEthioTax }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const resolved = await resolveJob(slug)
  if (!resolved) return {}
  const { job, isEthioTax } = resolved
  const lifecycle = getJobLifecycleState(job)

  // No manual brand suffix here — the root layout's title.template ('%s |
  // Accounting Body' / '%s | EthioTax') already appends it to whatever
  // plain-string title a page returns. Appending our own suffix on top of
  // that (as the initial version of this page did) produced a doubled
  // brand in the rendered <title> ("... | Accounting Body Jobs |
  // Accounting Body").
  const title = `${job.title} at ${job.company_name}`
  const description = job.excerpt || job.description.slice(0, 300)

  // This page's own canonical — without it, it inherits the root layout's
  // sitewide default (alternates.canonical: the homepage), which tells
  // Google every job page's authoritative version is the homepage. See the
  // job-page-fixes report for how many other route types have the same gap.
  const baseUrl = isEthioTax ? 'https://ethiotax.com' : 'https://accountingbody.com'
  const canonicalUrl = `${baseUrl}/jobs/${job.slug}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: 'website' },
    // noindex only once a listing is old enough to be archived — active and
    // stale listings both stay indexable.
    robots: lifecycle === 'archived'
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

function SkillList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <span key={item} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-navy-700">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const resolved = await resolveJob(slug)
  if (!resolved) notFound()
  const { job, isEthioTax } = resolved
  const brandName = isEthioTax ? 'EthioTax' : 'Accounting Body'
  const brandColor = isEthioTax ? '#1A4731' : '#0C1A3D'
  const lifecycle = getJobLifecycleState(job)

  const similarJobs = await getSimilarJobs({
    excludeId: job.id,
    platform: isEthioTax ? 'et' : 'ab',
    locationCountry: job.location_country,
    seniorityLevel: job.seniority_level,
    limit: 6,
  })

  const salary = formatSalary(job)
  const empLabel = employmentTypeLabel(job.employment_type)
  const seniority = seniorityLabel(job.seniority_level)
  const postedDate = job.published_at ?? job.created_at
  // `description` is NOT NULL in the schema, so this fallback is currently
  // unreachable in practice — kept defensively rather than assuming that
  // constraint never changes.
  const bodyText = job.description || job.excerpt || ''
  const paragraphs = bodyText.split('\n').map(p => p.trim()).filter(Boolean)

  return (
    <main className="min-h-screen" style={{ background: '#F8F7F4' }}>
      <JobPostingStructuredData job={job} brandName={brandName} />

      <section className="py-12 md:py-16">
        <div className="container-site max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10">
            {/* Header */}
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: brandColor }}>
                {job.source === 'employer' ? 'Hiring Direct' : brandName}
              </span>
              <h1 className="font-display text-navy-950 text-2xl md:text-3xl mt-2 mb-1" style={{ letterSpacing: '-0.02em' }}>
                {job.title}
              </h1>
              <p className="text-slate-600 text-base font-semibold">{job.company_name}</p>
              <p className="text-slate-500 text-sm mt-1">
                {job.location_country && job.location_country !== job.location_text
                  ? `${job.location_text} · ${job.location_country}`
                  : job.location_text}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-6">
              {empLabel && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-navy-700">{empLabel}</span>
              )}
              {seniority && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-navy-700">{seniority}</span>
              )}
              {job.location_remote && (
                <span className="inline-flex items-center rounded-full bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">Remote</span>
              )}
              {job.is_featured && (
                <span className="inline-flex items-center rounded-full bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">Featured</span>
              )}
              {salary && (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#fdf9ec', color: '#b87d10', border: '1px solid #f5e095' }}>
                  {salary}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-8">Posted {formatRelativeDate(postedDate)}</p>

            {/* Stale / archived notice */}
            {lifecycle !== 'active' && (
              <div className="rounded-xl p-5 mb-8" style={{ background: 'rgba(12,26,61,0.04)' }}>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This listing was posted on {formatAbsoluteDate(postedDate)} and is no longer being updated.
                  Please check directly with the employer to confirm whether the role is still available, or
                  explore similar current roles below.
                </p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-3 mb-8">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-700">{para}</p>
              ))}
            </div>

            <SkillList title="Qualifications" items={job.qualifications_required ?? []} />
            <SkillList title="Skills required" items={job.skills_required ?? []} />
            <SkillList title="Skills, nice to have" items={job.skills_nice_to_have ?? []} />

            <div className="mt-4">
              <ApplyButton job={job} brandColor={brandColor} />
            </div>
          </div>

          {/* Similar jobs */}
          {similarJobs.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-lg text-navy-950 mb-4">Similar current roles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similarJobs.map(similar => {
                  const similarSalary = formatSalary(similar)
                  return (
                    <Link key={similar.id} href={`/jobs/${similar.slug}`}
                      className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all">
                      <p className="font-display text-sm font-medium text-navy-950 leading-snug line-clamp-2 mb-1">{similar.title}</p>
                      <p className="text-xs font-semibold text-slate-600 mb-1">{similar.company_name}</p>
                      <p className="text-xs text-slate-400">
                        {similar.location_country && similar.location_country !== similar.location_text
                          ? similar.location_country
                          : similar.location_text}
                      </p>
                      {similarSalary && (
                        <p className="text-xs font-bold mt-2" style={{ color: '#b87d10' }}>{similarSalary}</p>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-8">
            <Link href="/jobs/listings" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: brandColor }}>
              ← Back to all jobs
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
