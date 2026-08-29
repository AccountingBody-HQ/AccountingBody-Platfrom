/**
 * publication-filter.ts
 *
 * Article HTML fetched from Supabase was written for the web: it carries
 * navigation anchors, "Key Takeaways" / "Further Reading" / "Related
 * Articles" blocks, site CTAs, MCQ links, breadcrumbs and WordPress
 * metadata lines. None of that belongs in a printed KDP book. This module
 * strips those web-only elements before the HTML reaches htmlToBlocks().
 *
 * Same architecture as lib/article-normaliser.ts (Rule 61): zero runtime
 * dependencies beyond the standard library, safe to import from Node.js
 * API routes or an edge runtime. The HTML here is simple, WordPress-origin
 * markup (headings, paragraphs, lists, anchors, inline formatting) so a
 * regex-based scanner — not a full DOM parser — is used throughout, in
 * keeping with the rest of this codebase's HTML handling
 * (lib/html-to-blocks.ts, lib/article-normaliser.ts).
 */

// ── Text helpers ─────────────────────────────────────────────────────────────

/** Strip all tags and decode the small set of entities WordPress content uses. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalise a heading's inner text for pattern matching: trims trailing jump-icon glyphs some themes append. */
function normaliseHeadingText(text: string): string {
  return text.replace(/[↑↓⇧⇩»›#^]+$/g, '').trim()
}

/**
 * Scan forward from `searchStart` (just after an opening `<tagName>`) to find
 * the index right after the matching closing tag, accounting for nested
 * elements of the same tag name. Returns -1 if unbalanced.
 */
function findMatchingClose(html: string, tagName: string, searchStart: number): number {
  const openRe = new RegExp('<' + tagName + '(?:\\s[^>]*)?>', 'gi')
  const closeRe = new RegExp('<\\/' + tagName + '\\s*>', 'gi')
  let depth = 1
  let pos = searchStart
  while (depth > 0) {
    openRe.lastIndex = pos
    closeRe.lastIndex = pos
    const closeMatch = closeRe.exec(html)
    if (!closeMatch) return -1
    const openMatch = openRe.exec(html)
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++
      pos = openMatch.index + openMatch[0].length
    } else {
      depth--
      pos = closeMatch.index + closeMatch[0].length
    }
  }
  return pos
}

// ── Pattern tables ───────────────────────────────────────────────────────────

const JUMP_LINK_TEXT_RE = /jump to|back to top|skip to|go to|return to|scroll to/i
const QUIZ_LINK_TEXT_RE = /take the quiz|practice questions|test yourself|mcq|quiz/i
const CTA_RE = /sign up|subscribe|create.*account|register.*free|start.*free trial|join.*today|get.*started/i
const SHARE_BLOCK_RE = /^(share (this article|on)\b|tweet this\b|pin it\b|was this helpful\??)/i
const METADATA_LINE_RE = /^(filed under|tagged|category|last updated|published)\s*:/i
const INTERNAL_HOST_RE = /^https?:\/\/(?:www\.)?(accountingbody\.com|ethiotax\.com)(?:[/?#]|$)/i

const REMOVABLE_CLASS_SUBSTRINGS = [
  'breadcrumb', 'navigation', 'nav-', 'sidebar', 'widget',
  'footer-link', 'related-', 'share-',
]

interface SectionPattern { re: RegExp; label: string; onlyIfLast?: boolean }

const SECTION_PATTERNS: SectionPattern[] = [
  { re: /^key takeaways?$/i, label: 'Key Takeaways' },
  { re: /^further reading$/i, label: 'Further Reading' },
  { re: /^related articles?$/i, label: 'Related Articles' },
  { re: /^see also$/i, label: 'See Also' },
  { re: /^you might also like$/i, label: 'You Might Also Like' },
  // "Next Steps" is a legitimate heading mid-article (e.g. a worked example) —
  // only a web-only nav prompt when it is the very last heading in the piece.
  { re: /^next steps?$/i, label: 'Next Steps', onlyIfLast: true },
]

// ── Removal passes ───────────────────────────────────────────────────────────

/** "By [Name]" byline as the very first element of the content — not "By the end of this chapter...". */
function removeLeadingByline(html: string, warnings: string[]): string {
  const m = html.match(/^\s*<(p|div|span)\b[^>]*>([\s\S]*?)<\/\1>/i)
  if (!m) return html
  const text = stripTags(m[2])
  if (/^by\s+[A-Za-z][A-Za-z'.-]*(\s+[A-Za-z][A-Za-z'.-]*){0,4}$/.test(text)) {
    warnings.push(`Removed author byline at start of content ('${text}')`)
    return html.slice(m[0].length)
  }
  return html
}

/** A "Contents" / "Table of Contents" heading near the top, immediately followed by a list of jump-anchor links. */
function removeTopTOC(html: string, warnings: string[]): string {
  const headingRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i
  const m = headingRe.exec(html)
  if (!m || m.index > 1000) return html
  const text = normaliseHeadingText(stripTags(m[2]))
  if (!/^(table of )?contents$/i.test(text)) return html

  const afterHeading = m.index + m[0].length
  const listMatch = html.slice(afterHeading).match(/^\s*<(ul|ol)\b[^>]*>/i)
  if (!listMatch) return html

  const listTag = listMatch[1].toLowerCase()
  const listOpenEnd = afterHeading + listMatch[0].length
  const listCloseEnd = findMatchingClose(html, listTag, listOpenEnd)
  if (listCloseEnd === -1) return html

  const listContent = html.slice(afterHeading, listCloseEnd)
  if (!/<a\b[^>]*href\s*=\s*["']#/i.test(listContent)) return html

  warnings.push(`Removed 'Table of Contents' block (approx ${listCloseEnd - m.index} chars)`)
  return html.slice(0, m.index) + html.slice(listCloseEnd)
}

/** <nav> blocks entirely, plus any block-level element whose class names a nav/sidebar/widget/related/share role. */
function removeMarkedBlocks(html: string, warnings: string[]): string {
  const BLOCK_TAGS = ['nav', 'div', 'section', 'aside', 'footer', 'header', 'ul', 'ol']
  let out = html
  let navRemoved = 0
  let classRemoved = 0
  let changed = true
  let guard = 0
  while (changed && guard < 1000) {
    changed = false
    guard++
    for (const tag of BLOCK_TAGS) {
      const openRe = new RegExp('<' + tag + '((?:\\s[^>]*)?)>', 'gi')
      let m: RegExpExecArray | null
      while ((m = openRe.exec(out))) {
        const attrs = m[1] || ''
        const isNav = tag === 'nav'
        const classMatch = attrs.match(/class\s*=\s*"([^"]*)"|class\s*=\s*'([^']*)'/i)
        const classVal = ((classMatch && (classMatch[1] || classMatch[2])) || '').toLowerCase()
        const hasRemovableClass = classVal.length > 0 && REMOVABLE_CLASS_SUBSTRINGS.some((s) => classVal.includes(s))
        if (isNav || hasRemovableClass) {
          const openEnd = m.index + m[0].length
          const closeEnd = findMatchingClose(out, tag, openEnd)
          if (closeEnd !== -1) {
            out = out.slice(0, m.index) + out.slice(closeEnd)
            if (isNav) navRemoved++
            else classRemoved++
            changed = true
            break
          }
        }
      }
      if (changed) break
    }
  }
  if (navRemoved > 0) warnings.push(`Removed ${navRemoved} <nav> block(s)`)
  if (classRemoved > 0) warnings.push(`Removed ${classRemoved} navigation/sidebar/widget element(s) by class`)
  return out
}

/**
 * Removes a web-only section from its heading through to (not including) the
 * next heading of equal or higher level, or end of content — never leaves
 * orphaned body text under a deleted heading.
 */
function removeWebOnlySections(html: string, warnings: string[]): string {
  const headings: { level: number; start: number; end: number; text: string }[] = []
  const headingRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  let hm: RegExpExecArray | null
  while ((hm = headingRe.exec(html))) {
    headings.push({
      level: parseInt(hm[1], 10),
      start: hm.index,
      end: hm.index + hm[0].length,
      text: normaliseHeadingText(stripTags(hm[2])),
    })
  }

  const ranges: { from: number; to: number; label: string }[] = []
  headings.forEach((h, i) => {
    const pattern = SECTION_PATTERNS.find((p) => p.re.test(h.text))
    if (!pattern) return
    if (pattern.onlyIfLast && i !== headings.length - 1) return
    let to = html.length
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) { to = headings[j].start; break }
    }
    ranges.push({ from: h.start, to, label: pattern.label })
  })

  // Keep only maximal ranges — a matched heading nested inside another
  // removed section (e.g. "Share this" under "Further Reading") must not
  // be removed a second time against already-shifted offsets.
  const accepted: typeof ranges = []
  for (const r of ranges.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from))) {
    if (!accepted.some((a) => a.from <= r.from && a.to >= r.to)) accepted.push(r)
  }

  let out = html
  for (const r of accepted.slice().sort((a, b) => b.from - a.from)) {
    warnings.push(`Removed '${r.label}' section (approx ${r.to - r.from} chars)`)
    out = out.slice(0, r.from) + out.slice(r.to)
  }
  return out
}

