# Standing rules for hands-free jobs

Owner decisions D126 (hands-free) and D163 (streamlined working). Every hands-free brief includes these rules; a brief may add to them, never relax them.

## Secrets
- Never print, log or write any part of `VERCEL_AUTOMATION_BYPASS_SECRET` or `AB_DB_URL`. Check presence only: `[ -n "$NAME" ] && echo NAME:set || echo NAME:MISSING`. If one is missing, stop: the owner reloads the Codespace.
- Never use `curl -v`, `set -x`, `env` or `printenv`.
- Database: `U="$(printf %s "$AB_DB_URL" | tr -d '\r\n')"`, then `psql "$U" -X -v ON_ERROR_STOP=1`.
- Deployment checks: send the protection-bypass header through stdin on every request to a `*.vercel.app` address: `printf 'x-vercel-protection-bypass: %s\n' "$VERCEL_AUTOMATION_BYPASS_SECRET" | curl -sS -H @- …`. EthioTax view: add `-H "x-et-platform: ethiotax"`. Never request the two live domains.
- Never send a cron secret or an `Authorization` header to any cron address.

## Output
- Print counts, sizes, timings, status codes, provider slugs and error codes. Never print job titles, companies, URLs, slugs, ids, e-mail addresses or free-text error messages (give their length and code only).
- Never print or write the admin folder name. Reduce lint output with `| tail -3` and read the exit code from `PIPESTATUS`. Limit every `git grep` by pathspec; report admin-area matches as a count.

## Files
- Write files only with the editing tools: no heredoc, `sed`, `>`, `>>` or `tee` into any file, including reports and check output. Read files with the reading tool.
- Scratch files live under `reports/.tmp/` and are removed at the end with literal paths.
- Commit messages and pull request bodies are written to files first.
- Commits use `AccountingBody <info@accountingbody.com>` and end with the running model's `Co-Authored-By` line and the `Claude-Session` line the brief gives.

## Checks
- Use the exact offline forms in CLAUDE.md section 4. Never run `npm run build`, `npm run lint`, `npm run dev` or `npx`.

## Git and releases
- The push URL stays `DISABLED-during-prep`. A push is one command line: unset the push URL, push the named branch, restore the lock, print the lock.
- One `git fetch origin` per job unless the brief says otherwise. Never force-push, never `--delete-branch`. Merge with `gh pr merge <n> --merge </dev/null`.
- Code-only release proof: offline checks, CI green, preview `/api/version` equals the head plus the brief's page rows, merge, poll the deployment (print the raw status each poll), live `/api/version` equals the merge plus the brief's rows, and the prune cron answers 401 without authorisation. Record the previous Production deployment as the undo target.
- Releases that change import code merge away from the 15-minute ticks (not within 2 minutes of :00, :15, :30, :45), and the next release waits for the first real import on the new code.
- A batch release is allowed when the owner approves it in the brief. Each fix keeps its own tests.
- A job that a later job follows must not leave a pull request open when the later job checks that none is open.
- Pull request bodies end with the footer the brief gives.
- `gh pr list --state open` is allowed as a read.

## Database
- Read sessions start `BEGIN READ ONLY;` with `SHOW transaction_read_only;` printing `on`, and end `ROLLBACK;`.
- Writes only as the brief names them, after the owner's backup run is proven fresh. Never run a migration file whole.
- Read-only means no DDL at all, not even a test statement. `SHOW transaction_read_only;` printing `on` is the proof.
- A brief may name a migration Part to run: pipe that Part's exact lines into psql through stdin. Never `psql -f` on a migration file; a scratch copy may be run with `-f` only when the brief names the single changed line and you prove it with `diff`.

## Behaviour
- No multiple-choice questions: if something is unclear or unexpected, stop and report.
- Prefer no waits. If a wait is needed, use an idle wait (`timeout 30 tail -f /dev/null`) in the background and continue in the same turn; never a busy loop.
- A brief's pin count can be wrong: you may adjust a pin of the same kind inside a file the brief approves, and you must report it.
- Every job writes one git-ignored report (`reports/<name>.md`): Section 0 first, a three-line outcome, own slips, and the brief's last line.
