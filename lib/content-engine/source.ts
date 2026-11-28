// Reads a source note's HTML into structured text. NOTHING is cut: every word
// of the note reaches the prompt (the old Studio prompt stopped at 4,000
// characters). Headings h2/h3 start new sections, numbered s1, s2, …; text
// before the first heading is section s0 when it has words.
import { countWords } from './blocks'
import type { SourceNote, SourceSection } from './types'

const DROPPED = /<(script|style|iframe|noscript)\b[^>]*>[\s\S]*?(<\/\1\s*>|$)/gi
const COMMENTS = /<!--[\s\S]*?(-->|$)/g
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g

const BLOCK_TAGS = [
  'p', 'div', 'br', 'ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'section', 'article', 'blockquote',
  'h1', 'h4', 'h5', 'h6', 'header', 'footer', 'dl', 'dt', 'dd', 'pre', 'figure', 'figcaption', 'hr', 'aside', 'main',
  'caption', 'nav', 'form', 'fieldset', 'details', 'summary',
]

const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Decodes &amp; &lt; &gt; &quot; &#39; &nbsp; and numeric entities; leaves anything else as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.charAt(0) === '#') {
      const code = body.charAt(1) === 'x' || body.charAt(1) === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (!isFinite(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return whole
      return code === 0xa0 ? ' ' : String.fromCodePoint(code)
    }
    const named = NAMED[body.toLowerCase()]
    return named === undefined ? whole : named
  })
}

function tidy(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t\f\v ]+/g, ' ').trim())
  const out: string[] = []
  for (const line of lines) {
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(line)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

interface Draft { heading: string; parts: string[] }

/** HTML → structured text, with word counts per section and in total. */
export function sourceFromHtml(html: string, title = ''): SourceNote {
  const cleaned = html.replace(DROPPED, ' ').replace(COMMENTS, ' ')
  const drafts: Draft[] = [{ heading: title, parts: [] }]
  let current = drafts[0]
  let heading: string[] | null = null
  let cellInRow = 0
  let last = 0

  const emit = (text: string) => {
    if (heading) heading.push(text)
    else current.parts.push(text)
  }

  TAG.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TAG.exec(cleaned)) !== null) {
    emit(cleaned.slice(last, match.index))
    last = match.index + match[0].length
    const closing = match[1] === '/'
    const name = match[2].toLowerCase()
    if (name === 'h2' || name === 'h3') {
      if (!closing) heading = []
      else if (heading) {
        current = { heading: tidy(decodeEntities(heading.join(''))).replace(/\n/g, ' '), parts: [] }
        drafts.push(current)
        heading = null
      }
      continue
    }
    if (heading) {
      emit(' ')
      continue
    }
    if (name === 'li' && !closing) emit('\n- ')
    else if (name === 'tr' && !closing) { emit('\n'); cellInRow = 0 }
    else if ((name === 'td' || name === 'th') && !closing) { if (cellInRow++ > 0) emit(' | ') }
    else if (BLOCK_TAGS.indexOf(name) >= 0) emit('\n')
  }
  emit(cleaned.slice(last))
  if (heading) {
    // An unclosed heading keeps its words as the start of a section.
    current = { heading: tidy(decodeEntities(heading.join(''))).replace(/\n/g, ' '), parts: [] }
    drafts.push(current)
  }

  const sections: SourceSection[] = []
  drafts.forEach((draft, i) => {
    const text = tidy(decodeEntities(draft.parts.join('')))
    const words = countWords(text)
    if (i === 0 && words === 0) return
    sections.push({ id: `s${i}`, heading: i === 0 ? title : draft.heading, text, words })
  })
  return { title, sections, words: sections.reduce((sum, s) => sum + s.words, 0) }
}
