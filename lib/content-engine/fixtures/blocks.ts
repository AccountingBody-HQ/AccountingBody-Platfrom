// One valid block of each type, in BLOCK_TYPES order. Invented content.
import type { Block } from '../types'

export const ONE_OF_EACH: Block[] = [
  { type: 'heading', level: 2, text: 'Accruals in practice' },
  { type: 'paragraph', text: 'An accrual records an expense in the period it is **incurred**.' },
  { type: 'definition', term: 'Accrual', text: 'An expense incurred but not yet paid.' },
  { type: 'worked_example', title: 'Brightwater Mills', scenario: 'An invoice of £3,417 arrives after year end.', steps: ['Find the period.', 'Record the expense.'], answer: 'Accrue £3,417.' },
  { type: 'calculation', title: 'Accrued rent', steps: [{ label: 'Monthly rent', working: '£12,684 / 12', result: '£1,057' }] },
  { type: 'journal_entry', title: 'Year-end accrual', narrative: 'Being rent for March.', lines: [{ account: 'Rent expense', debit: 1057, credit: null }, { account: 'Accruals', debit: null, credit: 1057 }] },
  { type: 'table', caption: 'Balances', columns: ['Account', 'Amount'], rows: [['Accruals', '£1,057']] },
  { type: 'key_point', text: 'Match the cost to the period.' },
  { type: 'common_mistake', mistake: 'Recording the cost when paid.', correction: 'Record it when incurred.' },
  { type: 'exam_tip', text: 'Read the dates first.' },
  { type: 'check_understanding', question: 'When is rent for March recorded?', answer: 'In March.' },
  { type: 'takeaway', points: ['Accrue what you owe.', 'Reverse it next period.'] },
  { type: 'list', style: 'bullet', items: ['Invoices', 'Contracts'] },
]
