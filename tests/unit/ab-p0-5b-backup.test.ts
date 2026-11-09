import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * AB-P0-5b: the changes made for AccountingBody, tested by running the real scripts against stand-in psql, pg_dump,
 * pg_restore and curl. Nothing connects to anything. These prove the scripts' logic only: the SQL itself is not run.
 */

const SLOW = 60_000
const REF = 'abcdefghijklmnopqrst'
const POOLER = 'aws-9-xx-test-1.pooler.supabase.com'
const PASSPHRASE = 'fake backup passphrase long enough 42'
const KEY = 'sb_secret_fake-key-for-a-test'
const DB_URL = `postgresql://postgres.${REF}:FakePassword123@${POOLER}:5432/postgres?sslmode=require`
const KNOWN = ['ab', 'birrbank', 'et', 'hrlake', 'public']
const LIB = '. scripts/lib/backup-connect.sh'

const sh = (body: string, ...args: string[]) => execFileSync('bash', ['-c', `${LIB}; ${body}`, 'test', ...args], { encoding: 'utf8' }).trimEnd()

/** Facts as the real query would return them: name, quoted name, owner, login role, extension-owned, readable. */
const fact = (name: string, owner = 'postgres', extensionOwned = 0, readable = 1) => [name, name, owner, 'postgres', extensionOwned, readable].join('\t')
const SUPABASE_FACTS = [
  fact('_analytics', 'supabase_admin'),
  fact('ab'),
  fact('auth', 'supabase_admin'),
  fact('birrbank'),
  fact('cron', 'supabase_admin', 1),
  fact('et'),
  fact('extensions'),
  fact('graphql', 'supabase_admin', 1),
  fact('graphql_public', 'supabase_admin'),
  fact('hrlake'),
  fact('information_schema', 'supabase_admin'),
  fact('net', 'supabase_admin', 1),
  fact('pgbouncer', 'pgbouncer'),
  fact('public', 'pg_database_owner'),
  fact('realtime', 'supabase_admin'),
  fact('storage', 'supabase_admin'),
  fact('vault', 'supabase_admin', 1),
].join('\n')

const FAKE_PSQL = `#!/bin/bash
# Stand-in psql: answers by what it was asked, and records everything.
printf 'ARGS %s\\n' "$*" >>"$BOX/psql.log"
args="$*"
needs_stdin=1
take=0
for a in "$@"; do
  [ "$a" = -c ] && needs_stdin=0
  if [ "$take" = 1 ]; then
    take=0
    if [ "$a" = - ]; then cat >>"$BOX/psql.log"; else cat "$a" >>"$BOX/psql.log"; fi
    needs_stdin=0
  fi
  [ "$a" = -f ] && take=1
done
[ "$needs_stdin" = 1 ] && cat >>"$BOX/psql.log"
case "$args" in
  *"create extension"*)
    while IFS= read -r bad; do
      case "$args" in *"\\"$bad\\""*) echo "ERROR:  extension \\"$bad\\" is not available" >&2; exit 3 ;; esac
    done <"$BOX/fail-extensions"
    ;;
  *"show server_version_num"*) echo 170006 ;;
  *"has_schema_privilege"*) cat "$BOX/schema-facts" ;;
  *"from pg_extension"*) cat "$BOX/extensions" ;;
  *"from pg_trigger"*) : ;;
  *"to_regclass('cron.job')"*) cat "$BOX/cron-present" ;;
  *"from cron.job"*)
    if [ -f "$BOX/cron-denied" ]; then echo 'ERROR:  permission denied for table job' >&2; exit 3; fi
    cat "$BOX/cron-jobs"
    ;;
  *"from pg_roles where rolname !~"*) echo '["legacy_reader"]' ;;
  *"from pg_roles"*) echo '["postgres","anon"]' ;;
  *"from storage.buckets"*) echo '[]' ;;
  *"from storage.objects"*) echo '[]' ;;
  *"select (select count(*) from pg_class"*) cat "$BOX/target-existing" ;;
  *"select count(*) from "*)
    t="\${args##*select count(*) from only }"
    t="\${t%% *}"
    if [ -f "$BOX/wrong-count" ]; then echo 999; else awk -F'\\t' -v t="$t" '$1 == t { print $2; found = 1 } END { if (!found) print 0 }' "$BOX/row-counts"; fi
    ;;
esac
exit 0
`

const FAKE_PG_DUMP = `#!/bin/bash
# Stand-in pg_dump: writes a file saying which dump this is, and records the call.
if [ "$1" = --version ]; then echo 'pg_dump (PostgreSQL) 17.6'; exit 0; fi
printf '%s\\n' "$*" >>"$BOX/pg_dump.log"
for a in "$@"; do
  case "$a" in --file=*) file="\${a#--file=}" ;; esac
done
case "$*" in *other_denied*) exit 1 ;; esac
printf 'PGDMP-FAKE %s\\n' "$*" >"$file"
`

