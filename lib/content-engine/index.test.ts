import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as api from './index'
import { ARTICLE_BRIEF } from './fixtures/briefs'
import { documentOutput } from './fixtures/outputs'

const PUBLIC_NAMES = [
  'BLOCK_TYPES', 'BLUEPRINTS', 'BLUEPRINT_IDS', 'BODY_NAMES', 'BODY_NAME_RULE', 'CHECK_ORDER', 'CONTENT_TYPES',
  'DIFFICULTIES', 'ENGINE_NAME', 'ENGINE_VERSION', 'ETICPA_LEVELS', 'ETICPA_MODULES', 'JURISDICTIONS', 'LEVEL_IDS',
  'PACKS', 'PACKS_FINGERPRINT', 'SUBJECT_KEYS',
  'blocksToText', 'blueprintFor', 'compilePrompt', 'compileReviewerPrompt', 'countWords', 'extractJson', 'isCompiled',
  'renderBlocks', 'runGate', 'sourceFromHtml', 'subjectContext', 'toSubjectKey', 'validateBlocks', 'validateBrief',
]

describe('public API', () => {
  it('exports exactly the agreed names, nothing more', () => {
    expect(Object.keys(api).sort()).toEqual([...PUBLIC_NAMES].sort())
  })

  it('index.ts holds re-exports only', () => {
    const source = readFileSync(path.join(__dirname, 'index.ts'), 'utf8')
    const code = source.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('//'))
    const joined = code.join('\n')
    expect(joined).not.toMatch(/\b(function|const|let|var|class)\b/)
    expect(joined.replace(/export (type )?\{[^}]*\} from '[^']+'/g, '').trim()).toBe('')
  })

  it('runs end to end: compile, check the answer, render it', () => {
    const compiled = api.compilePrompt(ARTICLE_BRIEF)
    if (!api.isCompiled(compiled)) throw new Error('not compiled')
    const card = api.runGate(JSON.stringify(documentOutput(compiled)), compiled)
    expect(card.ok).toBe(true)
    expect(card.score).toBe(100)
    const output = card.output
    if (!output || !('document' in output)) throw new Error('no document')
    const html = api.renderBlocks(output.document.sections[0].blocks)
    expect(html.startsWith('<p class="ce-paragraph">')).toBe(true)
  })
})
