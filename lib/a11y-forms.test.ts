import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Accessible forms guards (A11-F5). WCAG 2.2: 1.3.1 info and relationships, 3.3.1 error identification,
// 3.3.2 labels or instructions, 4.1.2 name, role, value, 4.1.3 status messages.
// Every public form file below ties each visible field to its visible label, ties each field error to its field,
// and makes step or submit messages announced. Hidden honeypot inputs are skipped.
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const GET_HELP_COPIES = [
  'app/get-help/payroll-services/page.tsx',
  'app/get-help/accounting-bookkeeping/page.tsx',
  'app/get-help/audit-assurance/page.tsx',
  'app/get-help/business-consulting/page.tsx',
  'app/get-help/financial-planning-advisory/page.tsx',
  'app/get-help/tax-filing-compliance/page.tsx',
  'app/get-help/company-formation/_client.tsx',
]
const FORM_FILES = [
  ...GET_HELP_COPIES,
  'app/get-help/_service-page-client.tsx',
  'app/global-payroll/[slug]/page.tsx',
  'app/jobs/post-a-job/PostAJobClient.tsx',
  'app/jobs/find-work/FindWorkClient.tsx',
  'app/jobs/hire-talent/HireTalentClient.tsx',
  'app/firms-freelancers/join/page.tsx',
  'app/freelancing-pathways/FreelancingPathwaysClient.tsx',
  'app/jobs/find-work/manage/FindWorkManageClient.tsx',
  'app/jobs/hire-talent/manage/HireTalentManageClient.tsx',
  'components/CalcCard.tsx',
  'app/contact/ContactForm.tsx',
]
// Forms whose field errors are shown per field (JS validation).
const FIELD_ERROR_FILES = [
  'app/jobs/post-a-job/PostAJobClient.tsx',
  'app/jobs/find-work/FindWorkClient.tsx',
  'app/jobs/hire-talent/HireTalentClient.tsx',
  'app/firms-freelancers/join/page.tsx',
  'app/freelancing-pathways/FreelancingPathwaysClient.tsx',
]

/** Opening tags of `name` with their start index, honouring braces and quotes inside the tag. */
function tags(src: string, name: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = []
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let j = m.index + name.length + 1
    let depth = 0
    let q = ''
    for (; j < src.length; j++) {
      const c = src[j]
      if (q) {
        if (c === q && src[j - 1] !== '\\') q = ''
      } else if (c === '"' || c === "'" || c === '`') q = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    out.push({ at: m.index, text: src.slice(m.index, j + 1) })
  }
  return out
}
const line = (src: string, at: number) => src.slice(0, at).split('\n').length

/** True when position `at` sits inside an open <label>…</label>. */
function insideLabel(src: string, at: number): boolean {
  const before = src.slice(0, at)
  return before.lastIndexOf('<label') > before.lastIndexOf('</label>')
}

const isHoneypot = (t: string) => /display:\s*'none'/.test(t) && /aria-hidden="true"/.test(t)