const FAKE_PG_RESTORE = `#!/bin/bash
# Stand-in pg_restore.
printf '%s\\n' "$*" >>"$BOX/pg_restore.log"
last="\${!#}"
case "$*" in
  *--use-list=*)
    for a in "$@"; do case "$a" in --use-list=*) cp "\${a#--use-list=}" "$BOX/restore.list" ;; esac; done
    echo '-- the tables'
    ;;
  *--list*)
    if [ -f "$BOX/cannot-read" ]; then echo 'pg_restore: error: unsupported version (1.16) in file header' >&2; exit 1; fi
    cat "$BOX/toc"
    ;;
  *--data-only*)
    case "$last" in
      *schemas.dump) cat "$BOX/copy-schemas" ;;
      *auth.dump) cat "$BOX/copy-auth" ;;
    esac
    ;;
esac
`

const FAKE_CURL = `#!/bin/bash
# Stand-in curl: never touches the network. Records whether the key was sent as Bearer.
printf '%s\\n' "$*" >>"$BOX/curl.log"
while [ "$#" -gt 0 ]; do
  case "$1" in
    -H) case "$2" in /*) cat "$2" >>"$BOX/curl-headers" ;; esac; shift ;;
    -o) [ "$2" = /dev/null ] || : >"$2"; shift ;;
  esac
  shift
done
exit 0
`

// A row's text that starts like a COPY line: the defect the row counter had.
const COPY_SCHEMAS = `SET search_path = '';
COPY public.articles (id, body) FROM stdin;
1\tfirst
2\tsecond
\\.
COPY public.notes (id, body) FROM stdin;
1\tplain
COPY fake.row (a) FROM stdin;
3\tplain
\\.
COPY hrlake.salaries (id) FROM stdin;
1
\\.
COPY birrbank.rates (id) FROM stdin;
\\.
COPY ab.items (id) FROM stdin;
1
2
\\.
COPY et.filings (id) FROM stdin;
1
\\.
`
const COPY_AUTH = `COPY auth.users (id) FROM stdin;
\\.
COPY auth.identities (id) FROM stdin;
\\.
`
const TOC = `; Archive created
; Selected TOC Entries:
6; 2615 100 SCHEMA - hrlake postgres
7; 2615 2200 SCHEMA - public pg_database_owner
8; 0 0 COMMENT - SCHEMA public pg_database_owner
9; 0 0 ACL - SCHEMA public pg_database_owner
10; 0 0 ACL - SCHEMA hrlake postgres
11; 1259 200 TABLE hrlake salaries postgres
12; 826 300 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES supabase_admin
13; 826 301 DEFAULT ACL hrlake DEFAULT PRIVILEGES FOR TABLES supabase_storage_admin
14; 826 302 DEFAULT ACL hrlake DEFAULT PRIVILEGES FOR TABLES postgres
15; 0 400 TABLE DATA auth users supabase_auth_admin
`
const ROW_COUNTS = ['public.articles\t2', 'public.notes\t3', 'hrlake.salaries\t1', 'birrbank.rates\t0', 'ab.items\t2', 'et.filings\t1', 'auth.users\t0'].join('\n')
const CRON_JOBS = JSON.stringify([
  { jobname: 'delete-unverified-candidates', schedule: '0 2 * * *', command: 'DELETE FROM x', active: true, database: 'postgres', username: 'postgres' },
  { jobname: 'delete-unconfirmed-briefs', schedule: '0 2 * * *', command: 'DELETE FROM y', active: true, database: 'postgres', username: 'postgres' },
])
const EXTENSIONS = JSON.stringify([
  { name: 'pg_cron', schema: 'pg_catalog' },
  { name: 'pgcrypto', schema: 'extensions' },
  { name: 'vector', schema: 'extensions' },
])

const boxes: string[] = []
afterAll(() => {
  for (const box of boxes) rmSync(box, { recursive: true, force: true })
})

function makeBox() {
  const box = mkdtempSync(join(tmpdir(), 'ab-p0-5b-'))
  boxes.push(box)
  mkdirSync(join(box, 'scripts/lib'), { recursive: true })
  mkdirSync(join(box, 'bin'))
  for (const f of ['scripts/backup-supabase.sh', 'scripts/restore-supabase.sh', 'scripts/lib/backup-connect.sh']) copyFileSync(f, join(box, f))
  const scripts: [string, string][] = [['psql', FAKE_PSQL], ['pg_dump', FAKE_PG_DUMP], ['pg_restore', FAKE_PG_RESTORE], ['curl', FAKE_CURL]]
  for (const [name, text] of scripts) {
    writeFileSync(join(box, 'bin', name), text)
    chmodSync(join(box, 'bin', name), 0o755)
  }
  const data: [string, string][] = [
    ['schema-facts', SUPABASE_FACTS],
    ['extensions', EXTENSIONS],
    ['cron-present', 't'],
    ['cron-jobs', CRON_JOBS],
    ['copy-schemas', COPY_SCHEMAS],
    ['copy-auth', COPY_AUTH],
    ['toc', TOC],
    ['row-counts', ROW_COUNTS],
    ['fail-extensions', ''],
    ['target-existing', '0'],
  ]
  for (const [name, text] of data) writeFileSync(join(box, name), text)
  return box
}

