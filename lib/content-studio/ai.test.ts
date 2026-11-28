import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  clients: [] as unknown[],
  calls: [] as unknown[],
  answer: null as unknown,
  throws: null as Error | null,
  reports: [] as unknown[][],
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async (params: unknown) => {
        state.calls.push(params)
        if (state.throws) throw state.throws
        return state.answer
      },
    }
    constructor(options: unknown) {
      state.clients.push(options)
    }
  },
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: (...args: unknown[]) => state.reports.push(args) }))

import { askAi } from './ai'

const PROMPT = 'Invented prompt text that must never be reported.'

beforeEach(() => {
  state.clients = []
  state.calls = []
  state.reports = []
  state.throws = null
  state.answer = {
    content: [{ type: 'text', text: '{"a":' }, { type: 'thinking', thinking: 'x' }, { type: 'text', text: '1}' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  }
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-not-real')
})
afterEach(() => vi.unstubAllEnvs())

describe('askAi', () => {
  it('makes one call with the fixed model and one user message holding the text', async () => {
    const answer = await askAi(PROMPT, 12000)
    expect(answer).toEqual({ ok: true, text: '{"a":1}', stopReason: 'end_turn', inputTokens: 10, outputTokens: 5 })
    expect(state.calls).toEqual([{ model: 'claude-sonnet-4-6', max_tokens: 12000, messages: [{ role: 'user', content: PROMPT }] }])
    expect(state.clients).toEqual([{ apiKey: 'test-key-not-real', timeout: 270000, maxRetries: 0 }])
  })

  it('makes a new client for every call', async () => {
    await askAi(PROMPT, 4000)
    await askAi(PROMPT, 4000)
    expect(state.clients).toHaveLength(2)
  })

  it('makes no call without a key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(await askAi(PROMPT, 4000)).toEqual({ ok: false })
    expect(state.clients).toHaveLength(0)
    expect(state.calls).toHaveLength(0)
  })

  it('answers not ok on an error or an empty answer, and never reports the text', async () => {
    state.throws = new Error('invented timeout')
    expect(await askAi(PROMPT, 4000)).toEqual({ ok: false })
    state.throws = null
    state.answer = { content: [{ type: 'text', text: '  ' }], stop_reason: 'max_tokens', usage: {} }
    expect(await askAi(PROMPT, 4000)).toEqual({ ok: false })
    expect(state.reports.map(r => [r[0], r[2]])).toEqual([
      ['admin content studio AI call failed', { area: 'admin' }],
      ['admin content studio AI answer empty', { area: 'admin' }],
    ])
    expect(JSON.stringify(state.reports.map(r => [r[0], String(r[1]), r[2]]))).not.toContain(PROMPT)
  })
})
