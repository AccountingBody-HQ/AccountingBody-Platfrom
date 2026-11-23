import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities } from './html-entities'
import { buildJobPostingSchema } from '@/app/jobs/[slug]/structured-data'
import type { Job } from './jobs'

describe('decodeHtmlEntities', () => {
  it.each([
    ['Smith &#038; Co', 'Smith & Co'],
    ['Smith &#x26; Co', 'Smith & Co'],
    ['Smith &#X26; Co', 'Smith & Co'],
    ['Smith &amp; Co', 'Smith & Co'],
    ['&lt;b&gt;', '<b>'],
    ['&quot;Q&quot; &#39;A&#39; &apos;B&apos;', '"Q" \'A\' \'B\''],
    ['A&nbsp;B', 'A B'],
    ['Caf&#233;', 'Café'],
    ['&#128512;', '😀'],
  ])('decodes %j', (input, output) => {
    expect(decodeHtmlEntities(input)).toBe(output)
  })

  it('decodes once only: no double decoding', () => {
    expect(decodeHtmlEntities('A &amp;#038; B')).toBe('A &#038; B')
    expect(decodeHtmlEntities('&amp;amp;')).toBe('&amp;')
    expect(decodeHtmlEntities(decodeHtmlEntities('&amp;lt;'))).toBe('<')
  })

  it('leaves other text, unknown names and unusable numbers as written', () => {
    for (const text of ['Plain name', 'AT&T', 'R&D Ltd', '&copy; 2026', '&#0;', '&#xD800;', '&#99999999;', '&#;', '&AMP;', '& amp;']) {
      expect(decodeHtmlEntities(text)).toBe(text)
    }
  })

  it('gives plain text: a decoded <script> is just characters', () => {
    expect(decodeHtmlEntities('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>')
  })

  it('passes null, undefined and empty through', () => {
    expect(decodeHtmlEntities(null)).toBeNull()
    expect(decodeHtmlEntities(undefined)).toBeUndefined()
    expect(decodeHtmlEntities('')).toBe('')
  })

  it('the job JSON-LD shows the decoded title and company', () => {
    const job = {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Tax &amp; Audit Senior',
      company_name: 'Smith &#038; Co',
      description: 'Line one',
      excerpt: null,
      published_at: '2026-11-20T00:00:00Z',
      created_at: '2026-11-20T00:00:00Z',
      location_country: null,
    } as unknown as Job
    const schema = buildJobPostingSchema(job, 'Accounting Body')
    expect(schema.title).toBe('Tax & Audit Senior')
    expect((schema.hiringOrganization as { name: string }).name).toBe('Smith & Co')
  })
})

// The display sites use the helper; no dangerouslySetInnerHTML is added.
describe('company names and titles are decoded where they are shown', () => {
  const read = (path: string) => readFileSync(path, 'utf8')
  const IMPORT = "import { decodeHtmlEntities } from '@/lib/html-entities'"

  it.each([
    ['app/jobs/listings/JobListingsClient.tsx', [
      'const displayTitle = decodeHtmlEntities(job.title)',
      'const displayCompany = decodeHtmlEntities(job.company_name)',
      'const initials = getCompanyInitials(displayCompany)',
      'aria-label={`${displayTitle} at ${displayCompany}`}',
      '{displayTitle}',
      '{displayCompany}</p>',
    ]],
    ['app/jobs/[slug]/page.tsx', [
      'const title = `${decodeHtmlEntities(job.title)} at ${decodeHtmlEntities(job.company_name)}`',
      'const displayTitle = decodeHtmlEntities(job.title)',
      'const displayCompany = decodeHtmlEntities(job.company_name)',
      'jobTitle={displayTitle}',
      '{getCompanyInitials(displayCompany)}',
      '{displayTitle}',
      '{displayCompany}</p>',
      '{decodeHtmlEntities(similar.title)}',
      '{decodeHtmlEntities(similar.company_name)}',
    ]],
    ['app/jobs/[slug]/structured-data.tsx', [
      'title: decodeHtmlEntities(job.title),',
      'name: decodeHtmlEntities(job.company_name),',
    ]],
    ['app/jobs/apply/[id]/page.tsx', [
      '{decodeHtmlEntities(job.title)}',
      '{decodeHtmlEntities(job.company_name)}',
    ]],
    ['app/jobs/[slug]/ApplyButton.tsx', [
      'const companyName = decodeHtmlEntities(job.company_name)?.trim()',
      "encodeURIComponent('Application: ' + decodeHtmlEntities(job.title))",
    ]],
  ] as const)('%s', (file, needles) => {
    const source = read(file)
    expect(source).toContain(IMPORT)
    for (const needle of needles) expect([file, needle, source.includes(needle)]).toEqual([file, needle, true])
    expect(source).not.toContain('dangerouslySetInnerHTML={{ __html: job.')
    // The raw name is no longer shown as text on these screens.
    expect(source).not.toMatch(/>\{job\.(title|company_name)\}/)
    expect(source).not.toMatch(/^\s*\{job\.(title|company_name)\}\s*$/m)
  })

  it('the job page still sends the stored title to the similar-jobs query', () => {
    expect(read('app/jobs/[slug]/page.tsx')).toContain('    title: job.title,\n')
  })
})
