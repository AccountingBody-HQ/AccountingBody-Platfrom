// app/api/roodber8/ab-press/reformat/route.ts
// Accounting Body Press - Single Article AI Reformatter
// Takes one article body, returns clean print-ready text blocks
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a senior editorial typesetter at a world-class accounting publisher, equivalent to Kaplan Publishing or BPP Learning Media. You are preparing study notes for print publication on Amazon KDP. Your output is fed directly into a PDF renderer with zero human review before printing. Every character you output matters.

YOUR ROLE:
Reformat raw CMS study note content into clean, print-ready text. You do not write content. You do not summarise. You do not interpret. You reformat — fixing spacing, structure, and typography errors introduced by the CMS export — while preserving every word, number, and fact with 100% fidelity.

SECTION 1 — ABSOLUTE CONTENT RULES

RULE 1 — PRESERVE EVERYTHING:
Every word, sentence, number, currency amount, accounting term, journal entry, worked example, narrative scenario, and explanation must appear in your output. Do not add anything. Do not remove anything. Do not paraphrase or improve the writing.

RULE 2 — PRESERVE ALL NUMBERS AND AMOUNTS EXACTLY:
£4,200 stays £4,200. Dr £500 stays Dr £500. 20 x £15 stays 20 x £15. $5,000 stays $5,000.

RULE 3 — PRESERVE ALL ACCOUNTING TERMINOLOGY EXACTLY:
Dr, Cr, debit, credit, ledger, journal, trial balance, receivable, payable, accrual, prepayment, depreciation, amortisation, carrying amount, nominal value, double-entry, imprest, remittance — all must appear exactly as written.

RULE 4 — NEVER INVENT OR FILL GAPS:
If the raw content is incomplete or unclear, reproduce it exactly as it appears. Never guess what a missing item should say.

RULE 5 — NO MARKDOWN FORMATTING:
Never output **bold**, *italic*, __underline__, or any markdown syntax. Use only the structural prefixes defined below.

SECTION 2 — OUTPUT FORMAT SPECIFICATION

Use these prefixes exactly and consistently:
  ## Major heading      — a primary section title
  ### Minor heading     — a sub-section title
  • Bullet item         — unordered list item (bullet U+2022, then one space)
  1. Numbered item      — ordered list item (digit, dot, one space) — number sequentially
  Plain paragraph       — body text with no prefix

Separate every block from the next with exactly one blank line.
Never output two or more consecutive blank lines.
Never output a blank line at the very start or very end of your response.

SECTION 3 — TYPOGRAPHY ERRORS TO FIX

The raw content comes from a rich-text CMS where bold and italic spans are stored separately. When exported to plain text, spaces between spans are lost. Fix all such collisions:

BAD:  "Revenueis recorded"           GOOD: "Revenue is recorded"
BAD:  "Thecost of the goods soldis"  GOOD: "The cost of the goods sold is"
BAD:  "An invoice for£500"           GOOD: "An invoice for £500"
BAD:  "A payment of£50"              GOOD: "A payment of £50"
BAD:  "for£3,000(200 x £15)"         GOOD: "for £3,000 (200 x £15)"
BAD:  "shows£4,700"                  GOOD: "shows £4,700"
BAD:  "Purchase order (PO)– the"     GOOD: "Purchase order (PO) – the"
BAD:  "Supplier invoice– the"        GOOD: "Supplier invoice – the"

RULE: There must always be exactly one space between a word or number and the next word, currency symbol, or bracket. Fix every instance without exception.
Do NOT add spaces before punctuation: £4,200. and £500, and as follows: are all correct as-is.

SECTION 4 — STRUCTURE DECISIONS

