import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PRIV-3 S2 (owner decision D353 (2)): Vercel Web Analytics and Speed Insights run for everyone, and
// "Reject non-essential cookies" really turns them off. There is no DOM library in this project, so the
// component's two hooks are driven by a small stand-in: useState keeps its value between calls, and
// useEffect is collected and run when the test "mounts" the component (as React does after the first
// render in the browser; never on the server).
;(globalThis as { React?: typeof React }).React = React

const H = vi.hoisted(() => ({
  state: [] as unknown[],
  index: 0,
  effects: [] as Array<() => void | (() => void)>,
}))

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  const useState = <T,>(initial: T) => {
    const k = H.index++
    if (!(k in H.state)) H.state[k] = initial
    return [H.state[k] as T, (v: T) => { H.state[k] = v }] as const
  }
  const useEffect = (fn: () => void | (() => void)) => {
    H.effects.push(fn)
  }
  return { ...real, default: { ...real, useState, useEffect }, useState, useEffect }
})
vi.mock('@vercel/analytics/next', () => ({ Analytics: function Analytics() { return null } }))
vi.mock('@vercel/speed-insights/next', () => ({ SpeedInsights: function SpeedInsights() { return null } }))

type El = { type: unknown; props: { children?: El[]; beforeSend?: (e: unknown) => unknown } } | null

function fakeStorage(initial: Record<string, string> = {}, { throwing = false } = {}) {
  const store = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => { if (throwing) throw new Error('blocked'); return store.has(k) ? store.get(k)! : null },
    setItem: (k: string, v: string) => { if (throwing) throw new Error('blocked'); store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  })
  return store
}

async function load() {
  vi.resetModules()
  H.state = []
  H.effects = []
  const consent = await import('@/lib/consent')
  const mod = await import('./VercelStatistics')
  const render = (): El => {
    H.index = 0
    return mod.default() as unknown as El
  }
  const mount = () => {
    const effects = H.effects.splice(0)
    const cleanups = effects.map((fn) => fn())
    return () => cleanups.forEach((c) => typeof c === 'function' && c())
  }
  return { consent, mod, render, mount }
}

const names = (el: El) => (el ? (el.props.children ?? []).map((c) => (c && typeof c.type === 'function' ? c.type.name : '?')) : [])

beforeEach(() => {
  vi.unstubAllGlobals()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VercelStatistics: Reject really turns Vercel statistics off', () => {
  it('renders nothing before mount (the server render), whatever the choice', async () => {
    for (const stored of [undefined, 'accepted', 'declined']) {
      fakeStorage(stored ? { ab_cookie_consent: stored } : {})
      const { render } = await load()
      expect(render()).toBeNull()
    }
  })

  it('no choice yet: both are rendered after mount', async () => {
    fakeStorage()
    const { render, mount } = await load()
    render()
    mount()
    expect(names(render())).toStrictEqual(['Analytics', 'SpeedInsights'])
  })

  it('accepted: both are rendered', async () => {
    fakeStorage({ ab_cookie_consent: 'accepted' })
    const { render, mount } = await load()
    render()
    mount()
    expect(names(render())).toStrictEqual(['Analytics', 'SpeedInsights'])
  })

  it('declined (a later page view): neither is rendered, so neither script is loaded', async () => {
    fakeStorage({ ab_cookie_consent: 'declined' })
    const { render, mount } = await load()
    render()
    mount()
    expect(render()).toBeNull()
  })

  it('a change to declined on the open page removes both, and beforeSend drops every later event', async () => {
    fakeStorage()
    const { consent, mod, render, mount } = await load()
    render()
    mount()
    const el = render()
    expect(names(el)).toStrictEqual(['Analytics', 'SpeedInsights'])
    const hooks = (el?.props.children ?? []).map((c) => c?.props.beforeSend)
    expect(hooks).toStrictEqual([mod.dropWhenRejected, mod.dropWhenRejected])
    const event = { type: 'pageview', url: '/x' }
    expect(mod.dropWhenRejected(event)).toBe(event)
    consent.writeConsent('declined')
    expect(render()).toBeNull()
    expect(mod.dropWhenRejected(event)).toBeNull()
    // and back on after Accept
    consent.writeConsent('accepted')
    expect(names(render())).toStrictEqual(['Analytics', 'SpeedInsights'])
    expect(mod.dropWhenRejected(event)).toBe(event)
  })

  it('ignores the "open settings" event and stops listening on unmount', async () => {
    fakeStorage()
    const { consent, render, mount } = await load()
    render()
    const unmount = mount()
    consent.openConsentSettings()
    expect(names(render())).toStrictEqual(['Analytics', 'SpeedInsights'])
    unmount()
    const before = render()
    consent.writeConsent('declined')
    // no listener any more: the stored state is not changed by the event
    expect(render()).toStrictEqual(before)
  })

  it('storage that throws reads as "no choice": both rendered (the statistical exception, D353 (2))', async () => {
    fakeStorage({}, { throwing: true })
    const { consent, mod, render, mount } = await load()
    expect(consent.readConsent()).toBeNull()
    expect(mod.statisticsAllowed()).toBe(true)
    render()
    mount()
    expect(names(render())).toStrictEqual(['Analytics', 'SpeedInsights'])
    // a Reject still applies to this page even when storage cannot keep it
    consent.writeConsent('declined')
    expect(consent.readConsent()).toBe('declined')
    expect(render()).toBeNull()
  })

  it('the layout renders the component once, in place of the two direct tags', () => {
    const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    expect(layout).toContain("import VercelStatistics from '@/components/VercelStatistics'")
    expect(layout.split('<VercelStatistics />').length - 1).toBe(1)
    expect(layout).not.toMatch(/<Analytics\b|<SpeedInsights\b|@vercel\/analytics|@vercel\/speed-insights/)
    const src = readFileSync(join(process.cwd(), 'components/VercelStatistics.tsx'), 'utf8')
    expect(src).toContain("'use client'")
    expect(src).toContain('<Analytics beforeSend={dropWhenRejected} />')
    expect(src).toContain('<SpeedInsights beforeSend={dropWhenRejected} />')
    expect(src).toContain('const [on, setOn] = useState(false)')
    // one storage read helper: the component reuses readConsent
    expect(src).not.toMatch(/localStorage|sessionStorage/)
  })
})
