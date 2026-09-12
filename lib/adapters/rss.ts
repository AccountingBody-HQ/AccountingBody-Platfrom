import type { ProviderAdapter, RawJob, AdapterResult } from './types'
import type { JobProvider } from '../providers'
import { fetchWithRetry } from './fetch-with-retry'

/**
 * Extracts text content from the FIRST matching XML tag in a string.
 *
 * Handles:
 * - CDATA:          <tag><![CDATA[content]]></tag>
 * - Plain text:     <tag>content</tag>
 * - HTML entities:  &amp; &lt; &gt; &quot; &apos; &#160; etc
 * - Namespaced:     dc:creator, job:location, media:description
 * - Attributes:     <tag attr="x">content</tag> (attributes ignored, content extracted)
 *
 * @param xml  The XML string fragment to search within (typically one <item>)
 * @param tag  The tag name to search for (may include namespace prefix e.g. "dc:creator")
 */
function extractXmlField(xml: string, tag: string): string {
  // Escape special regex metacharacters in tag name (colon, dot etc)
  const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // CDATA section
  const cdataRe = new RegExp(
    `<${esc}(?:\\s[^>]*)?><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${esc}>`,
    'i'
  )
  const cdataMatch = xml.match(cdataRe)
  if (cdataMatch) return cdataMatch[1].trim()

  // Plain text
  const plainRe = new RegExp(
    `<${esc}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${esc}>`,
    'i'
  )
  const plainMatch = xml.match(plainRe)
  if (!plainMatch) return ''

  return plainMatch[1]
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .trim()
}

/**
 * Parses <item> elements from RSS 2.0.
 * Populates all standard RSS fields plus common job-feed extensions.
 * The field_mapping in job_providers maps these field names to NormalisedJob fields.
 *
 * Standard fields:  title, description, link, pubDate, guid, category
 * DC extensions:    dc:creator, dc:date, dc:subject
 * Job extensions:   job:location, job:company, job:salary, job:type
 * GeoRSS:          georss:featureName
 *
 * Convenience aliases always populated (try multiple tags, return first non-empty):
 *   company     → company tag, dc:creator, author, employer, organization, organisation
 *   location    → location, job:location, georss:featureName, city
 *   salary      → salary, job:salary, compensation, remuneration
 *   jobType     → jobType, job:type, employment_type, contract_type, type
 *
 * Uses string splitting rather than a single global regex over the whole
 * document — a lazy `[\s\S]*?` regex re-scanned across hundreds of large
 * <item> blocks risks pathological backtracking on some engines/inputs.
 *
 * A malformed individual <item> (missing closing tag, broken nesting) is
 * not detected or skipped — it's still pushed to the output with whatever
 * fields extractXmlField could find in its fragment, empty string for the
 * rest. Downstream validate()'s hard-reject checks (missing title/company/
 * application_url, description too short) are the actual safety net for a
 * genuinely broken item, the same way an empty HTTP 200 is treated as a
 * legitimate zero-results signal in adzuna.ts rather than an error.
 */
function parseRssItems(xml: string): RawJob[] {
  const items: RawJob[] = []
  // Split on opening <item tags — avoids regex backtracking on large feeds
  const segments = xml.split(/<item(?:\s[^>]*)?>/i)
  // First segment is feed header — skip it
  for (let i = 1; i < segments.length; i++) {
    const endIdx = segments[i].indexOf('</item>')
    const item = endIdx >= 0 ? segments[i].slice(0, endIdx) : segments[i]

    const title       = extractXmlField(item, 'title')
    const description = extractXmlField(item, 'description') ||
                        extractXmlField(item, 'content:encoded') ||
                        extractXmlField(item, 'summary')
    const link        = extractXmlField(item, 'link')
    const pubDate     = extractXmlField(item, 'pubDate') || extractXmlField(item, 'dc:date')
    const guid        = extractXmlField(item, 'guid')
    const category    = extractXmlField(item, 'category')

    const company =
      extractXmlField(item, 'company') ||
      extractXmlField(item, 'dc:creator') ||
      extractXmlField(item, 'author') ||
      extractXmlField(item, 'employer') ||
      extractXmlField(item, 'organization') ||
      extractXmlField(item, 'organisation') ||
      extractXmlField(item, 'job:company') ||
      ''

    const location =
      extractXmlField(item, 'location') ||
      extractXmlField(item, 'job:location') ||
      extractXmlField(item, 'georss:featureName') ||
      extractXmlField(item, 'city') ||
      extractXmlField(item, 'region') ||
      ''

    const salary =
      extractXmlField(item, 'salary') ||
      extractXmlField(item, 'job:salary') ||
      extractXmlField(item, 'compensation') ||
      extractXmlField(item, 'remuneration') ||
      ''

    const jobType =
      extractXmlField(item, 'jobType') ||
      extractXmlField(item, 'job:type') ||
      extractXmlField(item, 'employment_type') ||
      extractXmlField(item, 'contract_type') ||
      extractXmlField(item, 'type') ||
      ''

    items.push({
      // Standard RSS 2.0
      title,
      description,
      link,
      pubDate,
      guid,
      category,
      // Resolved convenience aliases — field_mapping can reference these
      company,
      location,
      salary,
      jobType,
      // Raw namespace fields — field_mapping can reference these directly
      'dc:creator':       extractXmlField(item, 'dc:creator'),
      'dc:date':          extractXmlField(item, 'dc:date'),
      'dc:subject':       extractXmlField(item, 'dc:subject'),
      'content:encoded':  extractXmlField(item, 'content:encoded'),
      'job:location':     extractXmlField(item, 'job:location'),
      'job:company':      extractXmlField(item, 'job:company'),
      'job:salary':       extractXmlField(item, 'job:salary'),
      'job:type':         extractXmlField(item, 'job:type'),
      'georss:featureName': extractXmlField(item, 'georss:featureName'),
    })
  }

  return items
}

