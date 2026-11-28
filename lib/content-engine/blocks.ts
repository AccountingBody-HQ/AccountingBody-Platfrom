// Content blocks: the only shapes a writer may return. Text fields are plain
// text with two inline marks (**bold** and *italic*); HTML never enters
// through a text field. validateBlocks never changes a block.
import { BLOCK_TYPES, type Block, type BlockType, type Finding } from './types'

export const TEXT_MAX_CHARS = 1200

/** The fields of each block type: required first, then optional. */
export const BLOCK_FIELDS: Readonly<Record<BlockType, { required: string[]; optional: string[] }>> = {
  heading: { required: ['type', 'level', 'text'], optional: [] },
  paragraph: { required: ['type', 'text'], optional: [] },
  definition: { required: ['type', 'term', 'text'], optional: [] },
  worked_example: { required: ['type', 'title', 'scenario', 'steps', 'answer'], optional: [] },
  calculation: { required: ['type', 'title', 'steps'], optional: [] },
  journal_entry: { required: ['type', 'title', 'lines'], optional: ['narrative'] },
  table: { required: ['type', 'caption', 'columns', 'rows'], optional: [] },
  key_point: { required: ['type', 'text'], optional: [] },
  common_mistake: { required: ['type', 'mistake', 'correction'], optional: [] },
  exam_tip: { required: ['type', 'text'], optional: [] },
  check_understanding: { required: ['type', 'question', 'answer'], optional: [] },
  takeaway: { required: ['type', 'points'], optional: [] },
  list: { required: ['type', 'style', 'items'], optional: [] },
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && (BLOCK_TYPES as readonly string[]).indexOf(value) >= 0
}

const PATH_WORDS: Readonly<Record<string, string>> = {
  sections: 'section',
  blocks: 'block',
  questions: 'question',
  steps: 'step',
  lines: 'line',
  rows: 'row',
  columns: 'column',
  items: 'item',
  points: 'point',
  options: 'option',
  keyTerms: 'key term',
  sourceSectionsCovered: 'covered section',
}

const ROOTS = ['document', 'explainer', 'questionSet', 'output']

/** A plain-English place for a path: "document.sections[2].blocks[4].steps[1]" → "Section 3, block 5, step 2". */
export function describePath(path: string): string {
  const parts: string[] = []
  const pattern = /([A-Za-z_]+)(?:\[(\d+)\])?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(path)) !== null) {
    const [, name, index] = match
    if (ROOTS.indexOf(name) >= 0 && index === undefined) continue
    const word = PATH_WORDS[name]
    if (index !== undefined) parts.push(`${word ?? name} ${Number(index) + 1}`)
    else parts.push(`the "${name}" field`)
  }
  const text = parts.length ? parts.join(', ') : 'The answer'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

class Collector {
  findings: Finding[] = []
  errors = 0

  shape(path: string, problem: string): void {
    this.add('blocks.shape', path, problem)
  }

  add(check: 'blocks.shape' | 'blocks.markup' | 'blocks.journal', path: string, problem: string): void {
    this.errors++
    this.findings.push({ check, severity: 'error', message: `${describePath(path)}: ${problem}.`, path })
  }
}

function checkText(c: Collector, value: unknown, path: string): boolean {
  if (typeof value !== 'string') {
    c.shape(path, 'must be text')
    return false
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    c.shape(path, 'is empty')
    return false
  }
  if (trimmed.length > TEXT_MAX_CHARS) {
    c.shape(path, 'is longer than 1,200 characters')
    return false
  }
  if (/[<>]/.test(value)) {
    c.add('blocks.markup', path, 'contains < or >, and HTML is not allowed in text')
    return false
  }
  return true
}

function checkList(c: Collector, value: unknown, path: string, min: number, max: number, each: (item: unknown, itemPath: string) => void): void {
  if (!Array.isArray(value)) {
    c.shape(path, 'must be a list')
    return
  }
  if (value.length < min || value.length > max) {
    c.shape(path, `must have ${min} to ${max} entries, not ${value.length}`)
  }
  value.forEach((item, i) => each(item, `${path}[${i}]`))
}

function checkFields(c: Collector, block: Record<string, unknown>, type: BlockType, path: string): void {
  const { required, optional } = BLOCK_FIELDS[type]
  for (const key of required) {
    if (!(key in block)) c.shape(path, `is missing its "${key}" field`)
  }
  for (const key of Object.keys(block)) {
    if (required.indexOf(key) < 0 && optional.indexOf(key) < 0) c.shape(path, `has an unexpected field "${key}"`)
  }
}

function checkJournal(c: Collector, value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    c.shape(path, 'must be a list')
    return
  }
  if (value.length < 2 || value.length > 12) c.shape(path, `must have 2 to 12 entries, not ${value.length}`)
  let debitPence = 0
  let creditPence = 0
  let readable = true
  value.forEach((line, i) => {
    const linePath = `${path}[${i}]`
    if (!isRecord(line)) {
      c.shape(linePath, 'must be an object with account, debit and credit')
      readable = false
      return
    }
    for (const key of ['account', 'debit', 'credit']) {
      if (!(key in line)) c.shape(linePath, `is missing its "${key}" field`)
    }
    for (const key of Object.keys(line)) {
      if (['account', 'debit', 'credit'].indexOf(key) < 0) c.shape(linePath, `has an unexpected field "${key}"`)
    }
    checkText(c, line.account, `${linePath}.account`)
    const amounts: (number | null)[] = []
    for (const side of ['debit', 'credit'] as const) {
      const amount = line[side]
      if (amount === null || amount === undefined) amounts.push(null)
      else if (typeof amount === 'number' && isFinite(amount)) amounts.push(amount)
      else {
        c.shape(`${linePath}.${side}`, 'must be a number or null')
        readable = false
        amounts.push(null)
      }
    }
    const [debit, credit] = amounts
    const oneSide = (debit !== null && debit > 0 && credit === null) || (credit !== null && credit > 0 && debit === null)
    if (!oneSide) {
      c.add('blocks.journal', linePath, 'must have either a debit or a credit above zero, and the other side empty')
      readable = false
      return
    }
    debitPence += Math.round((debit ?? 0) * 100)
    creditPence += Math.round((credit ?? 0) * 100)
  })
  if (readable && value.length >= 2 && debitPence !== creditPence) {
    c.add('blocks.journal', path.replace(/\.lines$/, ''), `does not balance: debits ${(debitPence / 100).toFixed(2)}, credits ${(creditPence / 100).toFixed(2)}`)
  }
}

