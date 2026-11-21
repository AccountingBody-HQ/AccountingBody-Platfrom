import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getJobBySlug, getJobEndDate, getJobLifecycleState, getSimilarJobs, type Job } from '@/lib/jobs'
import {
  formatSalary,
  employmentTypeLabel,
  seniorityLabel,
  formatRelativeDate,
  formatAbsoluteDate,
  getCompanyInitials,
} from '@/lib/job-format'
import { getJobCanonicalUrl, ownerUrl } from '@/lib/canonical'
import { formatJobLocation } from '@/app/jobs/listings/jobLocation'
import { JobPostingStructuredData } from './structured-data'
import { ApplyBarWithSticky } from './ApplyBarWithSticky'
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
  if (!resolved) return { title: 'Page Not Found' }
  const { job } = resolved
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
  // One owner per job on both views (owner rule D272, lib/canonical.ts).
  const canonicalUrl = getJobCanonicalUrl(job)

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: 'website' },
    // noindex once a job has been closed for more than
    // CLOSED_NOINDEX_AFTER_DAYS (lib/jobs.ts); open and recently closed jobs
    // stay indexable (owner decision D55).
    robots: lifecycle === 'closed_noindex'
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

function SkillList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-10">
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

// status and closed_at decide the page's state only. The job handed to the
// page's parts (and serialised into the client apply bar's props) keeps
// exactly the public fields it had before, in the same order.
function withoutLifecycleFields(row: Job): Job {
  const job: Partial<Job> = { ...row }
  delete job.status
  delete job.closed_at
  return job as Job
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const resolved = await resolveJob(slug)
  if (!resolved) notFound()
  const { job: jobRow, isEthioTax } = resolved
  const brandName = isEthioTax ? 'EthioTax' : 'Accounting Body'
  const brandColor = isEthioTax ? '#1A4731' : '#0C1A3D'
  const now = Date.now()
  const isOpen = getJobLifecycleState(jobRow, now) === 'open'
  const endDate = getJobEndDate(jobRow, now)
  const job = withoutLifecycleFields(jobRow)
  // The share link copies the address of the site the visitor is on (not
  // the canonical), exactly as before.
  const shareUrl = ownerUrl(isEthioTax ? 'ethiotax' : 'accountingbody', `/jobs/${job.slug}`)

  const similarJobs = await getSimilarJobs({
    excludeId: job.id,
    platform: isEthioTax ? 'et' : 'ab',
    title: job.title,
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
  const locationDisplay = formatJobLocation(job.location_text, job.location_country)

  const closingLineParts = (isOpen
    ? [
        `Posted ${formatAbsoluteDate(postedDate)}`,
        job.expires_at ? `Expires ${formatAbsoluteDate(job.expires_at)}` : null,
      ]
    : [
        `Posted ${formatAbsoluteDate(postedDate)}`,
        endDate ? `Closed ${formatAbsoluteDate(endDate)}` : null,
      ]
  ).filter((part): part is string => part !== null)

  // One text node, so the wording reaches the page exactly as approved.
  const closedNoticeText = [
    'This job is no longer taking applications.',
    endDate
      ? `It was posted on ${formatAbsoluteDate(postedDate)} and closed on ${formatAbsoluteDate(endDate)}.`
      : `It was posted on ${formatAbsoluteDate(postedDate)}.`,
    similarJobs.length > 0 ? 'You can also look at similar current roles below.' : null,
  ].filter((part): part is string => part !== null).join(' ')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* JobPosting data for open jobs only: a closed job's page stays but
          no longer describes a posting (owner decision D55). */}
      {isOpen && <JobPostingStructuredData job={job} brandName={brandName} />}

      {/* The extra phone bottom padding makes room for the sticky apply bar,
          which only open jobs have. */}
      <section className={isOpen ? 'py-12 md:py-16 pb-[96px] md:pb-16' : 'py-12 md:py-16'}>
        <div className="max-w-[760px] mx-auto px-4 sm:px-6">
          {/* 1. Top bar */}
          <div className="flex items-center justify-between pb-[26px]">
            <BackToListingsLink />
            <ShareButton url={shareUrl} jobTitle={job.title} brandColor={brandColor} />
          </div>

          {/* 2. Identity block */}
          <div className="flex items-start gap-4">
            <div className="w-[52px] h-[52px] rounded-[13px] shrink-0 flex items-center justify-center bg-navy-950">
              <span className="font-display text-[19px] text-[#F3D68A]">
                {getCompanyInitials(job.company_name)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="font-display text-navy-950 text-[clamp(30px,5.4vw,41px)] leading-[1.12] tracking-[-0.015em]"
              >
                {job.title}
              </h1>
              <p className="text-[16.5px] font-medium text-slate-700 mt-1.5">{job.company_name}</p>
              <p className="text-[15px] text-slate-500 mt-0.5">{locationDisplay}</p>
            </div>
          </div>

          {/* 3. Decision card */}
          <div className="bg-white border border-slate-200 rounded-xl p-[26px] mt-[30px]">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`font-display text-[clamp(34px,6.4vw,44px)] leading-none tracking-[-0.02em] ${salary ? 'text-gold-600' : 'text-slate-500'}`}
              >
                {salary ?? 'Salary not listed'}
              </span>
              {salary && <span className="text-[14.5px] text-slate-500">a year</span>}
              {salary && job.salary_is_predicted && (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-gold-50 text-gold-600 border border-gold-200">
                  Estimated, not confirmed by the employer
                </span>
              )}
            </div>

            {/* Each fact is independently conditional and omitted entirely
                when absent — employment_type in particular is only 32.6%
                populated, so this row is frequently partial by design. */}
            <dl className="border-t border-slate-200 mt-5 pt-5 flex flex-wrap gap-x-[30px] gap-y-3">
              {seniority && (
                <div>
                  <dt className="text-[12.5px] text-slate-400">Level</dt>
                  <dd className="text-[15px] font-medium text-navy-950">{seniority}</dd>
                </div>
              )}
              {empLabel && (
                <div>
                  <dt className="text-[12.5px] text-slate-400">Contract</dt>
                  <dd className="text-[15px] font-medium text-navy-950">{empLabel}</dd>
                </div>
              )}
              <div>
                <dt className="text-[12.5px] text-slate-400">On site or Remote</dt>
                <dd className="text-[15px] font-medium text-navy-950">{job.location_remote ? 'Remote' : 'On-site'}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-slate-400">Posted</dt>
                <dd className="text-[15px] font-medium text-navy-950">{formatRelativeDate(postedDate)}</dd>
              </div>
            </dl>
          </div>

          {/* Closed notice (owner decision D55), positioned above the
              description. */}
          {!isOpen && (
            <div className="rounded-xl p-5 mt-8" style={{ background: 'rgba(12,26,61,0.04)' }}>
              <h2 className="font-display font-medium text-[21px] text-navy-950 mb-2">This job has closed</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{closedNoticeText}</p>
              <p className="mt-3 text-sm">
                <Link
                  href="/jobs/listings"
                  className="font-semibold text-navy-950 underline underline-offset-2 rounded hover:text-[#0C1A3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0C1A3D]"
                >
                  See open jobs
                </Link>
              </p>
            </div>
          )}

          {/* 4. About this role */}
          <div className="mt-10">
            <h2 className="font-display font-medium text-[21px] text-navy-950 mb-3">About this role</h2>
            <div className="max-w-[62ch] space-y-4">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-[16.5px] leading-[1.72] text-slate-700">{para}</p>
              ))}
            </div>
            {/* Only true for employer-posted jobs' own routed apply flow —
                an 'external' listing's description is a summary of the
                employer's own posting, not the whole thing. */}
            {job.apply_method === 'external' && (
              <p className="mt-4 pl-4 border-l-2 border-slate-200 text-[14px] text-slate-500 max-w-[62ch]">
                This is a summary. The employer&apos;s full description, including requirements and benefits, is on their own listing.
              </p>
            )}
          </div>

          {/* 5/6. Apply block, deliberately after the description and
              immediately before similar roles (operator's explicit
              decision, a change from the original mockup position), plus
              the sticky mobile apply bar below 768px. Both live inside one
              client component so the bar can watch the inline button's own
              viewport visibility and the two are never on screen together.
              Open jobs only: a closed job takes no applications. */}
          {isOpen && <ApplyBarWithSticky job={job} isEthioTax={isEthioTax} />}

          {/* 7. Qualifications — 1.8% of jobs have any; kept quiet and last
              so its near-total absence is never load-bearing for whether
              the page looks complete. */}
          <SkillList title="Qualifications" items={job.qualifications_required ?? []} />

          {/* 9. Similar roles — a single bordered list with hairline
              dividers, not a grid of cards. Real per-row `border-top`
              (Tailwind's divide-y), not the earlier gap-over-a-coloured-
              -background simulation — see the divider-diagnosis note in
              tmp-audit/p4b-consistency.md for why that technique wasn't
              reliable at every width, and why this one is: the exact same
              slate-200 hairline colour already renders correctly everywhere
              ELSE on this page (the decision card's border, the facts-row
              divider) via a real `border`, never via a simulated gap. */}
          {similarJobs.length > 0 && (
            <div className="mt-[52px] pt-[52px] border-t border-slate-200">
              <h2 className="font-display font-medium text-[21px] text-navy-950 mb-4">Similar current roles</h2>
              <div className="rounded-[14px] border border-slate-200 overflow-hidden divide-y divide-slate-200">
                {similarJobs.map(similar => {
                  const similarSalary = formatSalary(similar)
                  // Same helper as the main job above and as the listings
                  // card — this list previously showed the country alone
                  // (dropping the city) instead of combining both, the
                  // exact defect fixed for the card in 2eecf05; using the
                  // shared helper here closes that same gap on this page.
                  const similarLocation = formatJobLocation(similar.location_text, similar.location_country)
                  return (
                    <Link
                      key={similar.id}
                      href={`/jobs/${similar.slug}`}
                      className="flex items-center justify-between gap-4 bg-white px-[18px] py-[14px] min-h-[64px] hover:bg-slate-50 transition-colors max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-[5px] max-[520px]:min-h-0"
                    >
                      <div className="min-w-0 flex-1 max-[520px]:self-stretch">
                        <p className="text-[15.5px] font-medium text-navy-950 truncate">{similar.title}</p>
                        <p className="text-[13.5px] text-slate-500 truncate">{similar.company_name} · {similarLocation}</p>
                      </div>
                      <p
                        className={`text-[14px] font-medium whitespace-nowrap shrink-0 tabular-nums min-w-[90px] text-right max-[520px]:min-w-0 max-[520px]:text-left ${
                          similarSalary ? 'text-gold-700' : 'text-slate-400'
                        }`}
                      >
                        {similarSalary ?? 'Salary not listed'}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* 10. Closing line */}
          <p className="mt-[30px] text-[13.5px] text-slate-400">
            {closingLineParts.join(' · ')}
          </p>
        </div>
      </section>
    </div>
  )
}
