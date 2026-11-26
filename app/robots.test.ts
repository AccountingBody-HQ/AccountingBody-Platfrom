import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data'
import robots from './robots'

// SEO-1 S4 (owner decisions D348, D350): the AI tools that fetch a page when
// a person asks (ChatGPT-User, PerplexityBot) may read the site; the
// training crawlers GPTBot and CCBot stay blocked; nothing else changes.

const saved = process.env.NEXT_PUBLIC_SITE_URL
beforeEach(() => { delete process.env.NEXT_PUBLIC_SITE_URL })
afterEach(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = saved
})

describe('robots.txt', () => {
  it('exact text', () => {
    expect(resolveRobots(robots())).toBe([
      'User-Agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /studio/',
      'Disallow: /_next/',
      'Disallow: /dashboard/',
      'Disallow: /account/',
      'Disallow: /private/',
      '',
      'User-Agent: GPTBot',
      'Disallow: /',
      '',
      'User-Agent: CCBot',
      'Disallow: /',
      '',
      'Host: https://accountingbody.com',
      'Sitemap: https://accountingbody.com/sitemap.xml',
      '',
    ].join('\n'))
  })

  it('ChatGPT-User and PerplexityBot have no rule of their own (the * rule applies)', () => {
    const agents = robots().rules
    const list = (Array.isArray(agents) ? agents : [agents]).map(r => r.userAgent)
    expect(list).toEqual(['*', 'GPTBot', 'CCBot'])
    expect(resolveRobots(robots())).not.toMatch(/ChatGPT-User|PerplexityBot/)
  })
})
