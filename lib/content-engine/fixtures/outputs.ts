// Builders for valid fixture answers, made from a compiled prompt. All text is
// invented and generated from a fixed list of neutral sentences, so the
// fixtures are deterministic and meet every word range.
import { blocksToText, countWords } from '../blocks'
import { blueprintFor, sectionsFor } from '../blueprints/index'
import type {
  Block,
  BlockType,
  CompiledPrompt,
  DocumentOutput,
  EngineOutputBase,
  ExplainerOutput,
  Question,
  QuestionSetOutput,
} from '../types'

const SENTENCES = [
  'Hollin Brook Pottery records each cost in the month in which the workshop used the service.',
  'The finance team compares the meter reading with the supplier contract before the books close.',
  'A reviewer can follow the estimate because every figure is tied to a dated document.',
  'When the invoice arrives the difference is treated as a change in estimate for the new period.',
  'The opening reversal stops the same cost from being counted twice in the next period.',
  'Profit for the year would be overstated if the unbilled electricity were left out.',
  'The statement of financial position shows the amount owed as a current liability.',
  'Small differences are common because usage near the year end is estimated from patterns.',
  'Clear working papers let the owner explain each balance to the bank without delay.',
  'The matching idea links the cost to the revenue earned with the same kilns and glaze.',
  'Seasonal orders make the winter quarter busier, so the kilns draw more power in those weeks.',
  'The bookkeeper keeps a short schedule of every estimate with its source and its date.',
]

const WORDS = SENTENCES.join(' ').split(/\s+/)

/** Exactly n words of invented prose, starting at a given word, ending with a full stop. */
export function prose(n: number, start = 0): string {
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(WORDS[(start + i) % WORDS.length])
  const text = out.join(' ')
  return /[.!?]$/.test(text) ? text : text.replace(/[,;:]$/, '') + '.'
}

/** Paragraph blocks holding exactly n words, at most 140 words each. */
export function paragraphs(n: number, start = 0): Block[] {
  const blocks: Block[] = []
  let left = n
  let at = start
  while (left > 0) {
    const size = Math.min(140, left)
    blocks.push({ type: 'paragraph', text: prose(size, at) })
    left -= size
    at += size
  }
  return blocks
}

/** One small valid block of a type. */
export function sampleBlock(type: BlockType): Block {
  switch (type) {
    case 'heading': return { type: 'heading', level: 3, text: 'Matching the cost to the period' }
    case 'paragraph': return { type: 'paragraph', text: prose(20, 5) }
    case 'definition': return { type: 'definition', term: 'Accrued expense', text: 'A cost the business has used but not yet been invoiced for.' }
    case 'worked_example': return {
      type: 'worked_example',
      title: 'Hollin Brook Pottery, final month',
      scenario: 'The workshop used electricity costing £2,317.48 in its final month; the invoice arrives after the year end.',
      steps: ['Find the period in which the electricity was used.', 'Record the cost and the amount owed in that period.'],
      answer: 'An accrual of £2,317.48 at the year end.',
    }
    case 'calculation': return {
      type: 'calculation',
      title: 'Estimating the unbilled charge',
      steps: [
        { label: 'Units used', working: '18,437 - 16,902', result: '1,535 units' },
        { label: 'Charge', working: '1,535 x £1.5098', result: '£2,317.54' },
      ],
    }
    case 'journal_entry': return {
      type: 'journal_entry',
      title: 'Year-end accrual',
      narrative: 'Being electricity used in the final month and not yet invoiced.',
      lines: [
        { account: 'Electricity expense', debit: 2317.48, credit: null },
        { account: 'Accruals', debit: null, credit: 2317.48 },
      ],
    }
    case 'table': return {
      type: 'table',
      caption: 'Two ways of recording the cost',
      columns: ['Approach', 'Effect on profit'],
      rows: [['With the accrual', 'Cost in the right year'], ['Without the accrual', 'Profit overstated']],
    }
    case 'key_point': return { type: 'key_point', text: 'A cost belongs to the period in which it was used.' }
    case 'common_mistake': return { type: 'common_mistake', mistake: 'Waiting for the invoice before recording the cost.', correction: 'Record the cost when the service is used and estimate it if needed.' }
    case 'exam_tip': return { type: 'exam_tip', text: 'Read the dates in the scenario before choosing the period.' }
    case 'check_understanding': return { type: 'check_understanding', question: 'In which period does the final month electricity belong?', answer: 'In the year in which it was used.' }
    case 'takeaway': return { type: 'takeaway', points: ['Record costs when used.', 'Estimate with evidence.', 'Reverse at the start.', 'Explain every balance.'] }
    case 'list': return { type: 'list', style: 'bullet', items: ['Meter readings', 'Contract rates', 'Earlier invoices'] }
  }
}

