import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Each database function asks the factory for the context of the work it
// does: public pages and read APIs get the public read limit; public writes,
// admin, scheduled and ingestion work get theirs. The factory is replaced by
// a recorder that answers every query with an empty, healthy result.

const contexts = vi.hoisted(() => [] as string[])

vi.mock('@/lib/supabase-server', () => {
  const result = { data: [], error: null, count: 0, status: 200, statusText: 'OK' }
  const builder: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (resolve: (value: unknown) => unknown) => resolve(result)
        return () => builder
      },
    },
  )
  return {
    getServerSupabase: (context: string) => {
      contexts.push(context)
      return builder
    },
  }
})
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'accountingbody.com' }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT')
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async () => ({ data: null, error: null }) }
  },
}))

import { resetCacheGuard } from '@/lib/cache-guard'
import * as db from '@/lib/db'
import * as jobs from '@/lib/jobs'
import * as courses from '@/lib/coursesNew'
import * as providers from '@/lib/providers'
import * as saved from '@/lib/saved-jobs-store'
import { maybeSendProviderAlert } from '@/lib/provider-alerts'
import { deduplicate } from '@/lib/ingestion/deduplicate'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'
import HomePage from '@/app/page'
import ArticlesPage from '@/app/articles/page'
import DictionaryPage from '@/app/dictionary/page'
import { GET as etSitemap } from '@/app/et-sitemap/route'
import { GET as pagesXml } from '@/app/sitemaps/pages.xml/route'
import { GET as search } from '@/app/api/search/route'
import { GET as health } from '@/app/api/health/route'
import { GET as mockExam } from '@/app/api/mock-exam/route'
import { GET as eticpaMockExam } from '@/app/api/eticpa/mock-exam/route'
import { GET as jobsDirect } from '@/app/api/jobs/direct/route'

vi.stubGlobal('React', React)

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const request = (url: string) => new NextRequest(url, { headers: { 'x-forwarded-for': '203.0.113.7' } })

async function contextsOf(run: () => unknown): Promise<string[]> {
  contexts.length = 0
  resetCacheGuard()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await run()
  } catch {
    // Only the context matters here; the empty fake answer may not suit
    // every reader's expectations.
  } finally {
    error.mockRestore()
  }
  return Array.from(new Set(contexts))
}

type Case = [string, () => unknown]

const publicReads: Case[] = [
  ['getArticleBySlug', () => db.getArticleBySlug('a')],
  ['getArticlesByCategory', () => db.getArticlesByCategory('c')],
  ['getAllArticleSlugs', () => db.getAllArticleSlugs()],
  ['getCategoryCounts', () => db.getCategoryCounts()],
  ['searchArticles', () => db.searchArticles('q')],
  ['getQuestionSetBySlug', () => db.getQuestionSetBySlug('s')],
  ['getQuestionsBySetId', () => db.getQuestionsBySetId('1')],
  ['getCasesBySetId', () => db.getCasesBySetId('1')],
  ['getQuestionSets', () => db.getQuestionSets({})],
  ['getETICPAModuleArticles', () => db.getETICPAModuleArticles('level-1', 'm')],
  ['getAllQuestionSetsForAdmin', () => db.getAllQuestionSetsForAdmin()],
  ['getJobById', () => jobs.getJobById(ID)],
  ['getJobBySlug', () => jobs.getJobBySlug('s')],
  ['getJobByManageToken', () => jobs.getJobByManageToken('t')],
  ['getPendingJobsCount', () => jobs.getPendingJobsCount()],
  ['getActiveJobsCount', () => jobs.getActiveJobsCount('accountingbody')],
  ['getJobSitemapEntries', () => jobs.getJobSitemapEntries('ethiotax')],
  ['getJobSitemapChunk', () => jobs.getJobSitemapChunk('accountingbody', 0)],
  ['getPublishedCourses', () => courses.getPublishedCourses()],
  ['getCourseBySlug', () => courses.getCourseBySlug('c')],
  ['getLessonData', () => courses.getLessonData('c', 'l')],
  ['listSaved', () => saved.listSaved('v', 'accountingbody')],
  ['listSavedIds', () => saved.listSavedIds('v', 'accountingbody')],
  ['countSaved', () => saved.countSaved('v', 'accountingbody')],
  ['findSavableJob', () => saved.findSavableJob(ID, 'accountingbody')],
  [
    'getSimilarJobs',
    async () => {
      vi.stubEnv('SIMILAR_JOBS_ENABLED', 'true')
      try {
        await jobs.getSimilarJobs({ excludeId: ID, platform: 'accountingbody', title: 'Senior Tax Accountant', locationCountry: 'UK' })
      } finally {
        vi.unstubAllEnvs()
      }
    },
  ],
  ['articles page', () => ArticlesPage()],
  ['dictionary page', () => DictionaryPage({ searchParams: { letter: 'b' } })],
  ['ethiotax sitemap', () => etSitemap()],
  ['pages sitemap', () => pagesXml()],
  ['health API', () => health()],
  ['mock exam API', () => mockExam(request('https://accountingbody.com/api/mock-exam?category=x&count=5'))],
  ['ETICPA mock exam API', () => eticpaMockExam(request('https://accountingbody.com/api/eticpa/mock-exam?count=5'))],
]

