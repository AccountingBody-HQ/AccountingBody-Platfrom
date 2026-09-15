// Pure logic for the split sitemap: UUID-range bucketing and XML building.
// No React, no Supabase — lib/jobs.ts's getJobSitemapChunk uses
// bucketBounds() to query one bucket of `jobs` at a time.

export const BUCKET_COUNT = 64
const BYTES_PER_BUCKET = 256 / BUCKET_COUNT // 4 leading-byte values per bucket

function leadingByteHex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

function uuidFromLeadingByte(hex: string): string {
  return `${hex}000000-0000-0000-0000-000000000000`
}

export interface BucketBounds {
  lower: string
  upper: string | null
}

// Bucket k (0..BUCKET_COUNT-1) covers uuid leading-byte values
// [k*BYTES_PER_BUCKET, (k+1)*BYTES_PER_BUCKET). Postgres compares uuid
// values bytewise, which matches lowercase-hex string order, and
// gen_random_uuid() randomises the leading byte (the version/variant bits
// live at hex positions 13 and 17, not 1-2) — so these ranges are uniform
// and, unlike count/OFFSET-based chunking, never shift as rows are
// inserted concurrently: a row's bucket depends only on its own id, never
// on how many other rows exist or when they arrived.
export function bucketBounds(k: number): BucketBounds {
  if (!Number.isInteger(k) || k < 0 || k >= BUCKET_COUNT) {
    throw new Error(`bucketBounds: k must be an integer in [0, ${BUCKET_COUNT}), got ${k}`)
  }
  const lower = uuidFromLeadingByte(leadingByteHex(k * BYTES_PER_BUCKET))
  if (k === BUCKET_COUNT - 1) {
    return { lower, upper: null }
  }
  const upper = uuidFromLeadingByte(leadingByteHex((k + 1) * BYTES_PER_BUCKET))
  return { lower, upper }
}

// Canonical child-file name for bucket k: "0.xml" .. "63.xml", no leading
// zero. This is the one and only string parseJobChunkFile() accepts back
// for a given bucket — a route param that round-trips to anything else
// (a leading zero, an uppercase extension, extra characters) is treated
// as not found, not silently normalised.
export function jobChunkFile(k: number): string {
  if (!Number.isInteger(k) || k < 0 || k >= BUCKET_COUNT) {
    throw new Error(`jobChunkFile: k must be an integer in [0, ${BUCKET_COUNT}), got ${k}`)
  }
  return `${k}.xml`
}

export function jobChunkPath(k: number): string {
  return `/sitemaps/jobs/${jobChunkFile(k)}`
}

const JOB_CHUNK_FILE_RE = /^(0|[1-9][0-9]?)\.xml$/

export function parseJobChunkFile(file: string): number | null {
  const match = JOB_CHUNK_FILE_RE.exec(file)
  if (!match) return null
  const n = Number(match[1])
  if (n < 0 || n >= BUCKET_COUNT) return null
  return n
}

export function pagesChunkPath(): string {
  return '/sitemaps/pages.xml'
}

// Every child the index must list: the pages file first, then all 64 job
// buckets in order — BUCKET_COUNT + 1 entries total.
export function indexChildUrls(baseUrl: string): string[] {
  const urls = [`${baseUrl}${pagesChunkPath()}`]
  for (let k = 0; k < BUCKET_COUNT; k++) {
    urls.push(`${baseUrl}${jobChunkPath(k)}`)
  }
  return urls
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildSitemapIndex(locs: string[]): string {
  const entries = locs
    .map(loc => `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n  </sitemap>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`
}

export interface UrlsetEntry {
  url: string
  lastModified: Date | string
  changeFrequency: string
  priority: number
}

export function buildUrlset(entries: UrlsetEntry[]): string {
  const body = entries
    .map(e => {
      const lastmod = e.lastModified instanceof Date ? e.lastModified.toISOString() : e.lastModified
      return `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${e.changeFrequency}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}
