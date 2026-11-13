import { describe, expect, it } from 'vitest'
import { escapeHtml, withoutLineBreaks } from './html-escape'

describe('visitor text in email HTML', () => {
  it('shows each of the five HTML characters as plain text', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml("'")).toBe('&#39;')
    expect(escapeHtml(`<b class="x">Tom & Jerry's</b>`)).toBe(
      '&lt;b class=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;',
    )
  })

  it('leaves plain text exactly as it is', () => {
    for (const text of ['Ada Lovelace', 'ada@example.com', 'Line one\nLine two', 'Café — £20/hour', '', '  spaced  ']) {
      expect(escapeHtml(text)).toBe(text)
    }
  })

  it('escapes text that already looks escaped once more, so it shows as typed', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
    expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;')
  })

  it('turns other values into text the same way a template literal does', () => {
    for (const value of [42, 0, null, undefined, true, ['a', 'b'], { a: 1 }]) {
      expect(escapeHtml(value)).toBe(`${value}`)
    }
    expect(escapeHtml(['<a>', 'b&c'])).toBe('&lt;a&gt;,b&amp;c')
  })

  it('never throws for a value that cannot be turned into text', () => {
    const awkward = { toString: () => { throw new Error('no') } }
    expect(escapeHtml(awkward)).toBe('')
    expect(escapeHtml(Object.create(null))).toBe('')
    expect(withoutLineBreaks(awkward)).toBe('')
  })
})

describe('visitor text in email subject lines', () => {
  it('keeps the subject on one line', () => {
    expect(withoutLineBreaks('Hello\r\nBcc: someone')).toBe('HelloBcc: someone')
    expect(withoutLineBreaks('a\nb\rc')).toBe('abc')
  })

  it('changes nothing else', () => {
    for (const text of ['General Enquiry', 'Tom & Jerry <Ltd>', "O'Brien \"Q\"", '\tTabbed']) {
      expect(withoutLineBreaks(text)).toBe(text)
    }
    expect(withoutLineBreaks(undefined)).toBe('undefined')
  })
})
