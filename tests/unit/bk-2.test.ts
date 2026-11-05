import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * AB-P0-5: the real backup script, in automatic mode, with a stand-in psql that records what it was given and then answers
 * as Supabase does when it refuses a password. Nothing connects to anything: the script stops at the connection check.
 */

const REF = 'abcdefghijklmnopqrst'
const POOLER = 'aws-0-eu-west-2.pooler.supabase.com'
const url = (password: string, rest = `${POOLER}:5432/postgres`, user = `postgres.${REF}`) => `postgresql://${user}:${password}@${rest}`

const box = mkdtempSync(join(tmpdir(), 'ab-bk2-'))
mkdirSync(join(box, 'scripts/lib'), { recursive: true })
mkdirSync(join(box, 'bin'))
copyFileSync('scripts/backup-supabase.sh', join(box, 'scripts/backup-supabase.sh'))
copyFileSync('scripts/lib/backup-connect.sh', join(box, 'scripts/lib/backup-connect.sh'))
writeFileSync(
  join(box, 'bin/psql'),
  `#!/bin/bash
printf '%s' "$PGPASSWORD" >"${box}/seen-password"
printf '%s' "$PGSSLMODE" >"${box}/seen-sslmode"
printf '%s' "$*" >"${box}/seen-args"
echo 'psql: error: connection to server at "${POOLER}" (3.8.1.2), port 5432 failed: FATAL:  password authentication failed for user "postgres"' >&2
exit 2
`,
)
chmodSync(join(box, 'bin/psql'), 0o755)
afterAll(() => rmSync(box, { recursive: true, force: true }))

function run(dbUrl: string, extraEnv: Record<string, string> = {}) {
  for (const f of ['seen-password', 'seen-sslmode', 'seen-args']) rmSync(join(box, f), { force: true })
  const r = spawnSync('bash', [join(box, 'scripts/backup-supabase.sh')], {
    encoding: 'utf8',
    env: {
      PATH: `${join(box, 'bin')}:${process.env.PATH}`,
      HOME: box,
      NODE_ENV: 'test',
      AB_BACKUP_DB_URL: dbUrl,
      AB_BACKUP_SERVICE_ROLE_KEY: 'sb_secret_fake-key-for-a-test',
      AB_BACKUP_PASSPHRASE: 'fake backup passphrase long enough 42',
      ...extraEnv,
    },
  })
  return {
    status: r.status,
    output: `${r.stdout}${r.stderr}`,
    password: existsSync(join(box, 'seen-password')) ? readFileSync(join(box, 'seen-password'), 'utf8') : null,
    sslmode: existsSync(join(box, 'seen-sslmode')) ? readFileSync(join(box, 'seen-sslmode'), 'utf8') : null,
    args: existsSync(join(box, 'seen-args')) ? readFileSync(join(box, 'seen-args'), 'utf8') : null,
  }
}

describe('the password reaches the database exactly as it should', () => {
  const cases: [string, string, string][] = [
    ['letters and numbers (the simplest and safest)', 'Abc123xyz789', 'Abc123xyz789'],
    ['every special character %-encoded', 'Fa%40ke%3Aa%2Fb%23c%3Fd%25e%26f%2Bg%20h', 'Fa@ke:a/b#c?d%e&f+g h'],
    ['@ : / # ? written plainly (tolerated: the last @ ends the password)', 'Fa@ke:a/b#c?d', 'Fa@ke:a/b#c?d'],
    ['+ stays a plus, it never becomes a space', 'a+b+c', 'a+b+c'],
    ['a shell character stays what it is', 'a$HOME`b`', 'a$HOME`b`'],
    ['an encoded non-English letter', 'p%C3%A9word', 'péword'],
  ]
  for (const [name, written, expected] of cases) {
    it(name, () => {
      const r = run(url(written))
      expect(r.password).toBe(expected)
      expect(r.status).toBe(1)
    })
  }
})

