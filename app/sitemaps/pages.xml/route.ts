import { NextResponse } from 'next/server'
import { getPagesSitemapContent } from '@/lib/db'
import { contentOwner, ownerUrl, resolveArticleCanonicalUrl } from '@/lib/canonical'
import { buildUrlset, type UrlsetEntry } from '@/lib/sitemap-chunks'
import { getOpenMockExamSubjects } from '@/lib/mock-exam-subjects'

const AB_BASE_URL = 'https://accountingbody.com'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'

// Static pages, published articles, practice-question sets, and published
// courses with their lessons. If any of those reads fails, this answers 500
// and is never cached, instead of a sitemap that leaves those pages out (the
// reads, their log line and report live in getPagesSitemapContent in
// lib/db.ts). Jobs live in app/sitemaps/jobs/[file]/route.ts instead.
export async function GET() {
  const result = await getPagesSitemapContent()
  if (!result.ok) {
    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  const { articles, questionSets, courses } = result
  // The open mock-exam subjects, in the hub's order; a subject still under
  // 50 questions ("Coming soon") is left out (lib/mock-exam-subjects.ts).
  const mockExamSubjects = await getOpenMockExamSubjects()

  const staticPages: UrlsetEntry[] = [
    { url: AB_BASE_URL,                         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${AB_BASE_URL}/study`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${AB_BASE_URL}/practice-questions`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${AB_BASE_URL}/jobs`,               lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/jobs/listings`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${AB_BASE_URL}/articles`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${AB_BASE_URL}/glossary`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${AB_BASE_URL}/calculators`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${AB_BASE_URL}/global-payroll`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/dictionary`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${AB_BASE_URL}/free-courses`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/get-help`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${AB_BASE_URL}/firms-freelancers`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${AB_BASE_URL}/about`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${AB_BASE_URL}/contact`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${AB_BASE_URL}/privacy-policy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${AB_BASE_URL}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${AB_BASE_URL}/cookie-policy`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    ...['acca', 'cima', 'aat', 'icaew'].map(body => ({
      url:             `${AB_BASE_URL}/study/${body}`,
      lastModified:    new Date(),
      changeFrequency: 'weekly' as const,
      priority:        0.85,
    })),
    // The mock-exam hub and each open subject it links to (app/mock-exams).
    { url: `${AB_BASE_URL}/mock-exams`,         lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    ...mockExamSubjects.map(subject => ({
      url:             `${AB_BASE_URL}/mock-exams/${subject.slug}`,
      lastModified:    new Date(),
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    })),
  ]

  const entries: UrlsetEntry[] = [
    ...staticPages,
    // Only articles whose one owner is accountingbody.com (owner rule D272;
    // the same rule the article pages use).
    ...articles.filter(a => contentOwner(a) === 'accountingbody').map(a => ({
      url:             resolveArticleCanonicalUrl(a),
      lastModified:    new Date(a.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority:        0.75,
    })),
    ...questionSets.map(p => ({
      url:             `${AB_BASE_URL}/practice-questions/${p.slug}`,
      lastModified:    new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority:        0.65,
    })),
    // The same owner rule as the course and lesson pages' own canonicals (D272);
    // a lesson takes its course's owner and date.
    ...courses.filter(c => contentOwner(c) === 'accountingbody').flatMap(c => [
      { path: `/free-courses/${c.slug}`, priority: 0.7 },
      ...c.lessonSlugs.map(lesson => ({ path: `/free-courses/${c.slug}/learn/${lesson}`, priority: 0.6 })),
    ].map(({ path, priority }) => ({
      url:             ownerUrl('accountingbody', path),
      lastModified:    new Date(c.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority,
    }))),
  ]

  const xml = buildUrlset(entries)

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
