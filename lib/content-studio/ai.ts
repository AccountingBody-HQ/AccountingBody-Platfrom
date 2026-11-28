// "Generate here": one request to the AI per call. The key is read and the
// client made inside the call (CLAUDE.md §5). Neither the prompt nor the
// answer is ever logged or reported.
import Anthropic from '@anthropic-ai/sdk'
import { reportServerError } from '@/lib/report-error'
import { AI_TIMEOUT_MS, STUDIO_MODEL } from './config'

export type AiAnswer =
  | { ok: true; text: string; stopReason: string | null; inputTokens: number | null; outputTokens: number | null }
  | { ok: false }

export async function askAi(text: string, maxTokens: number): Promise<AiAnswer> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { ok: false }
  try {
    const client = new Anthropic({ apiKey: key, timeout: AI_TIMEOUT_MS, maxRetries: 0 })
    const message = await client.messages.create({
      model: STUDIO_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: text }],
    })
    const answer = message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
    if (answer.trim() === '') {
      const empty = new Error('empty answer')
      reportServerError('admin content studio AI answer empty', empty, { area: 'admin' })
      return { ok: false }
    }
    return {
      ok: true,
      text: answer,
      stopReason: message.stop_reason ?? null,
      inputTokens: message.usage?.input_tokens ?? null,
      outputTokens: message.usage?.output_tokens ?? null,
    }
  } catch (error) {
    reportServerError('admin content studio AI call failed', error, { area: 'admin' })
    return { ok: false }
  }
}
