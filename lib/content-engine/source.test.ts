import { describe, expect, it } from 'vitest'
import { decodeEntities, sourceFromHtml } from './source'

describe('decodeEntities', () => {
  it('decodes the common named and numeric entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; f&nbsp;g &#163; &#x20AC;')).toBe('a & b <c> "d" \'e\' f g £ €')
  })

  it('leaves unknown or impossible entities as written', () => {
    expect(decodeEntities('&copy; &#xD800; &#99999999;')).toBe('&copy; &#xD800; &#99999999;')
  })
})

describe('sourceFromHtml', () => {
  it('splits sections at h2 and h3, numbered in order, with s0 for the text before the first heading', () => {
    const note = sourceFromHtml('<p>Opening words here.</p><h2>First part</h2><p>One two three.</p><h3>Detail</h3><p>Four five.</p>', 'Invented note')
    expect(note.title).toBe('Invented note')
    expect(note.sections.map(s => [s.id, s.heading, s.text, s.words])).toEqual([
      ['s0', 'Invented note', 'Opening words here.', 3],
      ['s1', 'First part', 'One two three.', 3],
      ['s2', 'Detail', 'Four five.', 2],
    ])
    expect(note.words).toBe(8)
  })

  it('has no s0 when there is no text before the first heading', () => {
    const note = sourceFromHtml('  <h2>Only</h2><p>Body.</p>', 'T')
    expect(note.sections.map(s => s.id)).toEqual(['s1'])
  })

  it('turns list items into lines starting "- " and table rows into cells joined by " | "', () => {
    const note = sourceFromHtml('<h2>L</h2><ul><li>Alpha</li><li>Beta <em>two</em></li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>', 'T')
    expect(note.sections[0].text).toBe('- Alpha\n- Beta two\n\nA | B\n1 | 2')
  })

  it('drops script, style, iframe and noscript content entirely', () => {
    const note = sourceFromHtml('<h2>S</h2><p>Keep.</p><script>var secret = 1</script><style>p{}</style><iframe>frame words</iframe><noscript>hidden words</noscript><!-- a comment -->', 'T')
    expect(note.sections[0].text).toBe('Keep.')
  })

  it('decodes entities in text and headings', () => {
    const note = sourceFromHtml('<h2>Profit &amp; loss</h2><p>Cost &lt; price</p>', 'T')
    expect(note.sections[0].heading).toBe('Profit & loss')
    expect(note.sections[0].text).toBe('Cost < price')
  })

  it('collapses runs of blank lines and spaces, and trims', () => {
    const note = sourceFromHtml('<h2>W</h2><p>  a   b  </p><p></p><p></p><div></div><p>c</p>', 'T')
    expect(note.sections[0].text).toBe('a b\n\nc')
  })

  it('cuts nothing: a 30,000-character note keeps every word (the old 4,000-character cut is gone)', () => {
    const words: string[] = []
    for (let i = 0; i < 4000; i++) words.push(`word${i}`)
    const html = '<h2>Long</h2>' + words.map((w, i) => (i % 50 === 0 ? `<p>${w}` : i % 50 === 49 ? ` ${w}</p>` : ` ${w}`)).join('')
    expect(html.length).toBeGreaterThan(30000)
    const note = sourceFromHtml(html, 'T')
    expect(note.words).toBe(4000)
    const text = note.sections.map(s => s.text).join(' ')
    expect(text).toContain('word0')
    expect(text).toContain('word3999')
    for (const w of words) expect(text.indexOf(w)).toBeGreaterThanOrEqual(0)
  })

  it('is deterministic and never throws on odd HTML', () => {
    const odd = ['', '<', '<h2>unclosed', '<p>a<p>b', '</h2>stray', '<script>never closed', '<td>x</td><td>y</td>']
    for (const html of odd) {
      expect(() => sourceFromHtml(html, 'T')).not.toThrow()
      expect(sourceFromHtml(html, 'T')).toEqual(sourceFromHtml(html, 'T'))
    }
    expect(sourceFromHtml('', 'T')).toEqual({ title: 'T', sections: [], words: 0 })
  })
})
