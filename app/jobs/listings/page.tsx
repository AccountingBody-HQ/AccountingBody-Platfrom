import type { Metadata } from 'next'
import { headers } from 'next/headers'
import JobListingsClient from './JobListingsClient'
import JobSearchHero from './JobSearchHero'
import { JobListingsStructuredData } from './structured-data'
import { ownerCanonical } from '@/lib/canonical'
import { getCachedActiveJobCountries } from '@/lib/jobs'
import { getRequestBrand } from '@/lib/brand-server'
import { brandText } from '@/lib/et-wording'
import { loadFirstListingsPage, parseDirectJobsQuery, toListingCard } from '@/app/api/jobs/direct/load'
import { buildDirectJobsParams, listingsViewKey, parseListingsUrlState, LISTINGS_PAGE_SIZE } from './urlState'

type PageSearchParams = Record<string, string | string[] | undefined>

// The first value of each key, as useSearchParams().get() reads it in the
// browser, so the server and the browser derive the same view.
function firstValues(params: PageSearchParams): URLSearchParams {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first !== undefined) out.set(key, first)
  }
  return out
}

export async function generateMetadata(): Promise<Metadata> {
  const { isEthioTax } = await getRequestBrand()
  return {
    title: 'Accounting & Finance Jobs',
    description: brandText(isEthioTax, 'Find accounting and finance jobs globally. Search roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals across UK, US, Australia, Canada, Singapore and Africa.'),
    ...ownerCanonical('accountingbody', '/jobs/listings'),
  }
}

export default async function JobListingsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const platform = isEthioTax ? 'et' : 'ab'
  // The first page of jobs for the URL's own filters and page, through the
  // same parse and load as /api/jobs/direct (so it shares its cached reads),
  // started before the countries so the two run together. Bounded and never
  // failing: with null the page is sent without cards and the browser loads
  // them as before.
  const urlState = parseListingsUrlState(firstValues(await searchParams))
  const firstPage = loadFirstListingsPage(parseDirectJobsQuery(buildDirectJobsParams(urlState, platform, LISTINGS_PAGE_SIZE)))
  // Fetched here, not inside the client component, so the derived country
  // list is present on first paint rather than arriving after a
  // post-mount client fetch — the <select> never has to render with an
  // empty or momentarily-wrong option set. platform must match
  // JobListingsClient's own derivation (isEthioTax ? 'et' : 'ab') exactly,
  // since the pre-counted country rows are platform-scoped.
  const countryOptions = await getCachedActiveJobCountries(isEthioTax ? 'et' : 'ab')
  const loaded = await firstPage
  const initial = loaded
    ? { key: listingsViewKey(platform, urlState), jobs: loaded.jobs.map(toListingCard), total: loaded.total, renderedAt: Date.now() }
    : null
  return (
    <>
      <JobListingsStructuredData isEthioTax={isEthioTax} />
      {/* HERO — matches /study page pattern exactly */}
      <section className="relative overflow-hidden bg-navy-950 py-10 md:py-16">
        {/* Background effects — identical to study page */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, var(--hero-glow, #3a4f9a) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-wide relative z-10">
          {/* Headline */}
          <div className="max-w-2xl mb-7 md:mb-9">
            <span className="eyebrow text-gold-400 mb-3 block text-sm font-semibold uppercase tracking-widest">
              {isEthioTax ? 'Accounting & Finance Jobs — Africa' : 'Accounting & Finance Jobs'}
            </span>
            <h1 className="font-display text-white leading-tight mb-4" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', letterSpacing: '-0.02em' }}>
              Find your next{' '}
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                accounting role.
              </span>
            </h1>
            <p className="text-white/60 text-base md:text-lg leading-relaxed">
              {isEthioTax
                ? 'ACCA, CIMA, ETICPA and AAT qualified roles across Africa and beyond.'
                : 'Roles for ACCA, CIMA, ICAEW, CPA and AAT professionals across the UK, US, Australia, Canada, Singapore and Africa.'}
            </p>
          </div>
          {/* Search form — embedded in hero, not sticky */}
          <JobSearchHero />
        </div>
      </section>
      {/* LISTINGS */}
      {/* No Suspense boundary here. JobListingsClient calls useSearchParams(),
          which needs a boundary only when a page is prerendered at build
          time; this page is rendered per request (it reads headers() and
          searchParams), so the list renders straight into the first HTML —
          with the first page's cards when `initial` is set, else its own
          loading skeleton (isFirstLoad). A boundary would stream the list
          as a hidden block that only script reveals. */}
      <JobListingsClient isEthioTax={isEthioTax} countryOptions={countryOptions} initial={initial} />
    </>
  )
}
