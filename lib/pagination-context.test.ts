import React, { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/components/Pagination'
import { ArticlesPagination } from '@/app/articles/ArticlesPagination'

// The .tsx files compile with the classic JSX runtime under vitest.
;(globalThis as { React?: typeof React }).React = React

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
}))

// W0-1 C5: /articles shows its total once, at the top of the list; every
// other list keeps the pagination context line.

const text = (html: string) => html.replace(/<!-- -->/g, '')
const render = (props: Record<string, unknown>) =>
  text(renderToString(createElement(Pagination, { page: 2, totalPages: 41, total: 2017, itemLabel: 'article', hrefFor: (n: number) => `/x?page=${n}`, ...props } as never)))
const LINE = 'Page 2 of 41 · 2,017 articles'

describe('C5: the pagination context line', () => {
  it('is shown by default, and when showContext is true', () => {
    expect(render({})).toContain(`>${LINE}</p>`)
    expect(render({ showContext: true })).toBe(render({}))
  })

  it('showContext={false} leaves out that line and nothing else', () => {
    const without = render({ showContext: false })
    expect(without).not.toContain(LINE)
    expect(without).toBe(render({}).replace(/<p class="[^"]*">Page 2 of 41 · 2,017 articles<\/p>/, ''))
  })

  it('the articles list leaves it out; its count line at the top is unchanged', () => {
    const html = text(renderToString(createElement(ArticlesPagination, { page: 2, totalPages: 41, total: 2017 })))
    expect(html).toContain('aria-label="Articles pages"')
    expect(html).not.toContain('2,017')
    expect(readFileSync(join(process.cwd(), 'app/articles/page.tsx'), 'utf8'))
      .toContain("const countLine = `${total.toLocaleString('en-GB')} articles${totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}`")
  })

  it('no other list passes showContext', () => {
    for (const file of ['app/practice-questions/PracticeQuestionsPagination.tsx', 'app/jobs/listings/JobListingsClient.tsx'])
      expect([file, readFileSync(join(process.cwd(), file), 'utf8').includes('showContext')]).toEqual([file, false])
  })
})
