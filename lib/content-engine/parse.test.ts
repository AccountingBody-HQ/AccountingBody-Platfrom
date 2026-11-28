import { describe, expect, it } from 'vitest'
import { extractJson } from './parse'

// The question generator's extractJSON, copied exactly, as the parity reference.
function referenceExtractJSON(raw: string): unknown {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try { return JSON.parse(stripped) } catch { /* continue */ }
  const s = stripped.indexOf('{')
  const e = stripped.lastIndexOf('}')
  if (s >= 0 && e > s) {
    try { return JSON.parse(stripped.slice(s, e + 1)) } catch { /* continue */ }
  }
  let depth = 0
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try { return JSON.parse(stripped.slice(start, i + 1)) } catch { /* continue */ }
      }
    }
  }
  throw new Error('No valid JSON object found in response')
}

const OBJ = { title: 'A {braced} "title"', list: [1, 2], nested: { a: 'x}y' } }
const TEXT = JSON.stringify(OBJ)

const SAMPLES: [string, string][] = [
  ['plain', TEXT],
  ['fenced json', '```json\n' + TEXT + '\n```'],
  ['fenced bare', '```\n' + TEXT + '\n```'],
  ['preamble', 'Here is the JSON you asked for:\n' + TEXT],
  ['trailing text', TEXT + '\n\nLet me know if you need changes.'],
  ['preamble and trailing', 'Sure! ' + TEXT + ' Hope this helps {really}.'],
  ['nested braces in strings', '{"a": "}{", "b": {"c": "{{"}}'],
  ['two objects, first valid', 'First: {"a": 1} then {"b": 2}'],
  ['smart quotes', '{“title”: “Hello”, “count”: 2}'],
  ['trailing commas', '{"list": [1, 2, 3,], "x": {"y": 1,},}'],
]

describe('extractJson parity with the old extractJSON', () => {
  for (const [name, raw] of SAMPLES) {
    it(`${name}: same value wherever the old one succeeds`, () => {
      let reference: unknown
      let referenceOk = true
      try { reference = referenceExtractJSON(raw) } catch { referenceOk = false }
      const result = extractJson(raw)
      if (referenceOk) expect(result.value).toEqual(reference)
      expect(result.findings.filter(f => f.severity === 'error')).toEqual([])
    })
  }

  it('the old one fails on smart quotes and trailing commas; the new one reads them without changing content', () => {
    expect(() => referenceExtractJSON(SAMPLES[8][1])).toThrow()
    expect(() => referenceExtractJSON(SAMPLES[9][1])).toThrow()
    expect(extractJson(SAMPLES[8][1]).value).toEqual({ title: 'Hello', count: 2 })
    expect(extractJson(SAMPLES[9][1]).value).toEqual({ list: [1, 2, 3], x: { y: 1 } })
  })
})

describe('extractJson findings', () => {
  it('no finding for clean JSON', () => {
    expect(extractJson(TEXT)).toEqual({ value: OBJ, findings: [] })
  })

  it('one info finding listing what was tidied', () => {
    expect(extractJson('```json\n' + TEXT + '\n```').findings).toEqual([
      { check: 'parse.cleaned', severity: 'info', message: 'The answer was tidied before reading: removed the code fences. No content was changed.' },
    ])
    expect(extractJson('Intro ' + TEXT).findings[0].message).toContain('removed text before or after the JSON')
    const both = extractJson('```json\nIntro {“a”: [1,],}\n```')
    expect(both.value).toEqual({ a: [1] })
    expect(both.findings[0].message).toBe('The answer was tidied before reading: removed the code fences; removed text before or after the JSON; read smart quotes as JSON quotes; ignored trailing commas. No content was changed.')
  })

  it('keeps smart quotes and commas that are content inside ordinary strings', () => {
    const raw = '{"quote": "She said “yes, ” then left,", "n": 1,}'
    expect(extractJson(raw).value).toEqual({ quote: 'She said “yes, ” then left,', n: 1 })
  })

  it('an error finding when nothing can be read', () => {
    for (const raw of ['', '   ', 'no json here', '{ broken', '[1, 2]']) {
      const result = extractJson(raw)
      if (raw === '[1, 2]') {
        expect(result.value).toEqual([1, 2])
        continue
      }
      expect(result.value).toBeNull()
      expect(result.findings).toHaveLength(1)
      expect(result.findings[0].check).toBe('parse.json')
      expect(result.findings[0].severity).toBe('error')
    }
  })
})