const publicHeavyReads: Case[] = [
  ['getQuestionSetCount', () => db.getQuestionSetCount()],
  ['getPublishedQuestionCount', () => db.getPublishedQuestionCount()],
  ['getPublishedArticleCount', () => db.getPublishedArticleCount('ab')],
  ['getActiveDirectJobs', () => jobs.getActiveDirectJobs({ platform: 'accountingbody' })],
  ['getActiveDirectJobs count', () => jobs.getActiveDirectJobs({ platform: 'accountingbody', countOnly: true })],
  ['getCachedListingJobs', () => jobs.getCachedListingJobs({ platform: 'accountingbody' })],
  ['getCachedListingJobsCount', () => jobs.getCachedListingJobsCount({ platform: 'accountingbody' })],
  ['getBrowsableJobsCount', () => jobs.getBrowsableJobsCount('accountingbody')],
  ['getActiveJobCountries', () => jobs.getActiveJobCountries('accountingbody')],
  ['getCachedActiveJobCountries', () => jobs.getCachedActiveJobCountries('accountingbody')],
  ['jobs listings API', () => jobsDirect(request('https://accountingbody.com/api/jobs/direct?platform=ab'))],
]

// Pages and APIs that show both counts or job results and ordinary content.
const publicMixedReads: Case[] = [
  ['home page', () => HomePage({ searchParams: Promise.resolve({}) })],
  ['search API', () => search(request('https://accountingbody.com/api/search?q=budget'))],
]

const otherWork: [string, () => unknown, string[]][] = [
  ['createJob', () => jobs.createJob({ title: 't' } as never), ['publicWrite']],
  ['closeJobByManageToken', () => jobs.closeJobByManageToken('t'), ['publicRead', 'publicWrite']],
  ['markJobPaid', () => jobs.markJobPaid(ID, 's', 'o', 1), ['publicWrite']],
  ['incrementJobImpressions', () => jobs.incrementJobImpressions(ID), ['publicWrite']],
  ['incrementJobClicks', () => jobs.incrementJobClicks(ID), ['publicWrite']],
  ['insertSaved', () => saved.insertSaved('v', 'accountingbody', ID), ['publicWrite']],
  ['insertManySaved', () => saved.insertManySaved('v', 'accountingbody', [ID]), ['publicWrite']],
  ['deleteSaved', () => saved.deleteSaved('v', 'accountingbody', ID), ['publicWrite']],
  ['touchLastSeen', () => saved.touchLastSeen('v', 'accountingbody', 1000), ['publicWrite']],
  ['getAdminJobs', () => jobs.getAdminJobs({}), ['admin']],
  ['approveJob', () => jobs.approveJob(ID), ['admin']],
  ['rejectJob', () => jobs.rejectJob(ID, 'r'), ['admin']],
  ['expireJob', () => jobs.expireJob(ID), ['admin']],
  ['getCourseBySlug in admin mode', () => courses.getCourseBySlug('c', true), ['admin']],
  ['getProvider', () => providers.getProvider('p'), ['admin']],
  ['getAllProviders', () => providers.getAllProviders(), ['admin']],
  ['getLatestRunPerProvider', () => providers.getLatestRunPerProvider(), ['admin']],
  ['getExpiringJobs', () => jobs.getExpiringJobs(3), ['cron']],
  ['pruneInactive', () => saved.pruneInactive(90), ['cron']],
  ['getProvidersDueForFetch', () => providers.getProvidersDueForFetch(), ['cron']],
  ['reapStaleRuns', () => providers.reapStaleRuns(), ['cron']],
  ['createProviderRun', () => providers.createProviderRun('p', 'p'), ['ingest']],
  ['completeProviderRun', () => providers.completeProviderRun('r', {} as never), ['ingest']],
  ['failProviderRun', () => providers.failProviderRun('r', 'm', 'c'), ['ingest']],
  ['updateProviderHealth', () => providers.updateProviderHealth('p', 'success', {} as never), ['ingest']],
  ['updateProviderDataQuality', () => providers.updateProviderDataQuality('p', {} as never), ['ingest']],
  ['logProviderError', () => providers.logProviderError('p', null, 't', 'c', 'm'), ['ingest']],
  ['incrementProviderJobsToday', () => providers.incrementProviderJobsToday('p', 1), ['ingest']],
  ['updateProviderKeywordCursor', () => providers.updateProviderKeywordCursor('p', 1), ['ingest']],
  ['maybeSendProviderAlert', () => maybeSendProviderAlert(makeProvider({ last_alert_state: 'ok' }), 'ok', 0), ['ingest']],
  [
    'deduplicate',
    () => deduplicate([{ title: 't', company_name: 'c', location_text: 'l' } as never]),
    ['ingest'],
  ],
]

beforeEach(() => {
  contexts.length = 0
})

describe('database work uses the limit for its context', () => {
  it.each(publicReads)('%s uses the public read limit', async (_name, run) => {
    expect(await contextsOf(run)).toEqual(['publicRead'])
  })

  it.each(publicHeavyReads)('%s uses the longer read limit', async (_name, run) => {
    expect(await contextsOf(run)).toEqual(['publicHeavyRead'])
  })

  it.each(publicMixedReads)('%s uses the longer read limit for counts and job search only', async (_name, run) => {
    expect((await contextsOf(run)).sort()).toEqual(['publicHeavyRead', 'publicRead'])
  })

  it.each(otherWork)('%s uses %j', async (_name, run, expected) => {
    expect(await contextsOf(run)).toEqual(expected)
  })
})
