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
})
