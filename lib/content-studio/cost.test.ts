import { describe, expect, it } from 'vitest'
import * as config from './config'
import { estimateUsd, formatUsd, stepInputSizes } from './cost'

describe('the settings', () => {
  it('are the agreed values', () => {
    expect(config).toMatchObject({
      STUDIO_MODEL: 'claude-sonnet-4-6',
      OUTSIDE_AI_MODEL: 'outside-ai',
      MAX_OUTPUT_TOKENS_QUESTIONS: 12000,
      MAX_OUTPUT_TOKENS_REVIEW: 4000,
      AI_TIMEOUT_MS: 270000,
      PRICE_INPUT_USD_PER_MTOK: 3,
      PRICE_OUTPUT_USD_PER_MTOK: 15,
      PLAN_PAGE_SIZE: 10,
      MAX_ANSWER_CHARS: 300000,
      MAX_STEPS: 3,
    })
  })
})

describe('estimateUsd', () => {
  it('adds every step input and the full output allowance', () => {
    // 40,000 chars = 10,000 tokens x $3 = $0.03; 12,000 x $15 = $0.18.
    expect(estimateUsd([40000], 12000)).toBe(0.21)
    // Second step: 11,000 tokens x $3 + $0.18 = $0.213; together $0.423, rounded up.
    expect(estimateUsd([40000, 44000], 12000)).toBe(0.43)
  })

  it('rounds up to the cent', () => {
    // 4 chars = 1 token = $0.000003; 1 output token = $0.000015.
    expect(estimateUsd([4], 1)).toBe(0.01)
    expect(estimateUsd([], 0)).toBe(0)
    // 0.42 exactly stays 0.42: 20,000 x $15 + 40,000 x $3 = 0.3 + 0.12.
    expect(estimateUsd([160000], 20000)).toBe(0.42)
  })

  it('counts part tokens as whole tokens', () => {
    expect(estimateUsd([5], 0)).toBe(0.01)
    expect(estimateUsd([13333336], 0)).toBe(10.01)
  })
})

describe('stepInputSizes and formatUsd', () => {
  it('gives later steps 4,000 more characters', () => {
    expect(stepInputSizes(1000, 1)).toEqual([1000])
    expect(stepInputSizes(1000, 2)).toEqual([1000, 5000])
    expect(stepInputSizes(1000, 0)).toEqual([])
  })

  it('writes dollars with two decimals', () => {
    expect(formatUsd(0.42)).toBe('$0.42')
    expect(formatUsd(1)).toBe('$1.00')
    expect(formatUsd(0.4)).toBe('$0.40')
    expect(formatUsd(12.5)).toBe('$12.50')
  })
})
