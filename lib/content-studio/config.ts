// The Content Studio's settings (D379). STUDIO_MODEL is the one setting to
// change when the site moves to another AI model.

export const STUDIO_MODEL = 'claude-sonnet-4-6'
/** The model recorded for "Copy prompt", where the owner chose the AI. */
export const OUTSIDE_AI_MODEL = 'outside-ai'
/** Per step of at most ten questions. */
export const MAX_OUTPUT_TOKENS_QUESTIONS = 12000
export const MAX_OUTPUT_TOKENS_REVIEW = 4000
/** Under the generate route's 300-second limit. */
export const AI_TIMEOUT_MS = 270000
/** Estimates only, used for the "up to" cost shown on the screen. */
export const PRICE_INPUT_USD_PER_MTOK = 3
export const PRICE_OUTPUT_USD_PER_MTOK = 15
export const PLAN_PAGE_SIZE = 10
/** Per pasted answer or step answer, in characters. */
export const MAX_ANSWER_CHARS = 300000
export const MAX_STEPS = 3
