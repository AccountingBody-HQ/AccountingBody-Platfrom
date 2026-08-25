import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const AB_BASE_URL = 'https://accountingbody.com'

async function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await getSupabaseClient()

  const staticPages: MetadataRoute.Sitemap = [
    { url: AB_BASE_URL,                         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${AB_BASE_URL}/study`,              lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${AB_BASE_URL}/practice-questions`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${AB_BASE_URL}/articles`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${AB_BASE_URL}/glossary`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${AB_BASE_URL}/calculators`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${AB_BASE_URL}/global-payroll`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/dictionary`,         lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${AB_BASE_URL}/free-courses`,       lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${AB_BASE_URL}/get-help`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${AB_BASE_URL}/firms-freelancers`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${AB_BASE_URL}/search`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${AB_BASE_URL}/about`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${AB_BASE_URL}/contact`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${AB_BASE_URL}/privacy-policy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${AB_BASE_URL}/terms`,              lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${AB_BASE_URL}/cookie-policy`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    ...['acca', 'cima', 'aat', 'icaew'].map(body => ({
      url:             `${AB_BASE_URL}/study/${body}`,
      lastModified:    new Date(),
      changeFrequency: 'weekly'  as const,
      priority:        0.85,
    })),
  ]

  const { data: articles } = await supabase
    .from('articles')
    .select('slug, updated_at')
    .eq('status', 'published')
    .eq('platform', 'ab')

  const { data: questionSets } = await supabase
    .from('question_sets')
    .select('slug, updated_at')
    .eq('status', 'published')
    .eq('platform', 'ab')

  return [
    ...staticPages,
    ...(articles ?? []).map(a => ({
      url:             `${AB_BASE_URL}/articles/${a.slug}`,
      lastModified:    new Date(a.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority:        0.75,
    })),
    ...(questionSets ?? []).map(p => ({
      url:             `${AB_BASE_URL}/practice-questions/${p.slug}`,
      lastModified:    new Date(p.updated_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority:        0.65,
    })),
  ]
}
