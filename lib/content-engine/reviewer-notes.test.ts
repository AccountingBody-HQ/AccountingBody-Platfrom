import { describe, expect, it } from 'vitest'
import { parseReviewerNotes } from './reviewer-notes'

const NO_JSON = 'The second opinion has no JSON.'
const BAD_SHAPE = 'The second opinion is not in the expected shape.'

function note(i: number) {
  return { where: `Question ${i}`, problem: `Invented problem ${i}.`, suggestion: `Invented suggestion ${i}.` }
}

describe('parseReviewerNotes', () => {
  it('reads an empty findings list', () => {
    expect(parseReviewerNotes('{"findings": []}')).toEqual({ ok: true, notes: [] })
  })

  it('reads three notes in order, trimmed', () => {
    const raw = JSON.stringify({ findings: [note(1), { where: '  q2 ', problem: ' P ', suggestion: ' S ' }, note(3)] })
    expect(parseReviewerNotes(raw)).toEqual({ ok: true, notes: [note(1), { where: 'q2', problem: 'P', suggestion: 'S' }, note(3)] })
  })

  it('reads fifty notes but not fifty-one', () => {
    const fifty = parseReviewerNotes(JSON.stringify({ findings: Array.from({ length: 50 }, (_, i) => note(i)) }))
    expect(fifty.ok && fifty.notes.length).toBe(50)
    expect(parseReviewerNotes(JSON.stringify({ findings: Array.from({ length: 51 }, (_, i) => note(i)) }))).toEqual({ ok: false, message: BAD_SHAPE })
  })

  it('accepts fenced JSON', () => {
    expect(parseReviewerNotes('```json\n{"findings": [' + JSON.stringify(note(1)) + ']}\n```')).toEqual({ ok: true, notes: [note(1)] })
  })

  it('refuses extra or missing keys', () => {
    expect(parseReviewerNotes(JSON.stringify({ findings: [], extra: 1 }))).toEqual({ ok: false, message: BAD_SHAPE })
    expect(parseReviewerNotes(JSON.stringify({ notes: [] }))).toEqual({ ok: false, message: BAD_SHAPE })
    expect(parseReviewerNotes(JSON.stringify({ findings: [{ ...note(1), severity: 'high' }] }))).toEqual({ ok: false, message: BAD_SHAPE })
    expect(parseReviewerNotes(JSON.stringify({ findings: [{ where: 'a', problem: 'b' }] }))).toEqual({ ok: false, message: BAD_SHAPE })
  })

  it('refuses empty and too long texts', () => {
    expect(parseReviewerNotes(JSON.stringify({ findings: [{ ...note(1), where: '   ' }] }))).toEqual({ ok: false, message: BAD_SHAPE })
    expect(parseReviewerNotes(JSON.stringify({ findings: [{ ...note(1), problem: 'x'.repeat(1201) }] }))).toEqual({ ok: false, message: BAD_SHAPE })
    const exact = parseReviewerNotes(JSON.stringify({ findings: [{ ...note(1), problem: 'x'.repeat(1200) }] }))
    expect(exact.ok).toBe(true)
    expect(parseReviewerNotes(JSON.stringify({ findings: [{ ...note(1), suggestion: 5 }] }))).toEqual({ ok: false, message: BAD_SHAPE })
  })

  it('says when there is no JSON', () => {
    expect(parseReviewerNotes('')).toEqual({ ok: false, message: NO_JSON })
    expect(parseReviewerNotes('No findings, all good.')).toEqual({ ok: false, message: NO_JSON })
  })

  it('never throws on junk', () => {
    const junk: unknown[] = [null, undefined, 1, 'x', [], {}, '[]', '[1,2]', '"text"', '{"findings": null}', '{"findings": [null]}', '{"findings": [[]]}', '{{{', '{"a":']
    for (const value of junk) {
      expect(() => parseReviewerNotes(value as string)).not.toThrow()
      expect(parseReviewerNotes(value as string).ok).toBe(false)
    }
  })
})