const toolEnv = (box: string) => ({ PATH: `${join(box, 'bin')}:${process.env.PATH}`, HOME: box, BOX: box, BACKUP_PG_BIN: join(box, 'bin'), NODE_ENV: 'test' as const })

function backup(box: string, extra: Record<string, string> = {}) {
  const r = spawnSync('bash', [join(box, 'scripts/backup-supabase.sh')], {
    encoding: 'utf8',
    env: { ...toolEnv(box), AB_BACKUP_DB_URL: DB_URL, AB_BACKUP_SERVICE_ROLE_KEY: KEY, AB_BACKUP_PASSPHRASE: PASSPHRASE, ...extra },
  })
  return { status: r.status, output: `${r.stdout}${r.stderr}` }
}

const archiveOf = (box: string) => {
  const files = readdirSync(join(box, 'backups')).filter((f) => f.endsWith('.tar.gz.enc'))
  expect(files).toHaveLength(1)
  return join(box, 'backups', files[0])
}

/** Decrypts one file out of the finished backup, the way a person would. */
function read(box: string, part: string): string {
  const script = `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$1" -pass fd:3 3< <(printf '%s' "$2") | tar -xzOf - "./$3"`
  return execFileSync('bash', ['-c', script, 'read', archiveOf(box), PASSPHRASE, part], { encoding: 'utf8' })
}
const log = (box: string, file: string) => (existsSync(join(box, file)) ? readFileSync(join(box, file), 'utf8') : '')

function restore(box: string, answers: string[]) {
  const r = spawnSync('bash', [join(box, 'scripts/restore-supabase.sh'), archiveOf(box)], {
    encoding: 'utf8',
    input: `${answers.join('\n')}\n`,
    env: toolEnv(box),
  })
  return { status: r.status, output: `${r.stdout}${r.stderr}` }
}
const TARGET = `postgresql://postgres.tttttttttttttttttttt:[YOUR-PASSWORD]@${POOLER}:5432/postgres`
const LIVE = `postgresql://postgres.sydiwnburwxutuuvkcjt:[YOUR-PASSWORD]@${POOLER}:5432/postgres`
const emptyTarget = [PASSPHRASE, TARGET, 'target-password', KEY]