/**
 * Parses <entry> elements from Atom 1.0 feeds.
 * Many accounting body job boards publish Atom rather than RSS 2.0.
 * Uses the same split-based approach as parseRssItems to avoid regex
 * backtracking on large feeds.
 */
function parseAtomEntries(xml: string): RawJob[] {
  const items: RawJob[] = []
  const segments = xml.split(/<entry(?:\s[^>]*)?>/i)

  for (let i = 1; i < segments.length; i++) {
    const endIdx = segments[i].indexOf('</entry>')
    const entry = endIdx >= 0 ? segments[i].slice(0, endIdx) : segments[i]

    // Atom <link> is an empty tag with href attribute, not content
    const linkMatch = entry.match(/<link(?:[^>]*)\shref=["']([^"']+)["']/)
    const link = linkMatch ? linkMatch[1] : ''

    const title       = extractXmlField(entry, 'title')
    const description = extractXmlField(entry, 'content') ||
                        extractXmlField(entry, 'summary')
    const pubDate     = extractXmlField(entry, 'published') ||
                        extractXmlField(entry, 'updated')
    const guid        = extractXmlField(entry, 'id')
    const category    = extractXmlField(entry, 'category')

    const company =
      extractXmlField(entry, 'company') ||
      extractXmlField(entry, 'author') ||
      extractXmlField(entry, 'employer') ||
      ''

    const location =
      extractXmlField(entry, 'location') ||
      extractXmlField(entry, 'georss:featureName') ||
      ''

    const salary =
      extractXmlField(entry, 'salary') ||
      extractXmlField(entry, 'compensation') ||
      ''

    const jobType =
      extractXmlField(entry, 'jobType') ||
      extractXmlField(entry, 'employment_type') ||
      ''

    items.push({
      title, description, link, pubDate, guid, category,
      company, location, salary, jobType,
    })
  }

  return items
}

export const rssAdapter: ProviderAdapter = {
  async fetch(provider: JobProvider): Promise<AdapterResult> {
    const baseUrl = provider.base_url
    if (!baseUrl) throw new Error(`No base_url configured for provider ${provider.slug}`)

    const url = new URL(baseUrl)

    // Apply request_config as query params — same pattern as generic-rest
    const requestConfig = (provider.request_config ?? {}) as Record<string, unknown>
    for (const [key, val] of Object.entries(requestConfig)) {
      if (typeof val === 'string' || typeof val === 'number') {
        url.searchParams.set(key, String(val))
      }
    }

    const res = await fetchWithRetry(
      url.toString(),
      {
        headers: {
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'User-Agent': 'AccountingBody/1.0 (accounting & finance job aggregator)',
        },
      },
      3,
      1000
    )

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${provider.slug}`)
    }

    const xml = await res.text()

    // Auto-detect RSS vs Atom
    const isAtom = xml.includes('<feed') && xml.includes('<entry')
    const jobs = isAtom ? parseAtomEntries(xml) : parseRssItems(xml)

    // Rule 120: a response body that isn't RSS/Atom/XML at all (a truncated
    // document, an HTML error page served with 200, a "coming soon"
    // placeholder) parses to zero items via the lenient split-based parser
    // above, indistinguishable from a feed that genuinely has zero jobs
    // today. Only treat zero items as a real failure when the body also
    // carries none of the standard feed root markers — a feed that legitimately
    // has no current listings still declares itself as a feed.
    if (
      jobs.length === 0 &&
      !xml.includes('<rss') &&
      !xml.includes('<?xml') &&
      !xml.includes('<feed')
    ) {
      throw new Error('rss adapter: response body does not look like a feed')
    }

    return {
      jobs,
      pagesFetched: 1, // RSS/Atom feeds are single-page by design
      totalAvailable: null,
    }
  }
}
