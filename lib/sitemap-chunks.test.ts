import { describe, it, expect } from 'vitest'
import {
  BUCKET_COUNT,
  bucketBounds,
  jobChunkFile,
  jobChunkPath,
  parseJobChunkFile,
  pagesChunkPath,
  indexChildUrls,
  escapeXml,
  buildSitemapIndex,
  buildUrlset,
} from './sitemap-chunks'

describe('bucketBounds', () => {
  it('covers every k from 0 to BUCKET_COUNT-1 with a well-formed lower bound', () => {
    for (let k = 0; k < BUCKET_COUNT; k++) {
      const { lower } = bucketBounds(k)
      expect(lower).toMatch(/^[0-9a-f]{2}000000-0000-0000-0000-000000000000$/)
    }
  })

  it('the first bucket (k=0) starts at the all-zero leading byte', () => {
    expect(bucketBounds(0).lower).toBe('00000000-0000-0000-0000-000000000000')
  })

  it('the last bucket (k=BUCKET_COUNT-1) has no upper bound', () => {
    expect(bucketBounds(BUCKET_COUNT - 1).upper).toBeNull()
  })

  it('every non-last bucket has a well-formed upper bound', () => {
    for (let k = 0; k < BUCKET_COUNT - 1; k++) {
      const { upper } = bucketBounds(k)
      expect(upper).toMatch(/^[0-9a-f]{2}000000-0000-0000-0000-000000000000$/)
    }
  })

  it('is contiguous: bucket k+1 starts exactly where bucket k ends', () => {
    for (let k = 0; k < BUCKET_COUNT - 1; k++) {
      expect(bucketBounds(k).upper).toBe(bucketBounds(k + 1).lower)
    }
  })

  it('throws on an out-of-range k', () => {
    expect(() => bucketBounds(-1)).toThrow()
    expect(() => bucketBounds(BUCKET_COUNT)).toThrow()
    expect(() => bucketBounds(1.5)).toThrow()
  })

  it('every possible leading byte 0x00-0xff falls in exactly one bucket', () => {
    const bounds = Array.from({ length: BUCKET_COUNT }, (_, k) => bucketBounds(k))
    for (let byte = 0; byte <= 0xff; byte++) {
      const hex = byte.toString(16).padStart(2, '0')
      const candidate = `${hex}000000-0000-0000-0000-000000000000`
      const matches = bounds.filter(
        b => candidate >= b.lower && (b.upper === null || candidate < b.upper)
      )
      expect(matches.length).toBe(1)
    }
  })
})

describe('jobChunkFile / jobChunkPath', () => {
  it('emits the canonical no-leading-zero filename', () => {
    expect(jobChunkFile(0)).toBe('0.xml')
    expect(jobChunkFile(63)).toBe('63.xml')
    expect(jobChunkPath(5)).toBe('/sitemaps/jobs/5.xml')
  })

  it('throws on an out-of-range bucket', () => {
    expect(() => jobChunkFile(-1)).toThrow()
    expect(() => jobChunkFile(BUCKET_COUNT)).toThrow()
  })
})

describe('parseJobChunkFile', () => {
  it('accepts the canonical boundary filenames', () => {
    expect(parseJobChunkFile('0.xml')).toBe(0)
    expect(parseJobChunkFile('63.xml')).toBe(63)
  })

  it('accepts every filename jobChunkFile emits, round-trip', () => {
    for (let k = 0; k < BUCKET_COUNT; k++) {
      expect(parseJobChunkFile(jobChunkFile(k))).toBe(k)
    }
  })

  it('rejects a bucket number at or past BUCKET_COUNT', () => {
    expect(parseJobChunkFile('64.xml')).toBeNull()
  })

  it('rejects a negative number', () => {
    expect(parseJobChunkFile('-1.xml')).toBeNull()
  })

  it('rejects a non-numeric filename', () => {
    expect(parseJobChunkFile('07a.xml')).toBeNull()
    expect(parseJobChunkFile('abc')).toBeNull()
  })

  it('rejects an uppercase extension', () => {
    expect(parseJobChunkFile('1.XML')).toBeNull()
  })

  it('rejects a leading zero — the canonical form has none', () => {
    expect(parseJobChunkFile('01.xml')).toBeNull()
  })
})

describe('indexChildUrls', () => {
  it('lists the pages file plus every job bucket — BUCKET_COUNT + 1 entries', () => {
    const urls = indexChildUrls('https://accountingbody.com')
    expect(urls.length).toBe(BUCKET_COUNT + 1)
    expect(urls[0]).toBe(`https://accountingbody.com${pagesChunkPath()}`)
    expect(urls[1]).toBe('https://accountingbody.com/sitemaps/jobs/0.xml')
    expect(urls[urls.length - 1]).toBe('https://accountingbody.com/sitemaps/jobs/63.xml')
  })
})

describe('escapeXml', () => {
  it('escapes all five XML special characters', () => {
    expect(escapeXml('&')).toBe('&amp;')
    expect(escapeXml('<')).toBe('&lt;')
    expect(escapeXml('>')).toBe('&gt;')
    expect(escapeXml('"')).toBe('&quot;')
    expect(escapeXml("'")).toBe('&apos;')
  })

  it('escapes a mix in one string, in document order', () => {
    expect(escapeXml(`a & b < c > d "e" f'g`)).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot; f&apos;g'
    )
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeXml('accounts-payable-clerk-robert-half-xrpz')).toBe(
      'accounts-payable-clerk-robert-half-xrpz'
    )
  })
})

describe('buildSitemapIndex', () => {
  it('has exactly 65 <sitemap> entries for a full index', () => {
    const urls = indexChildUrls('https://accountingbody.com')
    const xml = buildSitemapIndex(urls)
    const count = (xml.match(/<sitemap>/g) ?? []).length
    expect(count).toBe(65)
  })

  it('wraps entries in a valid <sitemapindex> root with each <loc> escaped', () => {
    const xml = buildSitemapIndex(['https://accountingbody.com/sitemaps/pages.xml?a=1&b=2'])
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</sitemapindex>')
    expect(xml).toContain('<loc>https://accountingbody.com/sitemaps/pages.xml?a=1&amp;b=2</loc>')
  })
})

describe('buildUrlset', () => {
  it('renders loc/lastmod/changefreq/priority for each entry, loc escaped', () => {
    const xml = buildUrlset([
      {
        url: 'https://accountingbody.com/jobs/a-b-c?x=1&y=2',
        lastModified: new Date('2026-09-15T00:00:00.000Z'),
        changeFrequency: 'daily',
        priority: 0.7,
      },
    ])
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://accountingbody.com/jobs/a-b-c?x=1&amp;y=2</loc>')
    expect(xml).toContain('<lastmod>2026-09-15T00:00:00.000Z</lastmod>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>0.7</priority>')
  })
})
