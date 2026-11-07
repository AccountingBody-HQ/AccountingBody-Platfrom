import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CHECKS,
  DAILY_GRACE_MS,
  IMPORT_WINDOW_MS,
  PENDING_SUBSCRIBER_MAX_AGE_MS,
  SAVED_JOB_MAX_AGE_MS,
  cutoffs,
  judgeDue,
  judgeRuns,
  neutralAttention,
  summarise,
  type CheckName,
  type CheckWord,
} from './ops-status'
import { SAVED_JOBS_RETENTION_DAYS } from './saved-jobs'

const NOW = Date.parse('2026-11-07T12:00:00.000Z')
const SECOND = 1000
const HOUR = 60 * 60 * SECOND
const DAY = 24 * HOUR
const at = (ago: number) => new Date(NOW - ago).toISOString()

const ALL_OK: Record<CheckName, CheckWord> = {
  'job-import': 'ok',
  'job-expiry': 'ok',
  'subscriber-cleanup': 'ok',
  'saved-jobs-cleanup': 'ok',
}
const WORDS: CheckWord[] = ['ok', 'late', 'failing', 'unknown']

describe('time allowances', () => {
  it('uses the stated allowances', () => {
    expect(IMPORT_WINDOW_MS).toBe(26 * HOUR)
    expect(DAILY_GRACE_MS).toBe(26 * HOUR)
    expect(PENDING_SUBSCRIBER_MAX_AGE_MS).toBe(7 * DAY)
    expect(SAVED_JOB_MAX_AGE_MS).toBe(SAVED_JOBS_RETENTION_DAYS * DAY)
  })

  it('matches the age the subscriber clean-up route uses', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/cron/prune-pending-subscribers/route.ts'), 'utf8')
    expect(source).toContain('const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000')
  })

  it('works out every cut-off from one clock reading', () => {
    expect(cutoffs(NOW)).toStrictEqual({
      importSince: at(26 * HOUR),
      expiryBefore: at(26 * HOUR),
      subscriberBefore: at(7 * DAY + 26 * HOUR),
      savedJobBefore: at(7 * DAY + 26 * HOUR),
    })
  })
})

describe('import runs', () => {
  it('answers ok when a run completed recently', () => {
    expect(judgeRuns([{ status: 'completed', started_at: at(HOUR) }], NOW)).toBe('ok')
  })

  it('answers ok for a run started exactly at the edge of the window', () => {
    expect(judgeRuns([{ status: 'completed', started_at: at(IMPORT_WINDOW_MS) }], NOW)).toBe('ok')
  })

  it('answers late for a run started one second before the window', () => {
    expect(judgeRuns([{ status: 'completed', started_at: at(IMPORT_WINDOW_MS + SECOND) }], NOW)).toBe('late')
  })

  it('answers failing when every recent run failed', () => {
    expect(judgeRuns([{ status: 'failed', started_at: at(HOUR) }], NOW)).toBe('failing')
  })

  it('answers ok when a completed run sits beside failed ones', () => {
    expect(
      judgeRuns(
        [
          { status: 'failed', started_at: at(SECOND) },
          { status: 'completed', started_at: at(2 * HOUR) },
        ],
        NOW,
      ),
    ).toBe('ok')
  })

  it('answers late when only an old failure is found', () => {
    expect(judgeRuns([{ status: 'failed', started_at: at(IMPORT_WINDOW_MS + SECOND) }], NOW)).toBe('late')
  })

  it('answers late when no run is found', () => {
    expect(judgeRuns([], NOW)).toBe('late')
  })

  it('answers late for a run still in progress or with an unreadable time', () => {
    expect(judgeRuns([{ status: 'running', started_at: at(SECOND) }], NOW)).toBe('late')
    expect(judgeRuns([{ status: 'completed', started_at: 'not a time' }], NOW)).toBe('late')
    expect(judgeRuns([{ status: 'completed' }], NOW)).toBe('late')
  })

  it('answers unknown when the runs could not be read', () => {
    expect(judgeRuns(null, NOW)).toBe('unknown')
  })
})

describe('rows due for a clean-up', () => {
  const allowance = 7 * DAY + DAILY_GRACE_MS

  it('answers ok when nothing is due', () => {
    expect(judgeDue([], 'last_seen_at', NOW, allowance)).toBe('ok')
  })

  it('answers ok for a row exactly at the allowance', () => {
    expect(judgeDue([{ last_seen_at: at(allowance) }], 'last_seen_at', NOW, allowance)).toBe('ok')
  })

  it('answers late for a row one second past the allowance', () => {
    expect(judgeDue([{ last_seen_at: at(allowance + SECOND) }], 'last_seen_at', NOW, allowance)).toBe('late')
  })

  it('reads the named column only', () => {
    expect(judgeDue([{ other: at(allowance + DAY) }], 'last_seen_at', NOW, allowance)).toBe('ok')
  })

  it('answers unknown when the rows could not be read', () => {
    expect(judgeDue(null, 'last_seen_at', NOW, allowance)).toBe('unknown')
  })
})

describe('the overall answer', () => {
  it('answers 200 ok when every check is ok', () => {
    expect(summarise(ALL_OK)).toStrictEqual({ httpStatus: 200, body: { status: 'ok', checks: ALL_OK } })
  })

  const alerting = CHECKS.filter((check) => check.alerting).map((check) => check.name)
  const quiet = CHECKS.filter((check) => !check.alerting).map((check) => check.name)

  it('lists the job expiry check as shown but not alerting', () => {
    expect(quiet).toStrictEqual(['job-expiry'])
    expect(alerting).toStrictEqual(['job-import', 'subscriber-cleanup', 'saved-jobs-cleanup'])
  })

  for (const name of alerting) {
    for (const word of WORDS.filter((w) => w !== 'ok')) {
      it(`answers 503 attention when ${name} is ${word}`, () => {
        const answer = summarise({ ...ALL_OK, [name]: word })
        expect(answer.httpStatus).toBe(503)
        expect(answer.body.status).toBe('attention')
        expect(answer.body.checks[name]).toBe(word)
      })
    }
  }

  for (const name of quiet) {
    for (const word of WORDS) {
      it(`shows ${name} as ${word} without turning the status red`, () => {
        const answer = summarise({ ...ALL_OK, [name]: word })
        expect(answer).toStrictEqual({ httpStatus: 200, body: { status: 'ok', checks: { ...ALL_OK, [name]: word } } })
      })
    }
  }

  it('answers unknown for a check with no word', () => {
    const words = { ...ALL_OK } as Partial<Record<CheckName, CheckWord>>
    delete words['job-import']
    const answer = summarise(words as Record<CheckName, CheckWord>)
    expect(answer.httpStatus).toBe(503)
    expect(answer.body.checks['job-import']).toBe('unknown')
  })

  it('answers a neutral 503 when the checks could not be completed', () => {
    expect(neutralAttention()).toStrictEqual({ httpStatus: 503, body: { status: 'attention', checks: {} } })
    expect(neutralAttention()).not.toBe(neutralAttention())
  })
})
