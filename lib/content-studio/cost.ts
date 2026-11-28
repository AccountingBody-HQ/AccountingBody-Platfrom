// The "up to" cost shown next to "Generate here": every step's input (about
// four characters a token) plus the full output allowance, rounded up to the cent.
import { PRICE_INPUT_USD_PER_MTOK, PRICE_OUTPUT_USD_PER_MTOK } from './config'

/** Room in a later step's prompt for the list of earlier questions. */
export const LATER_STEP_EXTRA_CHARS = 4000

export function estimateUsd(stepInputChars: number[], maxOutputTokens: number): number {
  // In millionths of a dollar: whole numbers, so no rounding drift.
  let micro = 0
  for (const chars of stepInputChars) {
    micro += Math.ceil(Math.max(0, chars) / 4) * PRICE_INPUT_USD_PER_MTOK + maxOutputTokens * PRICE_OUTPUT_USD_PER_MTOK
  }
  return Math.ceil(micro / 10000) / 100
}

/** The input sizes of the steps of a set whose first prompt has this many characters. */
export function stepInputSizes(firstChars: number, steps: number): number[] {
  return Array.from({ length: Math.max(0, steps) }, (_, i) => (i === 0 ? firstChars : firstChars + LATER_STEP_EXTRA_CHARS))
}

export function formatUsd(x: number): string {
  return `$${x.toFixed(2)}`
}
