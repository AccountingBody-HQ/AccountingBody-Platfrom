import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ARTICLE_RULE, CORRECT_INDEX_RULE } from './question-publish-checks'

// migrations/0029 (PQ-1e, D338/D339): the text of the record file. It is
// written here and run only by an owner-approved database job.

const FILE = 'migrations/0029_question_tables_guards.sql'
const text = readFileSync(join(process.cwd(), FILE), 'utf8')
const lines = text.split('\n')
const comments = lines.filter((line) => line.startsWith('--')).join('\n')
const code = lines.filter((line) => line.trim() && !line.startsWith('--')).join('\n')
const block = (name: string) => code.split(`$${name}$`)[1] ?? ''
const statements = code
  .replace(/DO \$(\w+)\$[\s\S]*?\$\1\$;/g, 'DO $1;')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const NAMES = ['question_sets_article_slug_key', 'questions_set_id_idx', 'question_cases_set_id_idx', 'questions_correct_index_range']

describe('migrations/0029 (record file)', () => {
  it('is in the README as not applied yet, the only such row, and its tables are in the scope list', () => {
    const readme = readFileSync(join(process.cwd(), 'migrations/README.md'), 'utf8')
    const waiting = readme.split('\n').filter((line) => line.includes('not applied yet'))
    expect(waiting).toHaveLength(1)
    expect(waiting[0]).toContain('| `0029_question_tables_guards.sql` | **Record file, not applied yet (PQ-1e, D339).**')
    const scope = readme.slice(readme.indexOf('Migrations in this directory cover only'), readme.indexOf('## Files'))
    expect(scope).toContain('\nquestion_sets  questions  question_cases\n')
    expect(scope.match(/owner approval D339/g)).toHaveLength(3)
  })

  it('is the only 0029 file', () => {
    const files = execFileSync('git', ['ls-files', 'migrations'], { encoding: 'utf8' }).split('\n')
    expect(files.filter((file) => file.startsWith('migrations/0029'))).toEqual([FILE])
  })

  it('is one transaction with time limits, guards first and checks last, and nothing else', () => {
    expect(statements).toEqual([
      'BEGIN;',
      "SET LOCAL statement_timeout = '30s';",
      "SET LOCAL lock_timeout = '5s';",
      'DO guard;',
      'ALTER TABLE public.questions ADD CONSTRAINT questions_correct_index_range CHECK (correct_index IS NULL OR correct_index BETWEEN 0 AND 3);',
      "CREATE UNIQUE INDEX question_sets_article_slug_key ON public.question_sets (article_slug) WHERE article_slug IS NOT NULL AND article_slug <> '';",
      'CREATE INDEX questions_set_id_idx ON public.questions (set_id);',
      'CREATE INDEX question_cases_set_id_idx ON public.question_cases (set_id);',
      'DO check;',
      "SELECT 'qg|created|indexes|3|constraints|1|rows_changed|0';",
      'COMMIT;',
    ])
  })

  it('changes no row and removes nothing', () => {
    expect(code).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP|GRANT|REVOKE)\b/i)
  })

  it('stops before any change when something is not as expected', () => {
    const guard = block('guard')
    for (const name of NAMES) expect(guard).toContain(`'${name}'`)
    for (const part of [
      "current_user <> 'postgres'",
      'c.relname = x',
      'conname = x',
      "article_slug IS NOT NULL AND article_slug <> '' GROUP BY article_slug HAVING count(*) > 1",
      'correct_index IS NOT NULL AND correct_index NOT BETWEEN 0 AND 3',
    ]) expect(guard).toContain(part)
    expect(guard.match(/RAISE EXCEPTION 'qg_stop: [^']+ - nothing was changed'/g)).toHaveLength(4)
  })

  it('rolls back unless each of the four parts is exactly as meant', () => {
    const check = block('check')
    for (const meant of [
      "'CREATE UNIQUE INDEX question_sets_article_slug_key ON public.question_sets USING btree (article_slug) WHERE ((article_slug IS NOT NULL) AND (article_slug <> ''''::text))'",
      "'CREATE INDEX questions_set_id_idx ON public.questions USING btree (set_id)'",
      "'CREATE INDEX question_cases_set_id_idx ON public.question_cases USING btree (set_id)'",
      "'CHECK (((correct_index IS NULL) OR ((correct_index >= 0) AND (correct_index <= 3))))'",
    ]) expect(check).toContain(meant)
    expect(check).toContain('pg_get_indexdef')
    expect(check).toContain('pg_get_constraintdef')
    expect(check).toContain('indisvalid')
    expect(check.match(/IS DISTINCT FROM/g)).toHaveLength(2)
    expect(check.match(/RAISE EXCEPTION 'qg_check_failed: /g)).toHaveLength(2)
  })

  it('uses the names the routes know', () => {
    expect(NAMES).toContain(ARTICLE_RULE)
    expect(NAMES).toContain(CORRECT_INDEX_RULE)
  })

  it('says why, what it does not do, its size, how it is run and how it is undone', () => {
    for (const words of ['D338', 'D339', 'NOT APPLIED', 'WHY:', 'WHAT IT DOES NOT DO:', 'SIZE:', 'RUN: once, as postgres, through stdin', 'after a fresh backup', 'BEFORE the PQ-1 pull']) {
      expect(comments).toContain(words)
    }
    expect(lines.filter((line) => line.startsWith('--   DROP') || line.startsWith('--   ALTER'))).toEqual([
      '--   DROP INDEX IF EXISTS public.question_sets_article_slug_key;',
      '--   DROP INDEX IF EXISTS public.questions_set_id_idx;',
      '--   DROP INDEX IF EXISTS public.question_cases_set_id_idx;',
      '--   ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_correct_index_range;',
    ])
  })
})
