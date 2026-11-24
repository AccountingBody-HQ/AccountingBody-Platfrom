import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { brandExamBodies } from '@/lib/brand'

// VF-3 (owner decision D318): ETICPA exam-body labels show on EthioTax only. Display only.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const ETICPA_SPELLINGS = ['eticpa-atq', 'ETICPA-ATQ', 'ETICPA / ATQ', 'eticpa']
const OTHERS = ['ACCA', 'CIMA', 'ICAEW', 'AAT']

describe('H1 brandExamBodies', () => {
  it.each(ETICPA_SPELLINGS)('Accounting Body leaves out %s wherever it stands', (spelling) => {
    expect(brandExamBodies([spelling], false)).toEqual([])
    expect(brandExamBodies([spelling, ...OTHERS], false)).toEqual(OTHERS)
    expect(brandExamBodies(['ACCA', spelling, 'CIMA', 'ICAEW', 'AAT'], false)).toEqual(OTHERS)
    expect(brandExamBodies([...OTHERS, spelling], false)).toEqual(OTHERS)
  })
  it('Accounting Body keeps the other bodies as stored, in order', () => {
    expect(brandExamBodies(OTHERS, false)).toEqual(OTHERS)
    expect(brandExamBodies(['aat', 'icaew', 'cima', 'acca'], false)).toEqual(['aat', 'icaew', 'cima', 'acca'])
  })
  it('EthioTax keeps everything, in order', () => {
    const all = ['ACCA', ...ETICPA_SPELLINGS, 'CIMA', 'ICAEW', 'AAT']
    expect(brandExamBodies(all, true)).toEqual(all)
  })
  it.each([[null], [undefined], ['eticpa-atq'], ['acca'], [0], [{ 0: 'acca', length: 1 }]])('anything not a list gives no labels: %o', (value) => {
    expect(brandExamBodies(value, false)).toEqual([])
    expect(brandExamBodies(value, true)).toEqual([])
  })
  it('keeps only non-empty strings', () => {
    expect(brandExamBodies(['', null, 'acca', 7, undefined, 'eticpa'], false)).toEqual(['acca'])
    expect(brandExamBodies(['', null, 'acca', 7, undefined, 'eticpa'], true)).toEqual(['acca', 'eticpa'])
  })
  it('never changes the stored list', () => {
    const stored = ['eticpa-atq', 'acca']
    brandExamBodies(stored, false)
    expect(stored).toEqual(['eticpa-atq', 'acca'])
  })
})

describe('H2 both article pages show the brand list only', () => {
  it.each([
    ['app/study/[category]/[slug]/page.tsx', "EXAM_BODY_ACCENT[examBodies[0]?.toUpperCase() ?? '']"],
    // B2 (F6): the same look-up as the study page.
    ['app/articles/[slug]/page.tsx', "EXAM_BODY_ACCENT[examBodies[0]?.toUpperCase() ?? '']"],
  ])('%s', (file, accent) => {
    const src = read(file)
    // the stored value is read once, by the helper
    expect(src.match(/article\.exam_body/g)).toHaveLength(1)
    expect(src).toContain('const examBodies = brandExamBodies(article.exam_body, isEthioTax)')
    // accent bar, hero badges, side-panel Qualification row
    expect(src).toContain(accent)
    expect(src.match(/\{examBodies\.map\(/g)).toHaveLength(2)
    expect(src).toMatch(/\{examBodies\.length > 0 && \(\s*<div [^>]*>\s*<dt [^>]*>Qualification<\/dt>/)
  })
})
