import { describe, expect, it } from 'vitest'
import { blocksToText, countWords, describePath, validateBlocks } from './blocks'
import { ONE_OF_EACH } from './fixtures/blocks'
import { BLOCK_TYPES } from './types'

function checks(value: unknown) {
  return validateBlocks(value, 'document.sections[0].blocks').findings.map(f => `${f.check}@${f.path}`)
}

describe('validateBlocks', () => {
  it('accepts one valid block of each of the 13 types, unchanged', () => {
    expect(ONE_OF_EACH.map(b => b.type)).toEqual([...BLOCK_TYPES])
    const copy = JSON.parse(JSON.stringify(ONE_OF_EACH))
    const result = validateBlocks(copy, 'document.sections[0].blocks')
    expect(result.findings).toEqual([])
    expect(result.blocks).toEqual(ONE_OF_EACH)
    expect(copy).toEqual(ONE_OF_EACH)
  })

  it('rejects a value that is not a list', () => {
    expect(checks({})).toEqual(['blocks.shape@document.sections[0].blocks'])
  })

  it('rejects an unknown block type, a missing field and an extra field', () => {
    expect(checks([{ type: 'video', url: 'x' }])).toEqual(['blocks.shape@document.sections[0].blocks[0]'])
    expect(checks([{ type: 'paragraph' }])).toEqual(['blocks.shape@document.sections[0].blocks[0]'])
    expect(checks([{ type: 'paragraph', text: 'Fine.', style: 'x' }])).toEqual(['blocks.shape@document.sections[0].blocks[0]'])
  })

  it('names the exact place of a bad nested field', () => {
    expect(checks([{ type: 'worked_example', title: 'T', scenario: 'S', steps: ['one', 7], answer: 'A' }]))
      .toEqual(['blocks.shape@document.sections[0].blocks[0].steps[1]'])
  })

  it('applies the text limits: empty, whitespace-only and over 1,200 characters', () => {
    expect(checks([{ type: 'paragraph', text: '' }])).toEqual(['blocks.shape@document.sections[0].blocks[0].text'])
    expect(checks([{ type: 'paragraph', text: '   ' }])).toEqual(['blocks.shape@document.sections[0].blocks[0].text'])
    expect(checks([{ type: 'paragraph', text: 'x'.repeat(1200) }])).toEqual([])
    expect(checks([{ type: 'paragraph', text: 'x'.repeat(1201) }])).toEqual(['blocks.shape@document.sections[0].blocks[0].text'])
  })

  it('reports any < or > in text as markup', () => {
    expect(checks([{ type: 'paragraph', text: 'Use <b>bold</b>' }])).toEqual(['blocks.markup@document.sections[0].blocks[0].text'])
    expect(checks([{ type: 'key_point', text: 'a > b' }])).toEqual(['blocks.markup@document.sections[0].blocks[0].text'])
  })

  it('applies the list limits of each block type', () => {
    expect(checks([{ type: 'takeaway', points: ['only one'] }])).toEqual(['blocks.shape@document.sections[0].blocks[0].points'])
    expect(checks([{ type: 'list', style: 'bullet', items: Array(13).fill('x') }])).toEqual(['blocks.shape@document.sections[0].blocks[0].items'])
    expect(checks([{ type: 'list', style: 'dash', items: ['a', 'b'] }])).toEqual(['blocks.shape@document.sections[0].blocks[0].style'])
    expect(checks([{ type: 'heading', level: 4, text: 'Too deep' }])).toEqual(['blocks.shape@document.sections[0].blocks[0].level'])
    expect(checks([{ type: 'calculation', title: 'T', steps: [] }])).toEqual(['blocks.shape@document.sections[0].blocks[0].steps'])
    expect(checks([{ type: 'calculation', title: 'T', steps: [{ label: 'a', working: 'b' }] }])).toEqual(['blocks.shape@document.sections[0].blocks[0].steps[0].result'])
  })

  it('checks that every table row has one cell per column', () => {
    expect(checks([{ type: 'table', caption: 'C', columns: ['A', 'B'], rows: [['1', '2', '3']] }])).toEqual(['blocks.shape@document.sections[0].blocks[0].rows[0]'])
    expect(checks([{ type: 'table', caption: 'C', columns: ['A'], rows: [['1']] }])).toEqual(['blocks.shape@document.sections[0].blocks[0].columns'])
  })

  describe('journal entries', () => {
    const entry = (lines: unknown) => [{ type: 'journal_entry', title: 'J', lines }]

    it('balances to the penny', () => {
      expect(checks(entry([{ account: 'A', debit: 0.1, credit: null }, { account: 'B', debit: 0.2, credit: null }, { account: 'C', debit: null, credit: 0.3 }]))).toEqual([])
    })

    it('reports an unbalanced entry once, at the block', () => {
      expect(checks(entry([{ account: 'A', debit: 100, credit: null }, { account: 'B', debit: null, credit: 99.99 }]))).toEqual(['blocks.journal@document.sections[0].blocks[0]'])
    })

    it('needs exactly one side above zero on every line', () => {
      expect(checks(entry([{ account: 'A', debit: 5, credit: 5 }, { account: 'B', debit: null, credit: 5 }]))).toEqual(['blocks.journal@document.sections[0].blocks[0].lines[0]'])
      expect(checks(entry([{ account: 'A', debit: 0, credit: null }, { account: 'B', debit: null, credit: 0 }]))).toEqual([
        'blocks.journal@document.sections[0].blocks[0].lines[0]',
        'blocks.journal@document.sections[0].blocks[0].lines[1]',
      ])
    })

    it('reports a non-number amount as a shape problem', () => {
      expect(checks(entry([{ account: 'A', debit: '5', credit: null }, { account: 'B', debit: null, credit: 5 }]))).toContain('blocks.shape@document.sections[0].blocks[0].lines[0].debit')
    })

    it('needs 2 to 12 lines', () => {
      expect(checks(entry([{ account: 'A', debit: 5, credit: null }]))).toEqual(['blocks.shape@document.sections[0].blocks[0].lines'])
    })
  })

  it('writes one plain-English sentence naming the place', () => {
    const [finding] = validateBlocks([{ type: 'paragraph', text: '' }], 'document.sections[2].blocks').findings
    expect(finding.message).toBe('Section 3, block 1, the "text" field: is empty.')
    expect(finding.severity).toBe('error')
  })

  it('never throws on junk', () => {
    const junk: unknown[] = [null, 1, 'x', [null], [[]], [{ type: null }], [{ type: 'table', caption: 'c', columns: 'ab', rows: 'x' }]]
    for (const value of junk) expect(() => validateBlocks(value, 'x')).not.toThrow()
  })
})

describe('describePath', () => {
  it('turns paths into places', () => {
    expect(describePath('document.sections[2].blocks[4].steps[1]')).toBe('Section 3, block 5, step 2')
    expect(describePath('explainer.blocks[0]')).toBe('Block 1')
    expect(describePath('questionSet.questions[6].options[2]')).toBe('Question 7, option 3')
    expect(describePath('')).toBe('The answer')
  })
})

describe('blocksToText and countWords', () => {
  it('collects every text of every block', () => {
    const text = blocksToText(ONE_OF_EACH)
    for (const needle of ['Accruals in practice', 'Brightwater Mills', 'Monthly rent', 'Rent expense', 'Being rent for March.', 'Contracts']) {
      expect(text).toContain(needle)
    }
  })

  it('counts words by whitespace, and an empty text as 0', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords(' one  two\nthree\tfour ')).toBe(4)
  })
})
