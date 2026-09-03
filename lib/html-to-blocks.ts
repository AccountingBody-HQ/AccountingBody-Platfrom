/* eslint-disable @typescript-eslint/no-explicit-any */
// HTML → Portable Text blocks
// Converts plain HTML (WordPress-stripped) into minimal Portable Text blocks
// so BookTemplate / docx export can render without modification.
//
// Inline-formatting aware: <strong>/<b> and <em>/<i> (including nested
// combinations) become span marks so BookTemplate's renderSpans() can apply
// bold/italic in the printed book, instead of every tag being stripped to
// plain text.
import { filterForPublication } from "@/lib/publication-filter"

// ── Entity decoding ──────────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match: string, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_match: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

// ── Inline span parsing ──────────────────────────────────────────────────────

interface Span {
  _type: "span"
  text: string
  marks: string[]
}

const STRONG_TAGS = new Set(["strong", "b"])
const EM_TAGS = new Set(["em", "i"])

/**
 * Parses one block's inner HTML into spans. Keeps a stack of open inline
 * tags so nested <strong><em>...</em></strong> yields marks: ["strong", "em"];
 * unrecognised inline tags (<a>, <span>, <code>, <abbr>, ...) push a
 * mark-less stack entry so their text still comes through as plain text
 * without breaking marks inherited from an enclosing <strong>/<em>.
 */
function parseInline(innerHtml: string): Span[] {
  const spans: Span[] = []
  const stack: { tag: string; mark: "strong" | "em" | null }[] = []
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g
  let lastIndex = 0
  let m: RegExpExecArray | null

  const activeMarks = (): string[] => {
    const marks: string[] = []
    for (const entry of stack) {
      if (entry.mark && !marks.includes(entry.mark)) marks.push(entry.mark)
    }
    return marks
  }

  const pushText = (raw: string) => {
    const decoded = decodeEntities(raw)
    if (decoded.length === 0) return
    spans.push({ _type: "span", text: decoded, marks: activeMarks() })
  }

  while ((m = tagRe.exec(innerHtml))) {
    if (m.index > lastIndex) pushText(innerHtml.slice(lastIndex, m.index))
    lastIndex = tagRe.lastIndex

    const isClose = m[1] === "/"
    const tagName = m[2].toLowerCase()
    if (tagName === "br") continue // block-level split already handles line breaks

    if (!isClose) {
      let mark: "strong" | "em" | null = null
      if (STRONG_TAGS.has(tagName)) mark = "strong"
      else if (EM_TAGS.has(tagName)) mark = "em"
      stack.push({ tag: tagName, mark })
    } else {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tagName) { stack.splice(i, 1); break }
      }
    }
  }
  if (lastIndex < innerHtml.length) pushText(innerHtml.slice(lastIndex))

  return spans
}

// ── Block-level segmentation ─────────────────────────────────────────────────

type BlockStyle = "h1" | "h2" | "h3" | "h4" | "normal" | "blockquote"

interface RawBlock {
  style: BlockStyle
  listItem?: "bullet" | "number"
  spans: Span[]
}

const HEADING_STYLE: Record<string, BlockStyle> = {
  "1": "h1", "2": "h2", "3": "h3", "4": "h4", "5": "h4", "6": "h4",
}

function splitOnBreaks(innerHtml: string): string[] {
  return innerHtml.split(/<br\s*\/?>/gi)
}

function pushBlocksFromInner(
  innerHtml: string,
  style: BlockStyle,
  listItem: "bullet" | "number" | undefined,
  out: RawBlock[],
): void {
  for (const part of splitOnBreaks(innerHtml)) {
    out.push({ style, listItem, spans: parseInline(part) })
  }
}

// Group map: 1 = heading level, 2 = heading inner, 3 = blockquote inner,
// 4 = li inner, 5 = p inner, 6 = div inner.
const BLOCK_RE = /<ul\b[^>]*>|<\/ul\s*>|<ol\b[^>]*>|<\/ol\s*>|<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>|<blockquote\b[^>]*>([\s\S]*?)<\/blockquote\s*>|<li\b[^>]*>([\s\S]*?)<\/li\s*>|<p\b[^>]*>([\s\S]*?)<\/p\s*>|<div\b[^>]*>([\s\S]*?)<\/div\s*>|<br\s*\/?>/gi