/** Removes every `<tag>...</tag>` (non-nested tags: p / div / span) whose entire stripped text matches `pattern`. */
function removeWholeElementIfMatches(
  html: string,
  tags: string[],
  pattern: RegExp,
  label: string,
  warnings: string[],
  maxLen?: number,
): string {
  let out = html
  let count = 0
  for (const tag of tags) {
    const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi')
    out = out.replace(re, (whole: string, inner: string) => {
      const text = stripTags(inner)
      if (!text || !pattern.test(text)) return whole
      if (typeof maxLen === 'number' && text.length > maxLen) return whole
      count++
      return ''
    })
  }
  if (count > 0) warnings.push(`Removed ${count} '${label}' element(s)`)
  return out
}

/**
 * Single pass over every `<a>` tag:
 *   - fragment-only hrefs and jump-language link text are stripped entirely
 *   - accountingbody.com / ethiotax.com / relative links become plain text
 *   - external MCQ/quiz links are stripped entirely
 *   - all other external links become plain text (href dropped, text kept)
 */
function processAnchors(html: string, warnings: string[]): string {
  let jumpStripped = 0
  let quizRemoved = 0
  let internalConverted = 0
  let externalConverted = 0

  const out = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole: string, attrs: string, inner: string) => {
    const hrefMatch = attrs.match(/href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i)
    const href = (hrefMatch && (hrefMatch[1] || hrefMatch[2])) || ''
    const text = stripTags(inner)

    if (href.startsWith('#')) {
      jumpStripped++
      return ''
    }
    if (JUMP_LINK_TEXT_RE.test(text)) {
      jumpStripped++
      return ''
    }
    if (!href) return whole

    const isAbsoluteExternal = /^https?:\/\//i.test(href) && !INTERNAL_HOST_RE.test(href)
    if (!isAbsoluteExternal) {
      internalConverted++
      return inner
    }
    if (QUIZ_LINK_TEXT_RE.test(text)) {
      quizRemoved++
      return ''
    }
    externalConverted++
    return inner
  })

  if (jumpStripped > 0) warnings.push(`Stripped ${jumpStripped} internal navigation anchor(s)`)
  if (internalConverted > 0) warnings.push(`Converted ${internalConverted} internal site link(s) to plain text`)
  if (quizRemoved > 0) warnings.push(`Removed ${quizRemoved} quiz/practice-question link(s)`)
  if (externalConverted > 0) warnings.push(`Stripped href from ${externalConverted} external link(s), keeping link text`)

  return out
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

