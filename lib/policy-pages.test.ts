import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Clerk was retired on 16 Nov 2026 (D185); the policy pages stopped naming it in November 2026 (D196).
describe('cookie and privacy policy pages', () => {
  for (const file of ['app/cookie-policy/page.tsx', 'app/privacy-policy/page.tsx']) {
    it(`${file} does not name Clerk and is dated November 2026`, () => {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/clerk/i)
      expect(source).not.toMatch(/__session/)
      expect(source).toContain('Last updated: November 2026')
    })
  }

  // PRIV-2 S1 (D352, D356): the cookies section is now section 6 with the
  // owner-approved text (practice progress moved to section 2, see
  // lib/priv2-wording.test.ts); the PQB-3b text is gone.
  it('the privacy policy cookies section text is exact; the old text is gone', () => {
    const source = readFileSync('app/privacy-policy/page.tsx', 'utf8')
    const body = "      id: 'cookies', nav: 'Cookies', title: '6. Cookies',\n      body: [\n        'See our Cookie Policy. You can change your choice at any time with \"Cookie settings\" at the bottom of every page.',\n      ],\n"
    expect(source.split(body).length - 1).toBe(1)
    expect(source).toContain("'Practice progress: kept only on your device, and never sent to us.',")
    expect(source).not.toContain('We use cookies and similar storage on your device for authentication')
    expect(source).not.toContain('We use cookies for authentication, site performance, and optional analytics.')
  })
})