describe('D1: which database areas are backed up', () => {
  const classify = (name: string, owner = 'postgres', extensionOwned = '0', readable = '1') => sh('classify_schema "$@"', name, owner, 'postgres', extensionOwned, readable)

  it('the five known areas are included, whatever their owner', () => {
    for (const s of KNOWN) {
      expect(classify(s), s).toBe('dump')
      expect(classify(s, 'supabase_admin'), s).toBe('dump')
    }
    expect(classify('public', 'pg_database_owner')).toBe('dump')
  })
  it('every managed area on the list is excluded, even when it looks like ours', () => {
    const listed = sh('printf "%s\\n" "${MANAGED_SCHEMAS[@]}"').split('\n')
    const required = ['information_schema', 'auth', 'storage', 'realtime', 'vault', 'cron', 'extensions', 'graphql', 'graphql_public', 'net', 'pgsodium', 'pgsodium_masks', 'supabase_functions', 'supabase_migrations', '_realtime', 'pgbouncer', '_analytics']
    for (const s of required) expect(listed, s).toContain(s)
    for (const s of listed) expect(classify(s), s).toBe('managed')
  })
  it('pg_* and supabase_* names and extension-owned areas count as managed', () => {
    for (const s of ['pg_catalog', 'pg_toast', 'pg_toast_temp_1', 'pg_temp_3', 'supabase_something_new']) expect(classify(s), s).toBe('managed')
    expect(classify('some_extension_area', 'postgres', '1')).toBe('managed')
  })
  it('a new area of ours, found at run time, is included', () => {
    expect(classify('new_project_area')).toBe('dump')
    expect(classify('new_project_area', 'pg_database_owner')).toBe('dump')
  })
  it('an area Supabase adds later cannot fail the backup: saved separately if readable, skipped if not', () => {
    expect(classify('new_supabase_thing', 'supabase_admin')).toBe('other')
    expect(classify('new_supabase_thing', 'supabase_admin', '0', '0')).toBe('skipped')
  })
  it('one of our own areas that cannot be read stops the backup rather than silently missing it', () => {
    expect(classify('hrlake', 'postgres', '0', '0')).toBe('stop')
  })

  it('the real script dumps the discovered areas in ONE call, one connection at a time, and lists them in the manifest', () => {
    const box = makeBox()
    const r = backup(box)
    expect(r.status, r.output).toBe(0)
    const dumps = log(box, 'pg_dump.log').trim().split('\n')
    expect(dumps).toHaveLength(3)
    const main = dumps[0]
    for (const s of KNOWN) expect(main).toContain(`--schema=${s} `)
    for (const s of ['auth', 'storage', 'realtime', 'vault', 'cron', 'extensions', 'graphql', 'net', 'pgbouncer', '_analytics', 'information_schema']) expect(main).not.toContain(`--schema=${s} `)
    const manifest = JSON.parse(read(box, 'manifest.json'))
    expect(manifest.schemas.slice().sort()).toEqual(KNOWN)
    expect(manifest.schemas_managed_present).toEqual(expect.arrayContaining(['auth', 'storage', 'cron', 'vault', 'extensions']))
    expect(manifest.schemas_other).toEqual([])
    expect(manifest.schemas_skipped).toEqual([])
    expect(manifest.script_version).toBe('ab-backup-1')
  }, SLOW)

  it('D8: every dump has the lock limit; nothing is parallel', () => {
    const box = makeBox()
    expect(backup(box).status).toBe(0)
    for (const d of log(box, 'pg_dump.log').trim().split('\n')) {
      expect(d).toContain('--lock-wait-timeout=120s')
      expect(d).not.toMatch(/(^| )(-j|--jobs)/)
    }
    expect(readFileSync('scripts/backup-supabase.sh', 'utf8')).not.toMatch(/pg_dump"? [^\n]*(-j |--jobs)/)
  }, SLOW)

  it('an unrecognised area does not fail the run, is in the manifest, and the log warns without naming it', () => {
    const box = makeBox()
    writeFileSync(join(box, 'schema-facts'), [SUPABASE_FACTS, fact('secret_new_area', 'supabase_admin'), fact('other_denied', 'supabase_admin'), fact('locked_new_area', 'supabase_admin', 0, 0)].join('\n'))
    const r = backup(box, { GITHUB_ACTIONS: 'true' })
    expect(r.status, r.output).toBe(0)
    const manifest = JSON.parse(read(box, 'manifest.json'))
    expect(manifest.schemas_other).toEqual([{ name: 'secret_new_area', owner: 'supabase_admin', file: 'db/other-schemas/0.dump' }])
    expect(manifest.schemas_skipped.map((s: { name: string }) => s.name).sort()).toEqual(['locked_new_area', 'other_denied'])
    expect(r.output).toContain('::warning::This backup found a database area it does not recognise.')
    for (const name of ['secret_new_area', 'other_denied', 'locked_new_area']) expect(r.output).not.toContain(name)
    expect(log(box, 'pg_dump.log').split('\n')[0]).not.toContain('secret_new_area')
    expect(read(box, 'db/other-schemas/0.dump')).toContain('--schema=secret_new_area')
  }, SLOW)

  it('our own unreadable area stops the run, keeps nothing, and the log does not name it', () => {
    const box = makeBox()
    writeFileSync(join(box, 'schema-facts'), SUPABASE_FACTS.replace(fact('hrlake'), fact('hrlake', 'postgres', 0, 0)))
    const r = backup(box)
    expect(r.status).toBe(1)
    expect(r.output).toContain("an area of the project's own database could not be read")
    expect(r.output).not.toContain('hrlake')
    expect(readdirSync(join(box, 'backups'))).toEqual([])
  }, SLOW)
})

describe('D1: empty auth and storage must succeed', () => {
  it('no sign-in records, no buckets and no files: the backup and its --check both pass', () => {
    const box = makeBox()
    const r = backup(box)
    expect(r.status, r.output).toBe(0)
    expect(r.output).toContain('Self-check passed')
    const manifest = JSON.parse(read(box, 'manifest.json'))
    expect(manifest.auth_tables).toEqual({ 'auth.users': 0, 'auth.identities': 0 })
    expect(manifest.buckets).toEqual({})
    expect(read(box, 'storage/objects.json').trim()).toBe('[]')
    const check = spawnSync('bash', [join(box, 'scripts/backup-supabase.sh'), '--check', archiveOf(box)], { encoding: 'utf8', env: { ...toolEnv(box), AB_BACKUP_PASSPHRASE: PASSPHRASE } })
    expect(check.status, check.stderr).toBe(0)
    expect(check.stdout).toContain('Self-check passed')
  }, SLOW)
})

describe('D4(1): the row counter', () => {
  // The second and third rows look like COPY lines; the third looks exactly like one, so only the guard can tell.
  const dump = 'COPY public.t (a) FROM stdin;\nfirst\nCOPY starts this row\nCOPY fake.row (a) FROM stdin;\nfourth\n\\.\nCOPY public.empty (a) FROM stdin;\n\\.\nCOPY public."Has Space" (a, b) FROM stdin;\n1\t2\n\\.\n'
  const count = (awk: string) => execFileSync('awk', [awk], { input: dump, encoding: 'utf8' })
  // The logic as it was before the fix.
  const UNFIXED = '/^COPY [^ ]+ /{t=$2; n=0; inside=1; next} inside && /^\\\\\\.$/{print t "\\t" n; inside=0; next} inside{n++}'

  it('the old logic really does miscount, so this test can tell the difference', () => {
    expect(count(UNFIXED)).toContain('fake.row\t1')
    expect(count(UNFIXED)).not.toContain('public.t\t')
  })
  it('a row whose text starts with "COPY x " is counted as a row', () => {
    const out = execFileSync('bash', ['-c', `${LIB}; count_copy_rows`], { input: dump, encoding: 'utf8' })
    expect(out).toBe('public.t\t4\npublic.empty\t0\npublic."Has Space"\t1\n')
  })
  it('the backup uses it, and the manifest has the right counts for every area', () => {
    const box = makeBox()
    expect(backup(box).status).toBe(0)
    expect(JSON.parse(read(box, 'manifest.json')).tables).toEqual({
      'public.articles': 2,
      'public.notes': 3,
      'hrlake.salaries': 1,
      'birrbank.rates': 0,
      'ab.items': 2,
      'et.filings': 1,
    })
  }, SLOW)
})

describe('D5: scheduled-job definitions', () => {
  it('are saved inside the encrypted file with all six fields', () => {
    const box = makeBox()
    expect(backup(box).status).toBe(0)
    const saved = JSON.parse(read(box, 'db/cron-jobs.json'))
    expect(saved.status).toBe('saved')
    expect(saved.jobs).toEqual(JSON.parse(CRON_JOBS))
    expect(JSON.parse(read(box, 'manifest.json')).cron).toEqual({ status: 'saved', jobs: 2 })
  }, SLOW)
  it('the query asks for jobname, schedule, command, active, database and username', () => {
    const s = readFileSync('scripts/backup-supabase.sh', 'utf8')
    for (const f of ['jobname', 'schedule', 'command', 'active', 'database', 'username']) expect(s).toContain(`'${f}', ${f}`)
  })
  const notThere: [string, (box: string) => void][] = [
    ['pg_cron is absent', (box) => writeFileSync(join(box, 'cron-present'), 'f')],
    ['pg_cron cannot be read', (box) => writeFileSync(join(box, 'cron-denied'), '')],
  ]
  for (const [name, arrange] of notThere) {
    it(`if ${name}, it records "pg_cron not present" and the backup goes on`, () => {
      const box = makeBox()
      arrange(box)
      const r = backup(box)
      expect(r.status, r.output).toBe(0)
      expect(JSON.parse(read(box, 'db/cron-jobs.json'))).toEqual({ status: 'pg_cron not present', jobs: [] })
      expect(JSON.parse(read(box, 'manifest.json')).cron.status).toBe('pg_cron not present')
    }, SLOW)
  }
})

describe('D7: passphrase and secrets', () => {
  it('31 characters is refused before connecting; 32 is accepted', () => {
    const box = makeBox()
    const short = backup(box, { AB_BACKUP_PASSPHRASE: 'x'.repeat(31) })
    expect(short.status).toBe(1)
    expect(short.output).toContain('AB_BACKUP_PASSPHRASE is shorter than 32 characters.')
    expect(log(box, 'psql.log')).toBe('')
    expect(backup(box, { AB_BACKUP_PASSPHRASE: 'y'.repeat(32) }).status).toBe(0)
  }, SLOW)
  it('automatic mode prints no secret, and no table, area or count', () => {
    const box = makeBox()
    const r = backup(box)
    expect(r.status).toBe(0)
    for (const secret of [PASSPHRASE, KEY, 'FakePassword123', DB_URL]) expect(r.output).not.toContain(secret)
    for (const name of ['articles', 'notes', 'salaries', 'hrlake', 'birrbank', 'filings', 'delete-unverified', 'Tables:', 'Areas:', 'rows']) expect(r.output).not.toContain(name)
  }, SLOW)
  it('only the encrypted file and its fingerprint are left, and they cannot be read without the passphrase', () => {
    const box = makeBox()
    expect(backup(box).status).toBe(0)
    const left = readdirSync(join(box, 'backups')).sort()
    expect(left).toHaveLength(2)
    expect(left[0]).toMatch(/^accountingbody-backup-\d{8}-\d{4}\.tar\.gz\.enc$/)
    expect(left[1]).toBe(`${left[0]}.sha256`)
    expect(readFileSync(join(box, 'backups', left[0])).subarray(0, 8).toString()).toBe('Salted__')
  }, SLOW)
})

describe('Step R 4: the service key', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64url')
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${b64(JSON.stringify({ role }))}.fakeSignature`
  const problem = (k: string) => sh('service_key_problem "$1"', k)

  it('accepts the legacy service_role key and a new secret key', () => {
    expect(jwt('service_role').startsWith('eyJ')).toBe(true)
    expect(problem(jwt('service_role'))).toBe('')
    expect(problem(KEY)).toBe('')
  })
  it('refuses the public keys and anything else, without printing the key', () => {
    expect(problem(jwt('anon'))).toContain('it is the anon key')
    expect(problem('sb_publishable_fake-key')).toContain('it is the publishable key')
    expect(problem('not-a-key-value')).toContain('does not look like a Supabase secret key')
    for (const k of [jwt('anon'), 'sb_publishable_fake-key', 'not-a-key-value']) expect(problem(k)).not.toContain(k)
  })
  it('an sb_ key goes in apikey only; a legacy key goes in both headers', () => {
    expect(sh('api_auth_headers "$1"', KEY)).toBe(`apikey: ${KEY}`)
    expect(sh('api_auth_headers "$1"', 'eyJfake')).toBe('apikey: eyJfake\nAuthorization: Bearer eyJfake')
  })
  it('a publishable key stops the real script before it connects', () => {
    const box = makeBox()
    const r = backup(box, { AB_BACKUP_SERVICE_ROLE_KEY: 'sb_publishable_fake-key' })
    expect(r.status).toBe(1)
    expect(r.output).toContain('AB_BACKUP_SERVICE_ROLE_KEY: it is the publishable key')
    expect(log(box, 'psql.log')).toBe('')
  }, SLOW)
})

describe('the restore', () => {
  // One backup is enough for all the restore tests: each gets a copy of the finished box.
  let source = ''
  beforeAll(() => {
    source = makeBox()
    const r = backup(source)
    if (r.status !== 0) throw new Error(r.output)
  }, SLOW)
  function restoreBox() {
    const box = makeBox()
    mkdirSync(join(box, 'backups'))
    for (const f of readdirSync(join(source, 'backups'))) copyFileSync(join(source, 'backups', f), join(box, 'backups', f))
    return box
  }

  it('D6: empties every area it restores and auth.users, and nothing else', () => {
    const box = restoreBox()
    const r = restore(box, emptyTarget)
    expect(r.status, r.output).toBe(0)
    const sql = log(box, 'psql.log')
    const schemas = /nspname = any\((ARRAY\[[^\]]*\])::text\[\]\)/.exec(sql)
    expect(schemas).not.toBeNull()
    for (const s of KNOWN) expect(schemas?.[1]).toContain(`'${s}'`)
    for (const s of ['auth', 'storage', 'cron', 'vault', 'extensions', 'realtime']) expect(schemas?.[1]).not.toContain(`'${s}'`)
    expect(sql).toContain('delete from auth.users;')
    expect(sql).not.toMatch(/delete from (?!auth\.users)/)
    expect(sql).not.toMatch(/drop schema/i)
  }, SLOW)
  it('D6: emptying stops, with nothing changed, if it would remove anything outside those areas', () => {
    const s = readFileSync('scripts/restore-supabase.sh', 'utf8')
    expect(s).toContain('if outside_after <> outside_before then')
    expect(s).toContain("raise exception 'Emptying these areas would also remove objects outside them.")
    // psql ignores --single-transaction without -f or -c, so the promise of "nothing changed" depends on this.
    expect(s).toContain('| sql --single-transaction -f - >/dev/null; then')
  })
  it('Step R 3: non-public areas are created first; schema entries and Supabase-owned defaults are filtered', () => {
    const box = restoreBox()
    expect(restore(box, emptyTarget).status).toBe(0)
    const sql = log(box, 'psql.log')
    for (const s of ['hrlake', 'birrbank', 'ab', 'et']) expect(sql).toContain(`create schema if not exists "${s}"`)
    expect(sql).not.toContain('create schema if not exists "public"')
    const list = log(box, 'restore.list')
    expect(list).not.toContain('SCHEMA - hrlake')
    expect(list).not.toContain('SCHEMA - public')
    expect(list).not.toContain('COMMENT - SCHEMA public')
    expect(list).not.toContain('ACL - SCHEMA public')
    expect(list).toContain('ACL - SCHEMA hrlake postgres')
    expect(list).toContain('TABLE hrlake salaries postgres')
    expect(list).not.toContain('supabase_admin')
    expect(list).not.toContain('supabase_storage_admin')
    expect(list).toContain('DEFAULT ACL hrlake DEFAULT PRIVILEGES FOR TABLES postgres')
  }, SLOW)
  it('AB-P0-5c: old automatic grants are cleared in EVERY restored area, inside the same transaction as the tables', () => {
    const box = restoreBox()
    expect(restore(box, emptyTarget).status).toBe(0)
    const call = log(box, 'psql.log').split('\nARGS ').find((c) => c.includes('alter default privileges for role current_user in schema %I')) ?? ''
    expect(call).toContain('--single-transaction')
    expect(call).toContain("-f -")
    expect(call).toContain('revoke all on schema %I')
    for (const s of KNOWN) expect(call).toContain(`'${s}'`)
    // Tables come after the reset, on the same psql call.
    expect(call.indexOf('-- the tables')).toBeGreaterThan(call.indexOf('revoke all on schema %I'))
  }, SLOW)
  it('AB-P0-5c: end of input at a phrase prompt refuses with the plain message', () => {
    const box = restoreBox()
    writeFileSync(join(box, 'target-existing'), '42')
    const r = restore(box, emptyTarget)
    expect(r.status).toBe(1)
    expect(r.output).toContain('the phrase was not typed exactly, so nothing was changed.')
    expect(log(box, 'psql.log')).not.toContain('delete from auth.users')
  }, SLOW)
  it('restores the areas before comparing every row count; an empty auth is skipped', () => {
    const box = restoreBox()
    const r = restore(box, emptyTarget)
    expect(r.status, r.output).toBe(0)
    expect(r.output).toContain('The backup holds no sign-in records, so that step is skipped.')
    const sql = log(box, 'psql.log')
    for (const t of ['public.articles', 'public.notes', 'hrlake.salaries', 'birrbank.rates', 'ab.items', 'et.filings', 'auth.users']) expect(sql).toContain(`select count(*) from only ${t}`)
    expect(sql).not.toContain('select count(*) from only auth.identities')
    expect(r.output).toContain("Every table's rows")
  }, SLOW)
  it('a row count that differs fails, with the re-run warning', () => {
    const box = restoreBox()
    writeFileSync(join(box, 'wrong-count'), '')
    const r = restore(box, emptyTarget)
    expect(r.status).toBe(1)
    expect(r.output).toContain('rows differ in public.articles')
    expect(r.output).toContain('DO NOT run the restore again over it')
  }, SLOW)

  it('D4(2): each extension is created separately, a failure does not stop the rest, and every failure is reported', () => {
    const box = restoreBox()
    writeFileSync(join(box, 'fail-extensions'), 'pg_cron\npgcrypto\n')
    const r = restore(box, emptyTarget)
    expect(r.status, r.output).toBe(0)
    const sql = log(box, 'psql.log')
    expect(sql).toContain('create extension if not exists "pg_cron" with schema pg_catalog')
    expect(sql).toContain('create extension if not exists "pgcrypto" with schema extensions')
    // The one after both failures still ran, on its own connection.
    expect(sql).toContain('create extension if not exists "vector" with schema extensions')
    expect(sql.match(/ARGS [^\n]*create extension/g)).toHaveLength(3)
    expect(r.output).toContain('Extension pg_cron could not be created: ERROR:  extension "pg_cron" is not available')
    expect(r.output).toContain('Extension pgcrypto could not be created:')
    expect(r.output).toContain('These extensions could NOT be created on the target (2 of them): pg_cron pgcrypto')
    expect(r.output).not.toContain('Extension vector could not')
    // Later steps still happened.
    expect(r.output).toContain("Every table's rows")
  }, SLOW)
  it('D4(2): the old all-in-one extension line is gone', () => {
    const s = readFileSync('scripts/restore-supabase.sh', 'utf8')
    expect(s).not.toMatch(/create extension[^\n]*\| *sql/)
    expect(s).toContain('EXTENSION_FAILURES+=')
  })

  it('D5: never schedules a job, and says where the definitions are and when to use them', () => {
    const box = restoreBox()
    const r = restore(box, emptyTarget)
    expect(r.status).toBe(0)
    const sql = log(box, 'psql.log')
    expect(sql).not.toMatch(/cron\.schedule/)
    expect(sql).not.toMatch(/cron\.job/)
    expect(sql).not.toContain('delete-unverified-candidates')
    expect(r.output).toContain('Scheduled jobs: NOT recreated.')
    expect(r.output).toContain('db/cron-jobs.json')
    expect(r.output).toContain('tar -xzOf - ./db/cron-jobs.json')
    expect(r.output).toContain('Only on a REAL recovery, and NEVER on a rehearsal')
    expect(r.output).toContain('select cron.schedule(')
  }, SLOW)

  it('D6: the live project is refused without the exact phrase, before any password or connection', () => {
    const box = restoreBox()
    const r = restore(box, [PASSPHRASE, LIVE, 'restore over live accountingbody'])
    expect(r.status).toBe(1)
    expect(r.output).toContain('RESTORE OVER LIVE ACCOUNTINGBODY')
    expect(r.output).toContain('the phrase was not typed exactly, so nothing was changed.')
    expect(log(box, 'psql.log')).toBe('')
  }, SLOW)
  it("D6: the live warning says plainly what is replaced", () => {
    const box = restoreBox()
    const r = restore(box, [PASSPHRASE, LIVE, 'no'])
    expect(r.output).toContain("Restoring over live replaces ALL of AccountingBody's and EthioTax's data and every archived area (hrlake, birrbank, ab, et).")
  }, SLOW)
  it('D6: with the exact phrase it goes on, and still asks the second phrase if the target holds data', () => {
    const box = restoreBox()
    writeFileSync(join(box, 'target-existing'), '42')
    const r = restore(box, [PASSPHRASE, LIVE, 'RESTORE OVER LIVE ACCOUNTINGBODY', 'target-password', KEY, 'wrong phrase'])
    expect(r.status).toBe(1)
    expect(r.output).toContain('REPLACE ALL DATA IN TARGET')
    expect(r.output).toContain('the phrase was not typed exactly, so nothing was changed.')
    expect(r.output).not.toContain('DO NOT run the restore again')
    expect(log(box, 'psql.log')).not.toContain('delete from auth.users')
  }, SLOW)
  it('D6: a target holding data needs the exact phrase, then restores', () => {
    const box = restoreBox()
    writeFileSync(join(box, 'target-existing'), '42')
    const r = restore(box, [...emptyTarget, 'REPLACE ALL DATA IN TARGET'])
    expect(r.status, r.output).toBe(0)
    expect(log(box, 'psql.log')).toContain('delete from auth.users')
  }, SLOW)
  it('tools too old to read the backup stop it before the target is even asked for', () => {
    const box = restoreBox()
    writeFileSync(join(box, 'cannot-read'), '')
    const r = restore(box, emptyTarget)
    expect(r.status).toBe(1)
    expect(r.output).toContain('cannot read this backup')
    expect(log(box, 'psql.log')).toBe('')
  }, SLOW)
  it('a missing custom role is named before anything changes', () => {
    const box = restoreBox()
    const r = restore(box, emptyTarget)
    expect(r.status).toBe(0)
    expect(r.output).toContain('these database roles existed in the backup')
    expect(r.output).toContain('legacy_reader')
    expect(r.output.indexOf('legacy_reader')).toBeLessThan(r.output.indexOf('1/4  Emptying'))
  }, SLOW)
  it('a wrong passphrase stops before anything is asked or changed', () => {
    const box = restoreBox()
    const r = restore(box, ['the wrong passphrase, also long enough'])
    expect(r.status).toBe(1)
    expect(r.output).toContain('the passphrase is wrong or the file is damaged. Nothing was restored.')
    expect(log(box, 'psql.log')).toBe('')
  }, SLOW)
  it('prints no secret', () => {
    const box = restoreBox()
    const r = restore(box, emptyTarget)
    for (const secret of [PASSPHRASE, KEY, 'target-password']) expect(r.output).not.toContain(secret)
  }, SLOW)
  it('D6: the script header and the runbook both carry the re-run warning', () => {
    expect(readFileSync('scripts/restore-supabase.sh', 'utf8').split('set -euo')[0]).toContain('A RESTORE THAT STOPS PARTWAY CANNOT SIMPLY BE RUN AGAIN')
    expect(readFileSync('docs/RUNBOOK.md', 'utf8')).toContain('A restore that stops partway cannot simply be run again')
  })
})

describe('the new files', () => {
  const FILES = ['.github/workflows/backup.yml', 'scripts/backup-supabase.sh', 'scripts/lib/backup-connect.sh', 'scripts/restore-supabase.sh', 'docs/RUNBOOK.md']
  it('D9: name no other project', () => {
    for (const f of FILES) expect(readFileSync(f, 'utf8'), f).not.toMatch(/HL_|hagerland|Addis|BK-1|BK-2|F-6|local-stack|fcgqdsekfvwfivutftvj/i)
  })
  it('D9: the banner makes no claim of photos, CVs or documents', () => {
    const s = readFileSync('scripts/backup-supabase.sh', 'utf8')
    expect(s).not.toMatch(/photos|\bCVs\b/i)
    expect(s).toContain('Supabase sign-in records (none today)')
    expect(s).toContain('SCRIPT_VERSION="ab-backup-1"')
  })
  it('D11: name no place where keys are kept, and hold no real connection string or key', () => {
    for (const f of FILES) {
      const s = readFileSync(f, 'utf8')
      expect(s, f).not.toMatch(/password manager|1password|lastpass|bitwarden|dashlane|keychain/i)
      expect(s, f).not.toMatch(/postgres(ql)?:\/\/[^<\s"]*:[^<[\s"$]+@/)
      expect(s, f).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./)
      expect(s, f).not.toMatch(/sb_secret_[A-Za-z0-9]/)
      expect(s, f).not.toContain('@gmail')
    }
  })
  it('the runbook lists exactly the managed areas the script excludes', () => {
    const listed = sh('printf "%s\\n" "${MANAGED_SCHEMAS[@]}"').split('\n')
    const line = /<!-- managed-schemas -->\n([^\n]+)/.exec(readFileSync('docs/RUNBOOK.md', 'utf8'))
    expect(line).not.toBeNull()
    const inRunbook = Array.from((line?.[1] ?? '').matchAll(/`([^`]+)`/g)).map((m) => m[1])
    expect(inRunbook.slice().sort()).toEqual(listed.slice().sort())
  })
  it('the runbook states the honest status', () => {
    const s = readFileSync('docs/RUNBOOK.md', 'utf8')
    expect(s).toContain('built; first run and restore rehearsal not yet done')
    for (const name of ['AB_BACKUP_DB_URL', 'AB_BACKUP_SERVICE_ROLE_KEY', 'AB_BACKUP_PASSPHRASE']) expect(s).toContain(name)
  })
  it('D2: any Session pooler host passes the shape check, with no host hard-coded', () => {
    for (const host of ['aws-0-eu-west-1.pooler.supabase.com', 'aws-1-eu-west-1.pooler.supabase.com', 'some-new-name.pooler.supabase.com']) {
      expect(sh('url_shape_problems "$1" "$2"', `postgresql://postgres.${REF}@${host}:5432/postgres?sslmode=require`, 'ok-password'), host).toBe('')
    }
    for (const f of ['scripts/backup-supabase.sh', 'scripts/restore-supabase.sh', 'scripts/lib/backup-connect.sh']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/aws-\d/)
  })
})
