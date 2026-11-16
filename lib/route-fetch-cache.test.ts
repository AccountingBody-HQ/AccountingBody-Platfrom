import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Next 14.2 keeps caching fetch() calls (every Supabase read included) in a
// GET-only route handler marked force-dynamic unless the file also sets
// fetchCache = 'force-no-store' (or 'default-no-store' where unstable_cache
// must still read its entries, as in app/api/jobs/direct). This guard keeps
// every such route that reads data uncached (16 Nov 2026, FINDINGS EG).

const ROOT = process.cwd()

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return routeFiles(path)
    return name === 'route.ts' ? [path] : []
  })
}

const FORCE_DYNAMIC = /export const dynamic = ['"]force-dynamic['"]/
const NO_STORE = /export const fetchCache = ['"](force|default)-no-store['"]/
const GET = /export (async )?function GET\b/
const WRITES = /export (async )?function (POST|PUT|PATCH|DELETE)\b/
const READS_DATA = /getServerSupabase\(|\bfetch\(/

describe('route handler data caching', () => {
  it('every GET-only force-dynamic route that reads data sets fetchCache to a no-store mode', () => {
    const missing = routeFiles(join(ROOT, 'app'))
      .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
      .filter(({ source }) => FORCE_DYNAMIC.test(source) && GET.test(source) && !WRITES.test(source))
      .filter(({ source }) => READS_DATA.test(source) && !NO_STORE.test(source))
    expect(missing.length).toBe(0)
  })

  it('the hiring brief link route is never pre-built and never caches its reads', () => {
    const source = readFileSync(join(ROOT, 'app/api/recruitment/confirm-brief/route.ts'), 'utf8')
    expect(source).toMatch(FORCE_DYNAMIC)
    expect(source).toMatch(NO_STORE)
  })

  it('the WhatsApp redirect stays built once', () => {
    const source = readFileSync(join(ROOT, 'app/wa/route.ts'), 'utf8')
    expect(source).toMatch(/export const dynamic = 'force-static'/)
  })

  it('finds route files to check', () => {
    expect(routeFiles(join(ROOT, 'app')).map((path) => relative(ROOT, path)).length).toBeGreaterThan(40)
  })
})
