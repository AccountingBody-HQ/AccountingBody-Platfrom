/**
 * Book-export filter: web-only sections ("Further Reading", "Key Takeaways",
 * ...) are removed whether they start with a heading or with a bold-only
 * paragraph such as `<p><strong>Further Reading:</strong></p>`.
 */
import { describe, it, expect } from 'vitest'
import { filterForPublication, getPublicationWarnings } from './publication-filter'

function sectionWarnings(html: string): string[] {
  return getPublicationWarnings(html, filterForPublication(html)).filter((w) => / section \(approx /.test(w))
}

const BODY = '<p>Depreciation spreads cost over useful life.</p>'
const LIST = '<ul><li>Item one</li><li>Item two</li></ul>'

describe('bold-paragraph web-only sections', () => {
  it('removes the exact form up to the next bold-only paragraph', () => {
    const html = BODY + '<p><strong>Further Reading:</strong></p>' + LIST + '<p><strong>Worked example</strong></p><p>Keep me.</p>'
    expect(filterForPublication(html)).toBe(BODY + '<p><strong>Worked example</strong></p><p>Keep me.</p>')
    expect(sectionWarnings(html)).toEqual([
      `Removed 'Further Reading' section (approx ${('<p><strong>Further Reading:</strong></p>' + LIST).length} chars)`,
    ])
  })

  it('removes the variant form with attributes and a colon after the closing tag', () => {
    const html = BODY + '<p class="x"><strong>Further Reading</strong>:</p>' + LIST
    expect(filterForPublication(html)).toBe(BODY)
  })

  it('removes the variant form with spaces and <b>', () => {
    const html = BODY + '<p style="a"> <b> further reading : </b> </p>' + LIST
    expect(filterForPublication(html)).toBe(BODY)
  })

  it('still removes the h2 form exactly as before', () => {
    const html = BODY + '<h2>Further Reading</h2>' + LIST + '<h2>Worked Example</h2><p>Keep.</p>'
    expect(filterForPublication(html)).toBe(BODY + '<h2>Worked Example</h2><p>Keep.</p>')
    expect(sectionWarnings(html)).toHaveLength(1)
  })

  it('keeps a bold paragraph whose text is not a section name', () => {
    const html = BODY + '<p><strong>Example:</strong></p><p>A business buys machinery.</p>'
    expect(filterForPublication(html)).toBe(html)
    expect(sectionWarnings(html)).toEqual([])
  })

  it('keeps a paragraph that has bold text plus other text', () => {
    const html = BODY + '<p><strong>Further Reading:</strong> see chapter 4.</p><p>Keep.</p>'
    expect(filterForPublication(html)).toBe(html)
  })

  it('removes two web-only bold sections back to back', () => {
    const html = BODY + '<p><strong>Key Takeaways:</strong></p>' + LIST + '<p><strong>Further Reading:</strong></p>' + LIST
    expect(filterForPublication(html)).toBe(BODY)
    expect(sectionWarnings(html)).toHaveLength(2)
  })

  it('stops a bold section at the next <h2>', () => {
    const html = BODY + '<p><strong>See Also:</strong></p>' + LIST + '<h2>Worked Example</h2><p>Keep.</p>'
    expect(filterForPublication(html)).toBe(BODY + '<h2>Worked Example</h2><p>Keep.</p>')
  })

  it('removes a bold Further Reading at the end of content to the end', () => {
    const html = BODY + '<h2>Method</h2><p>Text.</p><p><strong>Further Reading</strong></p><p>One.</p><p>Two.</p>'
    expect(filterForPublication(html)).toBe(BODY + '<h2>Method</h2><p>Text.</p>')
  })

  it('keeps a bold Next Steps mid-article and removes the last one', () => {
    const mid = '<p><strong>Next Steps:</strong></p><p>Post the journal.</p>'
    const html = BODY + mid + '<h2>Summary</h2><p>Done.</p><p><strong>Next Steps</strong></p><p>Read more.</p>'
    expect(filterForPublication(html)).toBe(BODY + mid + '<h2>Summary</h2><p>Done.</p>')
    expect(sectionWarnings(html)).toEqual([expect.stringContaining("Removed 'Next Steps' section")])
  })

  it('keeps a bold Next Steps followed only by another bold-only paragraph', () => {
    const html = BODY + '<p><strong>Next Steps</strong></p><p>Do this.</p><p><strong>Note</strong></p><p>Keep.</p>'
    expect(filterForPublication(html)).toBe(html)
  })

  it('removes a bold Key Takeaways section', () => {
    const html = BODY + '<p><strong>Key Takeaway:</strong></p>' + LIST
    expect(filterForPublication(html)).toBe(BODY)
    expect(sectionWarnings(html)).toEqual([expect.stringContaining("Removed 'Key Takeaways' section")])
  })

  it('removes a bold section nested inside an h2 Further Reading section once', () => {
    const html = BODY + '<h2>Further Reading</h2>' + LIST + '<p><strong>Related Articles:</strong></p>' + LIST
    expect(filterForPublication(html)).toBe(BODY)
    expect(sectionWarnings(html)).toHaveLength(1)
    expect(sectionWarnings(html)[0]).toContain("'Further Reading'")
  })
})
