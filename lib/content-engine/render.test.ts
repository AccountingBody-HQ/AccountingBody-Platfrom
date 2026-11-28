import { describe, expect, it } from 'vitest'
import { ONE_OF_EACH } from './fixtures/blocks'
import { RENDER_LABELS, RENDER_TAGS, escapeHtml, formatAmount, inline, renderBlocks } from './render'
import { BLOCK_TYPES, type Block } from './types'

const ALLOWED_CLASSES = new Set<string>([...BLOCK_TYPES.map(t => `ce-${t}`), 'ce-label'])

/** A small tag scanner: every tag and attribute in the output must be on the whitelist. */
function scan(html: string): string[] {
  const problems: string[] = []
  const tagPattern = /<\/?([a-zA-Z0-9]+)([^>]*)>/g
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    const [, name, attrs] = match
    if (RENDER_TAGS.indexOf(name) < 0) problems.push(`tag:${name}`)
    const attrPattern = /\s*([a-zA-Z-]+)="([^"]*)"/g
    let rest = attrs
    let attr: RegExpExecArray | null
    while ((attr = attrPattern.exec(attrs)) !== null) {
      const [whole, key, value] = attr
      rest = rest.replace(whole, '')
      if (key === 'class') { if (!ALLOWED_CLASSES.has(value)) problems.push(`class:${value}`) }
      else if (key === 'scope') { if (name !== 'th' || value !== 'col') problems.push(`scope:${name}`) }
      else problems.push(`attr:${key}`)
    }
    if (rest.trim() !== '') problems.push(`attr-text:${rest.trim()}`)
  }
  // Nothing that looks like a tag may survive outside the scanner's view.
  const stripped = html.replace(tagPattern, '')
  if (/[<>]/.test(stripped)) problems.push('stray-angle-bracket')
  return problems
}

const HOSTILE = [
  '<script>alert(1)</script>',
  '"onerror="alert(1)',
  "' onmouseover='x",
  'javascript:alert(1)',
  '<img src=x onerror=alert(1)>',
  '&lt;script&gt; & <b>',
]

describe('escapeHtml and inline marks', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })

  it('turns **x** into strong and *x* into em, after escaping, never across lines', () => {
    expect(inline('a **b** c *d* <e>')).toBe('a <strong>b</strong> c <em>d</em> &lt;e&gt;')
    expect(inline('**not\nbold**')).toBe('**not\nbold**')
    expect(inline('**<script>**')).toBe('<strong>&lt;script&gt;</strong>')
  })
})

describe('formatAmount', () => {
  it('uses two decimals and thousands separators', () => {
    expect(formatAmount(1057)).toBe('1,057.00')
    expect(formatAmount(1234567.5)).toBe('1,234,567.50')
    expect(formatAmount(0.1)).toBe('0.10')
    expect(formatAmount(-42.857)).toBe('-42.86')
  })
})