describe('accessible forms (A11-F5)', () => {
  it('every <label> names a control: htmlFor, or it wraps the control', () => {
    const bad: string[] = []
    for (const f of FORM_FILES) {
      const src = read(f)
      for (const t of tags(src, 'label')) {
        if (/\bhtmlFor=/.test(t.text)) continue
        const end = src.indexOf('</label>', t.at)
        const inner = src.slice(t.at + t.text.length, end)
        if (/<(input|select|textarea|button)[\s>]/.test(inner)) continue
        bad.push(`${f}:${line(src, t.at)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('every visible field has a programmatic name (id tied to a label, aria-label(ledby), or a wrapping label)', () => {
    const bad: string[] = []
    for (const f of FORM_FILES) {
      const src = read(f)
      const forIds = new Set(Array.from(src.matchAll(/htmlFor=\{?["'`]?([^"'`}\s]+)/g)).map((m) => m[1]))
      for (const name of ['input', 'select', 'textarea']) {
        for (const t of tags(src, name)) {
          if (/type="hidden"/.test(t.text) || isHoneypot(t.text)) continue
          if (/\baria-label(ledby)?=/.test(t.text) || insideLabel(src, t.at)) continue
          const id = t.text.match(/\bid=\{?["'`]?([^"'`}\s]+)/)
          if (id && forIds.has(id[1])) continue
          bad.push(`${f}:${line(src, t.at)}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('every field error has an id and the form wires aria-invalid/aria-describedby to it', () => {
    const bad: string[] = []
    for (const f of FIELD_ERROR_FILES) {
      const src = read(f)
      for (const m of Array.from(src.matchAll(/(?:fieldErrors\.\w+|stepError)\s*&&\s*\(?\s*<p\b/g))) {
        const t = tags(src.slice(m.index! + m[0].length - 2), 'p')[0]
        if (!t || !/\bid=/.test(t.text)) bad.push(`${f}:${line(src, m.index!)} error without id`)
      }
      if (!/invalidProps\(/.test(src)) bad.push(`${f}: fields not wired with invalidProps`)
      if (!/useFocusFirstInvalid(<[^>]*>)?\(/.test(src)) bad.push(`${f}: no focus move to the first invalid field`)
    }
    expect(bad).toEqual([])
  })

  it('step and submit messages are announced (role="alert")', () => {
    const bad: string[] = []
    for (const f of FORM_FILES) {
      const src = read(f)
      for (const t of tags(src, 'p').concat(tags(src, 'div'))) {
        if (!/className="[^"]*(?:text-red-\d00|bg-red-50)/.test(t.text)) continue
        if (/role="alert"|aria-live=/.test(t.text)) continue
        // inside an alert container opened just before (no </div> in between)
        const before = src.slice(Math.max(0, t.at - 600), t.at)
        const opened = before.lastIndexOf('role="alert"')
        if (opened >= 0 && before.indexOf('</div>', opened) < 0) continue
        bad.push(`${f}:${line(src, t.at)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the visual required star is hidden from the accessible name', () => {
    const bad: string[] = []
    for (const f of FORM_FILES) {
      const src = read(f)
      for (const t of tags(src, 'label')) {
        const end = src.indexOf('</label>', t.at)
        const inner = src.slice(t.at + t.text.length, end).replace(/<span[^>]*aria-hidden="true"[^>]*>\s*\*\s*<\/span>/g, '')
        if (/\*/.test(inner.replace(/\{[^}]*\}/g, (s) => (/'[^']*\*'/.test(s) ? '*' : '')))) bad.push(`${f}:${line(src, t.at)}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('a success state that replaces a form receives focus', () => {
    const files = [...GET_HELP_COPIES, 'app/get-help/_service-page-client.tsx', 'app/global-payroll/[slug]/page.tsx', 'app/contact/ContactForm.tsx',
      'app/jobs/find-work/FindWorkClient.tsx', 'app/jobs/hire-talent/HireTalentClient.tsx', 'app/firms-freelancers/join/page.tsx',
      'app/freelancing-pathways/FreelancingPathwaysClient.tsx']
    const bad = files.filter((f) => !/useFocusOnShow(<[^>]*>)?\(/.test(read(f)) || !/tabIndex=\{-1\}/.test(read(f)))
    expect(bad).toEqual([])
  })

  it('job listings: every button has a name (text, aria-label or aria-labelledby)', () => {
    const f = 'app/jobs/listings/JobListingsClient.tsx'
    const src = read(f)
    const bad: string[] = []
    for (const t of tags(src, 'button')) {
      if (/\baria-label(ledby)?=/.test(t.text)) continue
      const end = src.indexOf('</button>', t.at)
      const inner = src.slice(t.at + t.text.length, end)
      const text = inner.replace(/<[^>]*>/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim()
      if (!text) bad.push(`${f}:${line(src, t.at)}`)
    }
    expect(bad).toEqual([])
  })

  it('job listings: filter groups are named groups', () => {
    const src = read('app/jobs/listings/JobListingsClient.tsx')
    const fs = src.slice(src.indexOf('function FilterSection'), src.indexOf('function FiltersPanel'))
    expect(fs).toMatch(/role="group"/)
    expect(fs).toMatch(/aria-labelledby=\{/)
    expect(fs).toMatch(/useId\(\)/)
  })
})