/**
 * Splits source HTML into ordered block segments (headings, paragraphs,
 * list items, blockquotes), tracking <ul>/<ol> nesting so each <li> knows
 * whether it is a bullet or a numbered item.
 */
function tokenizeBlocks(html: string): RawBlock[] {
  const out: RawBlock[] = []
  const listStack: boolean[] = [] // true = <ol> (numbered), false = <ul> (bullet)
  BLOCK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BLOCK_RE.exec(html))) {
    const whole = m[0]
    if (/^<ul\b/i.test(whole)) { listStack.push(false); continue }
    if (/^<\/ul/i.test(whole)) { listStack.pop(); continue }
    if (/^<ol\b/i.test(whole)) { listStack.push(true); continue }
    if (/^<\/ol/i.test(whole)) { listStack.pop(); continue }

    if (m[1] !== undefined) {
      pushBlocksFromInner(m[2] ?? "", HEADING_STYLE[m[1]] ?? "normal", undefined, out)
      continue
    }
    if (m[3] !== undefined) { pushBlocksFromInner(m[3], "blockquote", undefined, out); continue }
    if (m[4] !== undefined) {
      const ordered = listStack.length > 0 ? listStack[listStack.length - 1] : false
      pushBlocksFromInner(m[4], "normal", ordered ? "number" : "bullet", out)
      continue
    }
    if (m[5] !== undefined) { pushBlocksFromInner(m[5], "normal", undefined, out); continue }
    if (m[6] !== undefined) { pushBlocksFromInner(m[6], "normal", undefined, out); continue }
    // a standalone <br> between recognised blocks carries no text of its own
  }
  return out
}

// ── Long-block splitter ──────────────────────────────────────────────────────
// react-pdf's yoga layout engine fails when a <Text> has 50+ inline children,
// rendering the block at page origin (0, paddingTop) and overlapping prior
// content. This splits oversized "normal" paragraph blocks at sentence
// boundaries between spans so each block's child count stays safe.
// Threshold: 800 chars (~133 words) — well above any normal paragraph.
// Headings and list items are never split.
// Splitting happens BETWEEN spans (never mid-span) so bold/italic marks
// on each span are fully preserved in the resulting blocks.
function splitLongBlocks(blocks: RawBlock[]): RawBlock[] {
  const CHAR_THRESHOLD = 800
  const FLUSH_AFTER = 400
  const result: RawBlock[] = []

  for (const block of blocks) {
    // Never split headings, blockquotes, or list items
    if (block.style !== "normal" || block.listItem) {
      result.push(block)
      continue
    }

    const totalChars = block.spans.reduce((sum, s) => sum + s.text.length, 0)
    if (totalChars <= CHAR_THRESHOLD) {
      result.push(block)
      continue
    }

    // Split into smaller blocks at sentence boundaries between spans.
    // A sentence boundary is detected when a span's text ends with
    // a sentence-ending punctuation (. ? !) optionally followed by
    // a closing quote or bracket, then whitespace.
    const SENTENCE_END = /[.?!]["'\])]?\s*$/
    let current: Span[] = []
    let accumulated = 0

    for (const span of block.spans) {
      current.push(span)
      accumulated += span.text.length

      if (accumulated >= FLUSH_AFTER && SENTENCE_END.test(span.text)) {
        result.push({ style: "normal", spans: current })
        current = []
        accumulated = 0
      }
    }

    // Flush any remaining spans
    if (current.length > 0) {
      result.push({ style: "normal", spans: current })
    }
  }

  return result
}

// ── Public API ───────────────────────────────────────────────────────────────

export function htmlToBlocks(html: string, filterFirst = false): any[] {
  if (!html) return []
  const source = filterFirst ? filterForPublication(html) : html

  const rawBlocks = splitLongBlocks(
    tokenizeBlocks(source).filter((b) =>
      b.spans.some((s) => s.text.trim().length > 0)
    )
  )

  return rawBlocks.map((b, i) => {
    const block: any = {
      _type: "block",
      _key: `b${i}`,
      style: b.style,
      markDefs: [],
      children: b.spans,
    }
    if (b.listItem) block.listItem = b.listItem
    return block
  })
}
