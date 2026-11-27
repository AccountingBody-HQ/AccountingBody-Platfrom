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

  // PQB-3b S6 (D352): section 5 names the practice progress kept on the device.
  it('the privacy policy section 5 text is exact; the old text is gone', () => {
    const source = readFileSync('app/privacy-policy/page.tsx', 'utf8')
    const body = "      id: 'cookies', title: '5. Cookies',\n      body: 'We use cookies and similar storage on your device for authentication, site performance and optional analytics, and to keep your practice progress on your device (it is not sent to us). See our full Cookie Policy for details.',\n"
    expect(source.split(body).length - 1).toBe(1)
    expect(source).not.toContain('We use cookies for authentication, site performance, and optional analytics.')
  })
})
