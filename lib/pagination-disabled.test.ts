import React, { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/components/Pagination'

// The .tsx files compile with the classic JSX runtime under vitest.
;(globalThis as { React?: typeof React }).React = React

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
}))

// W0-1 C4: a disabled Previous/Next looks the same (muted) in every mode.

const MUTED = ['aria-disabled:pointer-events-none', 'aria-disabled:border-slate-200', 'aria-disabled:!bg-slate-50']
const href = (n: number) => `/articles?page=${n}`
const noop = () => {}

function render(props: Record<string, unknown>) {
  return renderToString(createElement(Pagination, { page: 1, totalPages: 9, total: 205, ...props } as never))
}
const control = (html: string, label: 'Previous' | 'Next') =>
  html.match(new RegExp(`<(a|button|span) [^>]*aria-label="${label} page"[^>]*>`))?.[0] ?? ''
const classes = (tag: string) => (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(' ')
const visibleColours = (html: string, label: 'Previous' | 'Next') => {
  const start = html.indexOf(control(html, label))
  const body = html.slice(start, html.indexOf(label === 'Previous' ? '<span class="sm:hidden' : '<form', start))
  return Array.from(body.matchAll(/(?:color|stroke):(#[0-9A-Fa-f]{6})/g)).map((m) => m[1])
}

describe('C4: a disabled Previous/Next is muted in every mode', () => {
  it.each([
    ['Previous', 1],
    ['Next', 9],
  ] as const)('hrefFor mode: the disabled %s is a muted span without a link', (label, page) => {
    const tag = control(render({ page, hrefFor: href }), label)
    expect(tag.startsWith('<span ')).toBe(true)
    expect(tag).toContain('role="link"')
    expect(tag).toContain('aria-disabled="true"')
    expect(tag).not.toContain('href=')
    for (const c of MUTED) expect(classes(tag)).toContain(c)
  })

  it('its label and icon keep the muted grey, never navy', () => {
    const colours = visibleColours(render({ hrefFor: href }), 'Previous')
    expect(colours.length).toBeGreaterThanOrEqual(2)
    expect(new Set(colours.slice(0, 2))).toEqual(new Set(['#b0ac9f']))
  })

  it('an enabled Previous/Next in hrefFor mode is a real link with no aria-disabled', () => {
    for (const label of ['Previous', 'Next'] as const) {
      const tag = control(render({ page: 3, hrefFor: href }), label)
      expect(tag.startsWith('<a ')).toBe(true)
      expect(tag).not.toContain('aria-disabled=')
      expect(tag).toContain('href="/articles?page=')
    }
  })

  it('onChange mode is as before: real buttons, disabled only at the ends, aria-disabled="false" when enabled', () => {
    const first = render({ page: 1, onChange: noop })
    expect(control(first, 'Previous')).toContain('<button type="button" disabled="" aria-disabled="true"')
    expect(control(first, 'Next')).toContain('<button type="button" aria-disabled="false"')
  })

  it('the compiled classes match aria-disabled="true" only, and win over the EthioTax fill', async () => {
    const config = { content: [{ raw: MUTED.join(' '), extension: 'html' }], corePlugins: { preflight: false } }
    const { css } = await postcss([tailwindcss(config as never)]).process('@tailwind utilities;', { from: undefined })
    const rules = css.match(/\.aria-disabled[^{]*\{/g) ?? []
    expect(rules).toHaveLength(3)
    for (const rule of rules) expect(rule).toMatch(/\[aria-disabled="true"\] \{$/)
    expect(css).toMatch(/bg-slate-50\[aria-disabled="true"\] \{[^}]*background-color: [^;}]*!important/)
    const globals = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
    expect(globals).toContain('html[data-brand="ethiotax"] .surface-navy { background-color: #1A4731; }')
  })
})
