import { describe, expect, it } from 'vitest'
import { PACKS, PACKS_FINGERPRINT } from './index'

function texts(value: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof value === 'string') out.push([path, value])
  else if (Array.isArray(value)) value.forEach((item, i) => texts(item, `${path}[${i}]`, out))
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) texts(item, `${path}.${key}`, out)
  }
  return out
}

describe('packs', () => {
  it('every pack text is non-empty', () => {
    const all = texts(PACKS, 'PACKS', [])
    expect(all.length).toBeGreaterThan(50)
    for (const [, text] of all) expect(text.trim().length).toBeGreaterThan(0)
  })

  it('the fingerprint is pinned: any change to a pack or blueprint text must change this line on purpose', () => {
    expect(PACKS_FINGERPRINT).toMatch(/^[0-9a-f]{16}$/)
    expect(PACKS_FINGERPRINT).toBe('9245d961a5bed684')
  })
})