function runFilterPipeline(html: string): { html: string; warnings: string[] } {
  if (!html) return { html: '', warnings: [] }
  const warnings: string[] = []
  let out = html

  out = removeLeadingByline(out, warnings)
  out = removeTopTOC(out, warnings)
  out = removeMarkedBlocks(out, warnings)
  out = removeWebOnlySections(out, warnings)
  out = removeWholeElementIfMatches(out, ['p', 'div', 'span'], SHARE_BLOCK_RE, 'share/feedback block', warnings)
  out = removeWholeElementIfMatches(out, ['p', 'div', 'span'], METADATA_LINE_RE, 'metadata line', warnings)
  // A CTA phrase only disqualifies a paragraph when the paragraph IS the CTA —
  // capped at 160 chars so a long educational paragraph that happens to
  // mention "sign up" in passing is left alone.
  out = removeWholeElementIfMatches(out, ['p', 'div'], CTA_RE, 'website call-to-action', warnings, 160)
  out = processAnchors(out, warnings)

  return { html: out, warnings }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Pure function: raw WordPress-origin article HTML in, publication-ready HTML out. */
export function filterForPublication(html: string): string {
  return runFilterPipeline(html).html
}

/**
 * Re-derives the same warnings that filtering `originalHtml` produced (the
 * pipeline is deterministic, so replaying it against the original is
 * equivalent to having logged them during the original filter pass), plus a
 * total-size delta computed from the actual filtered output supplied.
 */
export function getPublicationWarnings(originalHtml: string, filteredHtml: string): string[] {
  const { warnings } = runFilterPipeline(originalHtml)
  const removedChars = originalHtml.length - filteredHtml.length
  if (removedChars > 0) {
    warnings.push(`Total: ${removedChars} character(s) removed (${originalHtml.length} -> ${filteredHtml.length})`)
  }
  return warnings
}

// ── Smoke test (documentation only — no test framework, run manually if needed) ──
//
// 1. "Key Takeaways" section at the end of the article
//    IN:  '<p>Depreciation spreads an asset\'s cost over its useful life.</p>' +
//         '<h2>Key Takeaways</h2><ul><li>Straight-line is simplest.</li>' +
//         '<li>Reducing balance front-loads expense.</li></ul>'
//    OUT: '<p>Depreciation spreads an asset\'s cost over its useful life.</p>'
//    (the "Key Takeaways" heading and both list items are removed together)
//
// 2. Fragment anchor jump links
//    IN:  '<p><a href="#key-takeaways">Jump to Key Takeaways</a></p>' +
//         '<p>Working capital is current assets minus current liabilities.</p>' +
//         '<p><a href="#top">Back to top</a></p>'
//    OUT: '<p></p><p>Working capital is current assets minus current liabilities.</p><p></p>'
//    (both anchors removed entirely — fragment href in the first, jump-language text in the second)
//
// 3. "Further Reading" followed by another heading
//    IN:  '<h2>Further Reading</h2><p><a href="https://accountingbody.com/vat-guide">VAT guide</a></p>' +
//         '<h2>Worked Example</h2><p>A business buys machinery for 10,000.</p>'
//    OUT: '<h2>Worked Example</h2><p>A business buys machinery for 10,000.</p>'
//    (Further Reading section removed up to, but not including, the next h2)
//
// 4. Internal accountingbody.com links
//    IN:  '<p>See our <a href="https://accountingbody.com/guides/vat">VAT guide</a> ' +
//         'and <a href="https://ethiotax.com/rates">tax rates</a> for more detail. ' +
//         'External source: <a href="https://www.gov.uk/vat-rates">gov.uk</a>.</p>'
//    OUT: '<p>See our VAT guide and tax rates for more detail. ' +
//         'External source: gov.uk.</p>'
//    (internal links unwrapped to plain text; the external gov.uk link keeps its text, loses its href)
//
// 5. Clean article, no web elements — passes through unchanged
//    IN:  '<h2>Accruals Concept</h2><p>Expenses are recognised when incurred, not when paid.</p>' +
//         '<ul><li>Matches income to the period it relates to.</li></ul>'
//    OUT: identical to IN — filterForPublication(html) === html