function blockWords(blocks: Block[]): number {
  return countWords(blocksToText(blocks))
}

function envelope(compiled: CompiledPrompt, title: string): EngineOutputBase {
  return {
    engine: 'ab-content-engine',
    promptId: compiled.promptId,
    promptVersion: compiled.promptVersion,
    blueprint: compiled.blueprintId,
    contentType: compiled.brief.contentType,
    title,
    summary: 'A practical guide to recording accrued costs at a small tile maker, showing how to estimate, record and reverse an accrual at the year end.',
    keyTerms: ['accrued expense', 'matching', 'year-end estimate', 'reversal'],
    validAsAt: compiled.brief.validAsAt ?? null,
    sourceSectionsCovered: compiled.source ? compiled.source.sections.map(s => s.id) : [],
  }
}

/** A valid document answer: every section with its required blocks, at the middle of its word range. */
export function documentOutput(compiled: CompiledPrompt, title = 'Accrued costs at a small tile maker'): DocumentOutput {
  const choice = blueprintFor(compiled.brief.contentType)
  const related = compiled.brief.relatedNotes ?? []
  const sections = sectionsFor(choice)
    .filter(s => s.id !== 'related-notes' || related.length > 0)
    .map((s, i) => {
      const blocks: Block[] = s.id === 'related-notes'
        ? [{ type: 'list', style: 'bullet', items: related.map(n => `${n.title}: ${n.path}`) }]
        : s.requiredBlockTypes.map(sampleBlock)
      const target = Math.round((s.minWords + s.maxWords) / 2)
      const fill = Math.max(0, target - blockWords(blocks))
      return { id: s.id, blocks: [...blocks, ...paragraphs(fill, i * 37)] }
    })
  return { ...envelope(compiled, title), document: { sections } }
}

/** A valid explainer answer of about the given number of words. */
export function explainerOutput(compiled: CompiledPrompt, words = 650): ExplainerOutput {
  const fixed: Block[] = [
    { type: 'heading', level: 2, text: 'What this question tests' },
    sampleBlock('journal_entry'),
    sampleBlock('common_mistake'),
    sampleBlock('key_point'),
  ]
  const fill = Math.max(0, words - blockWords(fixed))
  return { ...envelope(compiled, 'Explaining an accrual for unbilled electricity'), explainer: { blocks: [...fixed, ...paragraphs(fill, 11)] } }
}

const NOUNS = ['electricity', 'gas', 'water', 'rent', 'cleaning', 'insurance', 'security', 'maintenance', 'postage', 'telephone', 'waste', 'haulage', 'glaze', 'clay', 'packaging', 'software', 'training', 'laundry', 'courier', 'audit', 'legal', 'advertising', 'parking', 'catering', 'storage']

/** A valid question-set answer with balanced answer positions. */
export function questionSetOutput(compiled: CompiledPrompt): QuestionSetOutput {
  const count = compiled.expected.questionCount ?? 10
  const big = (compiled.source?.sections ?? []).filter(s => s.words >= 40).map(s => s.id)
  const sources = big.length ? big : ['s1']
  const questions: Question[] = []
  for (let i = 0; i < count; i++) {
    const noun = NOUNS[i % NOUNS.length]
    const amount = `£${(1000 + i * 137).toLocaleString('en-GB')}.${String(10 + i).slice(-2)}`
    const correct = `Debit ${noun} expense ${amount} and credit accruals ${amount}`
    const wrong = [
      `Debit accruals ${amount} and credit ${noun} expense ${amount}`,
      `Debit prepayments ${amount} and credit ${noun} expense ${amount}`,
      `Record nothing until the ${noun} invoice arrives`,
    ]
    const position = i % 4
    const options = [...wrong]
    options.splice(position, 0, correct)
    questions.push({
      id: `q${i + 1}`,
      type: 'multiple-choice',
      questionText: `Hollin Brook Pottery used ${noun} services costing ${amount} in month ${i + 1} of its year, and the invoice arrives ${i + 3} weeks after the year end. Which entry records the ${noun} cost at the year end?`,
      options,
      correctIndex: position,
      explanation: `${prose(130, i * 13)} Remember: a ${noun} cost belongs to the period in which the business used it.`,
      writingModelAnswer: null,
      writingExplanation: null,
      caseId: null,
      primaryTopic: 'Accrued expenses',
      difficulty: 'intermediate',
      timeTargetMinutes: 2,
      points: 2,
      sourceSection: sources[i % sources.length],
    })
  }
  return { ...envelope(compiled, 'Practice questions on accrued costs'), questionSet: { questions } }
}