function checkBlock(c: Collector, value: unknown, path: string): boolean {
  const before = c.errors
  if (!isRecord(value)) {
    c.shape(path, 'must be a block object')
    return false
  }
  if (!isBlockType(value.type)) {
    c.shape(path, typeof value.type === 'string' ? `has an unknown block type "${value.type.slice(0, 40)}"` : 'has no block type')
    return false
  }
  const type = value.type
  checkFields(c, value, type, path)
  // A missing field is reported once, by checkFields.
  const text = (key: string) => { if (key in value) checkText(c, value[key], `${path}.${key}`) }
  const texts = (key: string, min: number, max: number) => {
    if (key in value) checkList(c, value[key], `${path}.${key}`, min, max, (item, itemPath) => { checkText(c, item, itemPath) })
  }

  switch (type) {
    case 'heading':
      if ('level' in value && value.level !== 2 && value.level !== 3) c.shape(`${path}.level`, 'must be 2 or 3')
      text('text')
      break
    case 'paragraph':
    case 'key_point':
    case 'exam_tip':
      text('text')
      break
    case 'definition':
      text('term')
      text('text')
      break
    case 'worked_example':
      text('title')
      text('scenario')
      texts('steps', 1, 12)
      text('answer')
      break
    case 'calculation':
      text('title')
      if ('steps' in value) checkList(c, value.steps, `${path}.steps`, 1, 20, (step, stepPath) => {
        if (!isRecord(step)) {
          c.shape(stepPath, 'must be an object with label, working and result')
          return
        }
        for (const key of Object.keys(step)) {
          if (['label', 'working', 'result'].indexOf(key) < 0) c.shape(stepPath, `has an unexpected field "${key}"`)
        }
        for (const key of ['label', 'working', 'result']) checkText(c, step[key], `${stepPath}.${key}`)
      })
      break
    case 'journal_entry':
      text('title')
      if ('narrative' in value) text('narrative')
      if ('lines' in value) checkJournal(c, value.lines, `${path}.lines`)
      break
    case 'table': {
      text('caption')
      texts('columns', 2, 8)
      const width = Array.isArray(value.columns) ? value.columns.length : 0
      if ('rows' in value) checkList(c, value.rows, `${path}.rows`, 1, 30, (row, rowPath) => {
        if (!Array.isArray(row)) {
          c.shape(rowPath, 'must be a list of cells')
          return
        }
        if (row.length !== width) c.shape(rowPath, `has ${row.length} cells but the table has ${width} columns`)
        row.forEach((cell, j) => { checkText(c, cell, `${rowPath}[${j}]`) })
      })
      break
    }
    case 'common_mistake':
      text('mistake')
      text('correction')
      break
    case 'check_understanding':
      text('question')
      text('answer')
      break
    case 'takeaway':
      texts('points', 2, 7)
      break
    case 'list':
      if ('style' in value && value.style !== 'bullet' && value.style !== 'number') c.shape(`${path}.style`, 'must be "bullet" or "number"')
      texts('items', 2, 12)
      break
  }
  return c.errors === before
}

/**
 * Strict check of a list of blocks. Returns the blocks that passed, unchanged,
 * and one finding per problem, each naming its place.
 */
export function validateBlocks(value: unknown, path: string): { blocks: Block[]; findings: Finding[] } {
  const c = new Collector()
  const blocks: Block[] = []
  if (!Array.isArray(value)) {
    c.shape(path, 'must be a list of blocks')
    return { blocks, findings: c.findings }
  }
  value.forEach((item, i) => {
    if (checkBlock(c, item, `${path}[${i}]`)) blocks.push(item as Block)
  })
  return { blocks, findings: c.findings }
}

function blockTexts(block: Block): string[] {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'key_point':
    case 'exam_tip':
      return [block.text]
    case 'definition':
      return [block.term, block.text]
    case 'worked_example':
      return [block.title, block.scenario, ...block.steps, block.answer]
    case 'calculation':
      return [block.title, ...block.steps.map(s => `${s.label} ${s.working} ${s.result}`)]
    case 'journal_entry':
      return [block.title, ...(block.narrative ? [block.narrative] : []), ...block.lines.map(l => l.account)]
    case 'table':
      return [block.caption, block.columns.join(' '), ...block.rows.map(r => r.join(' '))]
    case 'common_mistake':
      return [block.mistake, block.correction]
    case 'check_understanding':
      return [block.question, block.answer]
    case 'takeaway':
      return block.points
    case 'list':
      return block.items
  }
}

/** Plain text of blocks, for word counts and coverage. */
export function blocksToText(blocks: Block[]): string {
  return blocks.map(block => blockTexts(block).join('\n')).join('\n')
}

/** Words in a text: split on whitespace after trimming; '' is 0. */
export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}
