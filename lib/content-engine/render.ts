// The safe HTML renderer for content blocks. Every text is escaped; the only
// markup is a fixed set of tags with a fixed set of class names, and there are
// no URL attributes at all. Same blocks → same HTML.
import type { Block } from './types'

export const RENDER_TAGS: readonly string[] = [
  'section', 'h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td', 'aside', 'div',
]

export const RENDER_LABELS = {
  workedExample: 'Worked example',
  calculation: 'Calculation',
  keyPoint: 'Key point',
  commonMistake: 'Common mistake',
  examTip: 'Exam tip',
  checkUnderstanding: 'Check your understanding',
  answer: 'Answer',
  takeaways: 'Key takeaways',
  definition: 'Definition',
} as const

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapes, then turns **x** into strong and *x* into em (never across lines). */
export function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
}

/** 1234.5 → "1,234.50" (two decimals, thousands separators). */
export function formatAmount(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2)
  const [whole, pence] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${amount < 0 ? '-' : ''}${grouped}.${pence}`
}

/** An amount only when it is a real number; otherwise an empty cell. */
const amountCell = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? formatAmount(x) : '')
const label = (text: string) => `<p class="ce-label">${escapeHtml(text)}</p>`
const para = (text: string) => `<p>${inline(text)}</p>`
const th = (text: string) => `<th scope="col">${inline(text)}</th>`
const td = (text: string) => `<td>${inline(text)}</td>`
const li = (text: string) => `<li>${inline(text)}</li>`

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'heading': {
      const level = block.level === 3 ? 3 : 2
      return `<h${level} class="ce-heading">${inline(block.text)}</h${level}>`
    }
    case 'paragraph':
      return `<p class="ce-paragraph">${inline(block.text)}</p>`
    case 'definition':
      return `<div class="ce-definition">${label(RENDER_LABELS.definition)}<dl><dt>${inline(block.term)}</dt><dd>${inline(block.text)}</dd></dl></div>`
    case 'worked_example':
      return `<div class="ce-worked_example">${label(RENDER_LABELS.workedExample)}<p><strong>${inline(block.title)}</strong></p>${para(block.scenario)}<ol>${block.steps.map(li).join('')}</ol>${label(RENDER_LABELS.answer)}${para(block.answer)}</div>`
    case 'calculation':
      return `<div class="ce-calculation">${label(RENDER_LABELS.calculation)}<table><caption>${inline(block.title)}</caption><thead><tr>${th('Step')}${th('Working')}${th('Result')}</tr></thead><tbody>${block.steps.map(s => `<tr>${td(s.label)}${td(s.working)}${td(s.result)}</tr>`).join('')}</tbody></table></div>`
    case 'journal_entry': {
      const rows = block.lines
        .map(l => `<tr>${td(l.account)}<td>${amountCell(l.debit)}</td><td>${amountCell(l.credit)}</td></tr>`)
        .join('')
      const narrative = block.narrative ? para(block.narrative) : ''
      return `<div class="ce-journal_entry"><table><caption>${inline(block.title)}</caption><thead><tr>${th('Account')}${th('Debit')}${th('Credit')}</tr></thead><tbody>${rows}</tbody></table>${narrative}</div>`
    }
    case 'table':
      return `<table class="ce-table"><caption>${inline(block.caption)}</caption><thead><tr>${block.columns.map(th).join('')}</tr></thead><tbody>${block.rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table>`
    case 'key_point':
      return `<aside class="ce-key_point">${label(RENDER_LABELS.keyPoint)}${para(block.text)}</aside>`
    case 'common_mistake':
      return `<aside class="ce-common_mistake">${label(RENDER_LABELS.commonMistake)}${para(block.mistake)}${para(block.correction)}</aside>`
    case 'exam_tip':
      return `<aside class="ce-exam_tip">${label(RENDER_LABELS.examTip)}${para(block.text)}</aside>`
    case 'check_understanding':
      return `<div class="ce-check_understanding">${label(RENDER_LABELS.checkUnderstanding)}${para(block.question)}${label(RENDER_LABELS.answer)}${para(block.answer)}</div>`
    case 'takeaway':
      return `<aside class="ce-takeaway">${label(RENDER_LABELS.takeaways)}<ul>${block.points.map(li).join('')}</ul></aside>`
    case 'list': {
      const tag = block.style === 'number' ? 'ol' : 'ul'
      return `<${tag} class="ce-list">${block.items.map(li).join('')}</${tag}>`
    }
    // The renderer stays safe even for unvalidated input: an unknown block type renders nothing.
    default:
      return ''
  }
}

/** Safe HTML for validated blocks. */
export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('\n')
}