describe('renderBlocks', () => {
  it('renders every block type with whitelisted tags and attributes only', () => {
    const html = renderBlocks(ONE_OF_EACH)
    expect(scan(html)).toEqual([])
    for (const type of BLOCK_TYPES) {
      if (type !== 'heading') expect(html, type).toContain(`class="ce-${type}"`)
    }
    expect(html).toContain('<h2 class="ce-heading">')
  })

  it('escapes hostile text in every text field of every block type', () => {
    for (const bad of HOSTILE) {
      const blocks: Block[] = [
        { type: 'heading', level: 3, text: bad },
        { type: 'paragraph', text: bad },
        { type: 'definition', term: bad, text: bad },
        { type: 'worked_example', title: bad, scenario: bad, steps: [bad], answer: bad },
        { type: 'calculation', title: bad, steps: [{ label: bad, working: bad, result: bad }] },
        { type: 'journal_entry', title: bad, narrative: bad, lines: [{ account: bad, debit: 1, credit: null }, { account: bad, debit: null, credit: 1 }] },
        { type: 'table', caption: bad, columns: [bad, bad], rows: [[bad, bad]] },
        { type: 'key_point', text: bad },
        { type: 'common_mistake', mistake: bad, correction: bad },
        { type: 'exam_tip', text: bad },
        { type: 'check_understanding', question: bad, answer: bad },
        { type: 'takeaway', points: [bad, bad] },
        { type: 'list', style: 'number', items: [bad, bad] },
      ]
      const html = renderBlocks(blocks)
      expect(scan(html), bad).toEqual([])
      expect(html).not.toContain('<script')
      expect(html).not.toContain('<img')
      expect(html).not.toMatch(/\son[a-z]+="/i)
    }
  })

  it('uses the fixed English labels', () => {
    const html = renderBlocks(ONE_OF_EACH)
    for (const text of Object.values(RENDER_LABELS)) {
      if (text === 'Answer' || text === 'Definition' || text === 'Key takeaways') continue
      expect(html).toContain(`<p class="ce-label">${text}</p>`)
    }
    expect(html).toContain('<p class="ce-label">Answer</p>')
    expect(html).toContain('<p class="ce-label">Definition</p>')
    expect(html).toContain('<p class="ce-label">Key takeaways</p>')
  })

  it('renders a journal entry as an Account / Debit / Credit table with the empty side blank', () => {
    const html = renderBlocks([ONE_OF_EACH[5]])
    expect(html).toBe(
      '<div class="ce-journal_entry"><table><caption>Year-end accrual</caption><thead><tr><th scope="col">Account</th><th scope="col">Debit</th><th scope="col">Credit</th></tr></thead>' +
      '<tbody><tr><td>Rent expense</td><td>1,057.00</td><td></td></tr><tr><td>Accruals</td><td></td><td>1,057.00</td></tr></tbody></table><p>Being rent for March.</p></div>',
    )
  })

  it('matches the pinned golden HTML for the one-of-each fixture', () => {
    expect(renderBlocks(ONE_OF_EACH)).toBe([
      '<h2 class="ce-heading">Accruals in practice</h2>',
      '<p class="ce-paragraph">An accrual records an expense in the period it is <strong>incurred</strong>.</p>',
      '<div class="ce-definition"><p class="ce-label">Definition</p><dl><dt>Accrual</dt><dd>An expense incurred but not yet paid.</dd></dl></div>',
      '<div class="ce-worked_example"><p class="ce-label">Worked example</p><p><strong>Brightwater Mills</strong></p><p>An invoice of £3,417 arrives after year end.</p><ol><li>Find the period.</li><li>Record the expense.</li></ol><p class="ce-label">Answer</p><p>Accrue £3,417.</p></div>',
      '<div class="ce-calculation"><p class="ce-label">Calculation</p><table><caption>Accrued rent</caption><thead><tr><th scope="col">Step</th><th scope="col">Working</th><th scope="col">Result</th></tr></thead><tbody><tr><td>Monthly rent</td><td>£12,684 / 12</td><td>£1,057</td></tr></tbody></table></div>',
      '<div class="ce-journal_entry"><table><caption>Year-end accrual</caption><thead><tr><th scope="col">Account</th><th scope="col">Debit</th><th scope="col">Credit</th></tr></thead><tbody><tr><td>Rent expense</td><td>1,057.00</td><td></td></tr><tr><td>Accruals</td><td></td><td>1,057.00</td></tr></tbody></table><p>Being rent for March.</p></div>',
      '<table class="ce-table"><caption>Balances</caption><thead><tr><th scope="col">Account</th><th scope="col">Amount</th></tr></thead><tbody><tr><td>Accruals</td><td>£1,057</td></tr></tbody></table>',
      '<aside class="ce-key_point"><p class="ce-label">Key point</p><p>Match the cost to the period.</p></aside>',
      '<aside class="ce-common_mistake"><p class="ce-label">Common mistake</p><p>Recording the cost when paid.</p><p>Record it when incurred.</p></aside>',
      '<aside class="ce-exam_tip"><p class="ce-label">Exam tip</p><p>Read the dates first.</p></aside>',
      '<div class="ce-check_understanding"><p class="ce-label">Check your understanding</p><p>When is rent for March recorded?</p><p class="ce-label">Answer</p><p>In March.</p></div>',
      '<aside class="ce-takeaway"><p class="ce-label">Key takeaways</p><ul><li>Accrue what you owe.</li><li>Reverse it next period.</li></ul></aside>',
      '<ul class="ce-list"><li>Invoices</li><li>Contracts</li></ul>',
    ].join('\n'))
  })

  it('stays safe without validation', () => {
    const badLevel = { type: 'heading', level: '2 onclick=alert(1)', text: 'x' } as unknown as Block
    expect(renderBlocks([badLevel])).toBe('<h2 class="ce-heading">x</h2>')
    expect(renderBlocks([{ type: 'heading', level: 3, text: 'x' }])).toBe('<h3 class="ce-heading">x</h3>')
    const badAmounts = {
      type: 'journal_entry',
      title: 'J',
      lines: [
        { account: 'A', debit: NaN, credit: null },
        { account: 'B', debit: '1', credit: null },
      ],
    } as unknown as Block
    const html = renderBlocks([badAmounts])
    expect(html).toContain('<tr><td>A</td><td></td><td></td></tr>')
    expect(html).toContain('<tr><td>B</td><td></td><td></td></tr>')
    expect(html).not.toContain('NaN')
    expect(renderBlocks([{ type: 'video', url: 'javascript:alert(1)' } as unknown as Block])).toBe('')
    expect(scan(html)).toEqual([])
  })

  it('is deterministic', () => {
    expect(renderBlocks(ONE_OF_EACH)).toBe(renderBlocks(JSON.parse(JSON.stringify(ONE_OF_EACH))))
  })
})