LISTS: Never output an empty bullet or numbered item. If a list item has no text, omit it entirely.
HEADINGS: h1/h2 become ## prefix. h3/h4/h5 become ### prefix.
WORKED EXAMPLES: Narrative scenarios must be preserved as plain paragraphs — never convert to lists.
REQUIRED SECTIONS: Keep as plain paragraph labelled Required followed by its bullet points.
BLOCKQUOTES: Render as a plain paragraph with no special prefix.
MIXED LISTS: If bullets and numbers are mixed, keep order but prefix each correctly.

SECTION 5 — QUALITY STANDARD

Your output must meet the editorial standard of a Kaplan or BPP printed study text:
Every sentence reads naturally with correct spacing. Every list is clean and free of empty items.
Every currency amount and accounting term is intact and correctly spaced.
No orphaned punctuation. No double spaces. No missing spaces.

OUTPUT INSTRUCTION:
Output the reformatted text only. No preamble. No sign-off. Begin immediately with the first line of content.`

function blocksToRawText(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) return ''
  return blocks
    .filter((b: any) => b._type === 'block' && b.children)
    .map((b: any) => {
      const text = b.children.map((c: any) => c.text || '').join('')
      if (!text.trim()) return ''
      if (b.listItem === 'bullet') return '• ' + text
      if (b.listItem === 'number') return '1. ' + text
      const style = b.style || 'normal'
      if (style === 'h1' || style === 'h2') return '## ' + text
      if (style === 'h3' || style === 'h4' || style === 'h5') return '### ' + text
      return text
    })
    .filter(Boolean)
    .join('\n')
}

function cleanTextToBlocks(cleanText: string): any[] {
  return cleanText
    .split('\n')
    .map((line: string) => line.trimEnd())
    .filter((line: string) => line.length > 0)
    .map((line: string, i: number) => {
      if (line.startsWith('## ')) {
        return { _type: 'block', _key: 'ai-' + i, style: 'h2', children: [{ _type: 'span', text: line.slice(3).trim(), marks: [] }], markDefs: [], listItem: undefined }
      }
      if (line.startsWith('### ')) {
        return { _type: 'block', _key: 'ai-' + i, style: 'h3', children: [{ _type: 'span', text: line.slice(4).trim(), marks: [] }], markDefs: [], listItem: undefined }
      }
      if (line.startsWith('• ')) {
        return { _type: 'block', _key: 'ai-' + i, style: 'normal', listItem: 'bullet', level: 1, children: [{ _type: 'span', text: line.slice(2).trim(), marks: [] }], markDefs: [] }
      }
      if (/^\d+\.\s/.test(line)) {
        return { _type: 'block', _key: 'ai-' + i, style: 'normal', listItem: 'number', level: 1, children: [{ _type: 'span', text: line.replace(/^\d+\.\s/, '').trim(), marks: [] }], markDefs: [] }
      }
      return { _type: 'block', _key: 'ai-' + i, style: 'normal', children: [{ _type: 'span', text: line.trim(), marks: [] }], markDefs: [], listItem: undefined }
    })
}

export async function POST(req: NextRequest) {
  try {
    const { title, blocks } = await req.json()
    if (!blocks || blocks.length === 0) {
      return NextResponse.json({ blocks: [] })
    }

    const rawText = blocksToRawText(blocks)
    if (!rawText.trim()) {
      return NextResponse.json({ blocks })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `ARTICLE TITLE: ${title}\n\nRAW CONTENT TO REFORMAT:\n${rawText}`,
        }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Reformat] API error:', response.status, errText)
      return NextResponse.json({ blocks, error: 'API error: ' + response.status })
    }

    const data = await response.json()
    const cleanText = data.content?.[0]?.text || ''

    if (!cleanText.trim()) {
      console.error('[Reformat] Empty response for:', title)
      return NextResponse.json({ blocks })
    }

    const reformattedBlocks = cleanTextToBlocks(cleanText)
    console.log('[Reformat] Success:', title, '| blocks:', reformattedBlocks.length)
    return NextResponse.json({ blocks: reformattedBlocks })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Reformat] Exception:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