describe('the connection string the code expects', () => {
  it('the Session pooler string with ?sslmode=require is accepted and reaches the database check', () => {
    const r = run(url('Abc123xyz789', `${POOLER}:5432/postgres?sslmode=require`))
    expect(r.output).not.toContain('is not quite right')
    expect(r.args).toContain(`postgresql://postgres.${REF}@${POOLER}:5432/postgres?sslmode=require`)
    expect(r.sslmode).toBe('require')
  })
  it('without ?sslmode=require the secure connection is still required', () => {
    expect(run(url('Abc123xyz789')).sslmode).toBe('require')
  })
  const refused: [string, string, string][] = [
    ['port 6543 (the Transaction pooler)', url('Abc123xyz789', `${POOLER}:6543/postgres`), 'the port is 6543 (the Transaction pooler): use the Session pooler, port 5432.'],
    ['the plain user "postgres"', url('Abc123xyz789', `${POOLER}:5432/postgres`, 'postgres'), 'the user (before the password) should be postgres.<project ref>'],
    ['the direct host (IPv6 only, unreachable from GitHub)', url('Abc123xyz789', `db.${REF}.supabase.co:5432/postgres`), 'the address after @ should end with .pooler.supabase.com'],
    ['a different database name', url('Abc123xyz789', `${POOLER}:5432/other`), 'the database name at the end should be postgres'],
    ['the [YOUR-PASSWORD] placeholder', url('[YOUR-PASSWORD]'), '[YOUR-PASSWORD]'],
  ]
  for (const [name, dbUrl, message] of refused) {
    it(`${name} is refused in plain words before any connection is tried`, () => {
      const r = run(dbUrl)
      expect(r.status).toBe(1)
      expect(r.output).toContain(message)
      expect(r.args).toBeNull()
    })
  }
})

describe('a refused password', () => {
  const password = 'Fa%40ke-Secret-9'
  const plain = 'Fa@ke-Secret-9'
  const dbUrl = url(password)

  it('says what to do, and that the address and user were accepted', () => {
    const r = run(dbUrl)
    expect(r.output).toContain('The database refused the password. The address and user were accepted, so only the password is wrong.')
    expect(r.output).toContain('reset it (Project Settings → Database)')
    expect(r.output).toContain('The backup STOPPED: could not connect to the database (reason above).')
    expect(r.output).not.toContain('Copy the current database password')
  })
  it('the password and the connection string are never printed or put on a command line', () => {
    const r = run(dbUrl)
    for (const secret of [password, plain, dbUrl, 'sb_secret_fake-key-for-a-test', 'fake backup passphrase long enough 42']) {
      expect(r.output).not.toContain(secret)
      expect(r.args).not.toContain(secret)
    }
  })
  it("on GitHub the only line with the password is GitHub's own hide command, which GitHub removes from the log", () => {
    const lines = run(dbUrl, { GITHUB_ACTIONS: 'true' }).output.split('\n').filter((l) => l.includes(plain))
    expect(lines).toEqual([`::add-mask::${plain}`])
  })
})

describe('what must not change', () => {
  it('the restore keeps its guard for the live project', () => {
    const restore = readFileSync('scripts/restore-supabase.sh', 'utf8')
    expect(restore).toContain('LIVE_PHRASE="RESTORE OVER LIVE ACCOUNTINGBODY"')
    expect(restore).toContain('[ "$answer" = "$LIVE_PHRASE" ] || fail')
  })
  it('the workflow never starts on a push and never prints the secrets', () => {
    const workflow = readFileSync('.github/workflows/backup.yml', 'utf8')
    expect(workflow).not.toMatch(/^\s*(push|pull_request\w*):/m)
    expect(workflow).not.toMatch(/set -x/)
    expect(workflow).toContain('retention-days: 90')
  })
  it('the backup is encrypted with AES-256 and a strong key derivation, and the passphrase is never on a command line', () => {
    const script = readFileSync('scripts/backup-supabase.sh', 'utf8')
    expect(script).toContain('openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass fd:3')
    expect(script).not.toMatch(/-pass (pass|env):/)
  })
})
