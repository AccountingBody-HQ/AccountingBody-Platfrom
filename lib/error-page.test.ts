import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// vitest compiles app/error.tsx with the classic JSX transform, which reads
// a global React; Next's own build does not need this.
;(globalThis as { React?: typeof React }).React = React

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
    createElement('a', { href, className }, children as never),
}))

import ErrorPage from '@/app/error'

describe('app/error.tsx', () => {
  const html = renderToStaticMarkup(createElement(ErrorPage, { error: new Error('x'), reset: () => {} }))

  it('says the problem is temporary', () => {
    expect(html).toContain('temporary problem')
  })

  it('offers a Try again button and a way home', () => {
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/)
    expect(html).toContain('href="/"')
  })

  it('never says the page was not found', () => {
    expect(html.toLowerCase()).not.toContain('not found')
    expect(html).not.toContain('404')
  })
})
