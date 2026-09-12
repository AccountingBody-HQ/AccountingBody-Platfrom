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
  getJobCanonicalUrl,
  getCompanyInitials,
} from '@/lib/job-format'
import { JobPostingStructuredData } from './structured-data'
import { ApplyButton, getApplyCopy } from './ApplyButton'
import { BackToListingsLink } from './BackToListingsLink'
import { ShareButton } from './ShareButton'

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
  const canonicalUrl = getJobCanonicalUrl(job, isEthioTax)

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

// Qualifications are present on ~1.8% of jobs — deliberately the
// quietest section on the page (smaller label, tighter spacing) so its
// near-total absence never reads as something missing.
function SkillList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h2>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function InfoIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 11v5" />
      <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Honest, non-speculative description of where a listing came from —
// shown in the page's closing line, never as a claim beyond what the
// `source` column actually records.
const SOURCE_LABEL: Record<Job['source'], string> = {
  employer: 'Posted directly by the employer',
  adzuna: 'Sourced via Adzuna',
  careerjet: 'Sourced via CareerJet',
  scrape: "Sourced from the employer's site",
  manual: 'Added by the Accounting Body team',
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
  const canonicalUrl = getJobCanonicalUrl(job, isEthioTax)

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
  const { helper: applyHelper } = getApplyCopy(job, brandName)

  // "a year" is only honest next to a genuinely annualised figure.
  // formatSalary() returns job.salary_text verbatim whenever it's real
  // free text (an employer's own wording, or an unconverted provider
  // string) — appending "a year" to that risks a nonsensical or doubled
  // period statement. Only the numeric salary_min/salary_max path is
  // guaranteed annual (ingestion converts hourly rates x2080 before
  // storing them, lib/ingestion/normalise.ts), so that's the only case
  // this shows the suffix for.
  const salaryIsAnnualFigure = !job.salary_text && (job.salary_min != null || job.salary_max != null)

  return (
    <main className="min-h-screen" style={{ background: '#F8F7F4' }}>
      <JobPostingStructuredData job={job} brandName={brandName} />

      <section className="py-12 md:py-16">
        <div className="container-site max-w-[760px] mx-auto">
          {/* 1. Slim top bar — muted, not competing with the title below it. */}
          <div className="flex items-center justify-between mb-8">
            <BackToListingsLink brandColor={brandColor} />
            <ShareButton url={canonicalUrl} jobTitle={job.title} brandColor={brandColor} />
          </div>

          {/* 2. Identity block — title/company_name/location_text are all
              NOT NULL, so this is the one block on the page that can never
              render thin. No eyebrow label: it's template chrome, not
              information a visitor needs. */}
          <div className="flex items-start gap-4 mb-8">
            <div
              className="w-[52px] h-[52px] rounded-[13px] shrink-0 flex items-center justify-center text-lg font-semibold"
              style={{ background: brandColor, color: '#D4A017' }}
            >
              {getCompanyInitials(job.company_name)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1
                className="font-display text-navy-950"
                style={{ fontSize: 'clamp(1.875rem, 4.5vw, 2.5625rem)', lineHeight: 1.15, letterSpacing: '-0.015em' }}
              >
                {job.title}
              </h1>
              <p className="text-[16.5px] font-medium text-slate-700 mt-1.5">{job.company_name}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {job.location_country && job.location_country !== job.location_text
                  ? `${job.location_text} · ${job.location_country}`
                  : job.location_text}
              </p>
            </div>
          </div>

          {/* 3. THE DECISION CARD — the hero of the page. Every fact in it is
              either always present (Level) or independently conditional
              with no gap left behind when absent; the salary slot never
              collapses, and the Apply CTA sits directly inside it, above
              the description. */}
          <div className="bg-white border border-slate-200 rounded-2xl p-[26px] mb-8">
            {/* a. Salary — the largest single element on the page. Its slot
                never collapses: "Salary not listed" gets the identical
                large treatment, since 37% of jobs hit this. */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-display text-navy-950"
                style={{ fontSize: 'clamp(2.125rem, 6vw, 2.75rem)', lineHeight: 1.1, letterSpacing: '-0.01em' }}
              >
                {salary || 'Salary not listed'}
              </span>
              {salary && salaryIsAnnualFigure && (
                <span className="text-sm text-slate-400">a year</span>
              )}
            </div>

            {/* b. Estimated-salary disclosure — only for the ~13% of salaried
                Adzuna jobs where the figure is the source's own model
                guess, not an employer-stated amount. */}
            {job.salary_is_predicted && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: '#fdf9ec', color: '#935c11' }}
              >
                <InfoIcon />
                Estimated, not confirmed by the employer
              </div>
            )}

            <hr className="my-5 border-slate-200" />

            {/* c. Facts — Level is always present; every other entry is
                independently conditional and simply omitted, never leaving
                an empty slot in the row. */}
            <dl className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Level</dt>
                <dd className="text-[15px] font-medium text-navy-950">{seniority}</dd>
              </div>
              {empLabel && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Contract</dt>
                  <dd className="text-[15px] font-medium text-navy-950">{empLabel}</dd>
                </div>
              )}
              {job.location_remote && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">On site or Remote</dt>
                  <dd className="text-[15px] font-medium text-navy-950">Remote</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Posted</dt>
                <dd className="text-[15px] font-medium text-navy-950">{formatRelativeDate(postedDate)}</dd>
              </div>
            </dl>

            {/* d. Apply CTA — promoted here, above the description, not
                buried after it. Label states the outcome; see
                ApplyButton.tsx's getApplyCopy for the three variants. */}
            <div className="mt-6">
              <ApplyButton job={job} brandColor={brandColor} brandName={brandName} />
            </div>

            {/* e. What happens next — matched to whichever apply_method
                branch actually rendered above, from the same getApplyCopy
                call, so the two can never fall out of sync. */}
            <p className="text-center text-xs text-slate-400 mt-3">{applyHelper}</p>
          </div>

          {/* 6. Stale / archived notice — unchanged copy, placed above the
              description. */}
          {lifecycle !== 'active' && (
            <div className="rounded-xl p-5 mb-8" style={{ background: 'rgba(12,26,61,0.04)' }}>
              <p className="text-sm text-slate-600 leading-relaxed">
                This listing was posted on {formatAbsoluteDate(postedDate)} and is no longer being updated.
                Please check directly with the employer to confirm whether the role is still available, or
                explore similar current roles below.
              </p>
            </div>
          )}

          {/* 4. About this role — capped at a comfortable reading measure
              so the median ~539-character description reads as a
              deliberately concise paragraph, not a wide column with a
              gap beneath it. */}
          <div>
            <h2 className="font-display text-navy-950 text-[21px] mb-3">About this role</h2>
            <div className="max-w-[62ch] space-y-3">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-[16.5px] text-slate-700" style={{ lineHeight: 1.72 }}>{para}</p>
              ))}
            </div>

            {/* Only true for external listings — for an employer-posted job
                (apply_method !== 'external' is the wrong test; the honest
                one is "is there really more content elsewhere") the
                description IS the complete text, and this line would be a
                false claim. */}
            {job.apply_method === 'external' && (
              <p className="border-l-2 border-slate-200 pl-3 text-sm text-slate-400 mt-5 max-w-[62ch]">
                This is a summary. The employer&apos;s full description, including requirements and benefits, is on
                their own listing.
              </p>
            )}
          </div>

          {/* 5. Qualifications — see SkillList's own comment: 1.8% of jobs
              have any, so this must never carry visual weight. */}
          <SkillList title="Qualifications" items={job.qualifications_required ?? []} />

          {/* 7. Similar roles — a single bordered list, not a card grid, so
              it never outweighs the job itself. Each row is one link. */}
          {similarJobs.length > 0 && (
            <div className="mt-12">
              <h2 className="font-display text-navy-950 text-[21px] mb-3">Similar current roles</h2>
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                {similarJobs.map(similar => {
                  const similarSalary = formatSalary(similar)
                  return (
                    <Link
                      key={similar.id}
                      href={`/jobs/${similar.slug}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-950 leading-snug line-clamp-1">{similar.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {similar.company_name} ·{' '}
                          {similar.location_country && similar.location_country !== similar.location_text
                            ? similar.location_country
                            : similar.location_text}
                        </p>
                      </div>
                      <p className="text-xs font-semibold shrink-0" style={{ color: similarSalary ? '#b87d10' : '#94a3b8' }}>
                        {similarSalary || 'Salary not listed'}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* 8. Closing line — source, posted date, and expiry only when
              it's still meaningful (an already-stale/archived job's expiry
              is covered by the notice above instead, not repeated here). */}
          <p className="text-center text-xs text-slate-400 mt-10">
            {SOURCE_LABEL[job.source]} · Posted {formatAbsoluteDate(postedDate)}
            {lifecycle === 'active' && job.expires_at && ` · Expires ${formatAbsoluteDate(job.expires_at)}`}
          </p>
        </div>
      </section>
    </main>
  )
}
