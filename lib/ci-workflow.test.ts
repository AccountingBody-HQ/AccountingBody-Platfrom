import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8')

describe('CI workflow', () => {
  it('CI checks lint, types, tests and the production build', () => {
    const commands = [
      'run: npm ci',
      'run: npm run lint',
      'run: npx tsc --noEmit',
      'run: npm test',
      'run: npm run build',
    ]
    const positions = commands.map((command) => workflow.indexOf(command))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('runs with a time limit and read-only permissions', () => {
    expect(workflow).toMatch(/^ {4}timeout-minutes: \d+$/m)
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m)
  })

  it('uses placeholder configuration only', () => {
    expect(workflow).not.toContain('secrets.')
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_URL: https://placeholder.invalid')
  })

  it('cancels superseded runs for pull requests only', () => {
    expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
  })
})
