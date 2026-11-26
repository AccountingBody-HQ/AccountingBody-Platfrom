import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// SEO-1 S6 (owner decision D350): /calculators has its own title and
// description, and the glossary's category counts are read live.

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
const COUNTS = vi.hoisted(() => ({
  'financial-accounting': 1101, 'financial-management': 1202, 'management-accounting': 1303, 'financial-market': 1404,
  'business-management': 1505, 'audit-assurance': 1606, taxation: 1707, economics: 1808, cryptocurrency: 1909, 'tools-templates': 2010,
} as Record<string, number>))
vi.mock('@/lib/db', () => ({
  getCachedPublishedArticleCount: vi.fn(async () => 2017),
  getCategoryCounts: vi.fn(async () => ({ ...COUNTS })),
}))

import * as ReactModule from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as db from '@/lib/db'
import { generateMetadata as calculatorsMetadata } from '@/app/calculators/layout'
;(globalThis as { React?: unknown }).React = ReactModule

const INTRO = '24 free instant calculators for ACCA, CIMA, ICAEW and AAT students. Results update as you type. No signup required.'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

beforeEach(() => H.map.clear())

describe('/calculators metadata', () => {
  it('Accounting Body: own title (the template adds the brand), the visible intro, unchanged canonical', async () => {
    expect(await calculatorsMetadata()).toEqual({
      title: 'Accounting Calculators',
      description: '24 free instant calculators for ACCA, CIMA, ICAEW and AAT students. Results update as you type. No signup required.',
      alternates: { canonical: 'https://accountingbody.com/calculators' },
      openGraph: { url: 'https://accountingbody.com/calculators' },
    })
  })

  it('EthioTax: the intro as the EthioTax view shows it', async () => {
    H.map.set('x-et-platform', 'ethiotax')
    expect(await calculatorsMetadata()).toMatchObject({
      title: 'Accounting Calculators',
      description: '24 free instant calculators for ACCA, CIMA, ETICPA and AAT students. Results update as you type. No signup required.',
    })
  })

  it('the page shows the same sentence, through the same brandText, and the H1 the title repeats', () => {
    const page = read('app/calculators/page.tsx')
    expect(page).toContain(`{brandText(isEthioTax, '${INTRO}')}`)
    expect(read('app/calculators/layout.tsx')).toContain(`description: brandText(isEthioTax, '${INTRO}'),`)
    expect(page).toContain('>Accounting Calculators</h1>')
  })
})

describe('/glossary category counts', () => {
  it('shows the live count for each category, in the same order, and no old fixed number', async () => {
    const Page = (await import('@/app/glossary/page')).default as unknown as () => Promise<ReactModule.ReactElement>
    const html = renderToStaticMarkup(await Page())
    expect(db.getCategoryCounts).toHaveBeenCalledTimes(1)
    const shown = Array.from(html.matchAll(/href="\/dictionary\?category=([a-z-]+)"[\s\S]*?>(\d[\d,]*)</g)).map(m => [m[1], m[2]])
    expect(shown).toEqual(Object.entries(COUNTS).map(([slug, n]) => [slug, n.toLocaleString()]))
    const src = read('app/glossary/page.tsx')
    expect(src).not.toMatch(/count: \d/)
  })
})
