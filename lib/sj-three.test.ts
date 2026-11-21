import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SJ-3 guards: on phones (under 520 px) each "Similar current roles" row is
// a column, so its text block must stretch to the row's width. Otherwise the
// block takes the width of its own text, `truncate` never shows "…" and the
// list box cuts long lines at its edge. Desktop layout stays as it was.

const ROOT = process.cwd()
const PAGE = 'app/jobs/[slug]/page.tsx'
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const sha16 = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

const ADDED = ' max-[520px]:self-stretch'
const TEXT_BLOCK = '<div className="min-w-0 flex-1 max-[520px]:self-stretch">'
const ROW_CLASS =
  'className="flex items-center justify-between gap-4 bg-white px-[18px] py-[14px] min-h-[64px] hover:bg-slate-50 transition-colors max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-[5px] max-[520px]:min-h-0"'
const SALARY_CLASS = [
  'className={`text-[14px] font-medium whitespace-nowrap shrink-0 tabular-nums min-w-[90px] text-right max-[520px]:min-w-0 max-[520px]:text-left ${',
  "                          similarSalary ? 'text-gold-700' : 'text-slate-400'",
  '                        }`}',
].join('\n')
// The page without SJ-3's one addition. Was 'ccecb3ea74edc96c' (main
// 6999779, 314 lines, before SJ-3); re-pinned by JP-1 (owner decision D55:
// the closed-job notice, no apply block or JobPosting on closed pages),
// 354 lines, 16,564 bytes with SJ-3's addition.
const BEFORE_SHA16 = '564bbf106d0030f7'

function similarBlock(src: string): string {
  const start = src.indexOf('Similar current roles')
  expect(start).toBeGreaterThan(-1)
  const end = src.indexOf('})}', start)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

describe('SJ-3: similar jobs rows on phones', () => {
  const src = read(PAGE)
  const block = similarBlock(src)

  it('G1: the row text block stretches to the row width under 520 px', () => {
    expect(block).toContain(TEXT_BLOCK)
    expect(block.split(TEXT_BLOCK).length - 1).toBe(1)
  })

  it('G2: both text lines keep truncate and the block keeps min-w-0', () => {
    const div = block.indexOf(TEXT_BLOCK)
    const close = block.indexOf('</div>', div)
    const inner = block.slice(div, close)
    const lines = inner.match(/<p className="[^"]*"/g) ?? []
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(line.split(/[\s"]/)).toContain('truncate')
    expect(TEXT_BLOCK).toContain('min-w-0 ')
  })

  it('G3: the row link and the salary line are unchanged (desktop layout as before)', () => {
    expect(block).toContain(ROW_CLASS)
    expect(block).toContain(SALARY_CLASS)
  })

  it('G4: nothing else in the page changed', () => {
    expect(src.split(ADDED).length - 1).toBe(1)
    expect(sha16(src.replace(ADDED, ''))).toBe(BEFORE_SHA16)
  })
})
