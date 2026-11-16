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
- Never list or grep the `app/` top level broadly. Find an admin-area file by the unique string the brief gives (`git grep -l -F '<string>' -- app`) into a shell variable, check it is non-empty and names one file, and never print, `ls`, `wc` or `cat` it.
- Build any admin mask variable, and check it is non-empty, BEFORE the first command that prints paths or excludes them with it. If it is empty, print `<non-public>` instead of paths and report it.
- Never save page bodies or addresses to files. Compare response bodies by size or hash in memory.

## Files
- Write files only with the editing tools: no heredoc, `sed`, `>`, `>>` or `tee` into any file, including reports and check output. Read files with the reading tool.
- Scratch files live under `reports/.tmp/` and are removed at the end with literal paths.
- Commit messages and pull request bodies are written to files first.
- Commits use `AccountingBody <info@accountingbody.com>` and end with the running model's `Co-Authored-By` line and the `Claude-Session` line the brief gives.
- Read code from `origin/main` (`git show origin/main:<path>`) or from a branch made with `git switch -C <name> origin/main`. The Codespace's home branch is old: never read code from its working tree.

## Checks
- Use the exact offline forms in CLAUDE.md section 4. Never run `npm run build`, `npm run lint`, `npm run dev` or `npx`.
- Before editing, read the existing tests that cover the files you change and run them on the unchanged tree.
- When a change alters a function's call signature or a page's props, update every call site in tests, not only the ones a brief names. Keep each assertion's meaning.
- Commit first, then run the full offline checks on the committed tree, then push. Some tests read tracked files with `git ls-files`, so an uncommitted new file can pass locally and fail in CI.
- When a brief gives exact edit text, `git diff --numstat` and per-file sha256 prefixes, match them before committing. On a mismatch, correct toward the brief's text; if that does not match, stop.
- `app/api/ingest/[slug]/route.test.ts` (the ingest characterisation test) changes only when a brief names the exact lines. Record its sha256 before and after.
- A new top-level `app/` folder must be added to `PUBLIC_PAGE_SEGMENTS` in `lib/sentry-browser-privacy.ts`.
- The TypeScript target rejects regex-literal `u` flags and direct `Map` iteration: use `new RegExp(source, 'u')` and `Array.from(map)`.
- In a nested git worktree, run ESLint with `--no-eslintrc -c .eslintrc.json`.
- An approved removal may delete a constant or import that it leaves unused, and only that. Report it.
- Package removals: `npm uninstall --no-audit --no-fund <exact list>`; then a lock gate (every remaining entry at the same version, none added, the removed count recorded).
- A job that switches branches or changes packages finishes with `npm ci --no-audit --no-fund` on the home branch, so `npm ls` exits 0.

## Code
- A GET-only route handler with `dynamic = 'force-dynamic'` that reads data also sets `fetchCache = 'force-no-store'` (or `'default-no-store'` where `unstable_cache` must still read). `lib/route-fetch-cache.test.ts` enforces it.
- Public text stays neutral: commit messages, pull request titles and bodies, and code comments for a removal say what is retired ("retire unused X"), never why it was risky. Details go in the report.

## Git and releases
- The push URL stays `DISABLED-during-prep`. A push is one command line: unset the push URL, push the named branch, restore the lock, print the lock.
- One `git fetch origin` per job unless the brief says otherwise. Never force-push, never `--delete-branch`. Merge with `gh pr merge <n> --merge </dev/null`.
- Code-only release proof: offline checks, CI green, preview `/api/version` equals the head plus the brief's page rows, merge, poll the deployment (print the raw status each poll), live `/api/version` equals the merge plus the brief's rows, and the prune cron answers 401 without authorisation on Production. On a preview it answers 503 "Not configured"; that is expected. Record the previous Production deployment, by commit sha and deployment id, as the undo target.
- Request limits count every request, including each redirect hop. Never follow redirects; record the status and compare the location as a hash.
- Behaviour-identity proof for refactors: request the brief's rows on the current Production deployment first (the baseline); the preview and live answers must match it code for code, and redirect locations must be the same as the baseline. Bytes match unless the brief says otherwise.
- Route-table gate: Next's route table is in the log of the CI job named `CI`. Parse it before and after with the admin substring mask; any change the brief does not name is a stop. The CI build lacks some environment values, so live headers (`x-vercel-cache`, `age`) decide what Vercel really serves.
- Every release merges away from the 15-minute ticks (not within 2 minutes of :00, :15, :30, :45) and never between 07:25 and 07:40 UTC (the daily clean-up).
- Releases that change import code: the next release waits for the first real import on the new code. Its gate is one read-only `provider_runs` check since the previous deployment's success time: at least one `completed` run with a null `error_code`, else stop before editing. A provider is due when `next_fetch_at <= now()`, so one due a few seconds after a tick runs at the next tick; that is not a missed run.
- A batch release is allowed when the owner approves it in the brief. Each fix keeps its own tests.
- A job that a later job follows must not leave a pull request open when the later job checks that none is open.
- Pull request bodies end with the footer the brief gives.
- `gh pr list --state open` is allowed as a read.

## Database
- Read sessions start `BEGIN READ ONLY;` with `SHOW transaction_read_only;` printing `on`, and end `ROLLBACK;`.
- Writes only as the brief names them, after the owner's backup run is proven fresh. Never run a migration file whole.
- Read-only means no DDL at all, not even a test statement. `SHOW transaction_read_only;` printing `on` is the proof.
- A brief may name a migration Part to run: pipe that Part's exact lines into psql through stdin. Never `psql -f` on a migration file; a scratch copy may be run with `-f` only when the brief names the single changed line and you prove it with `diff`.
- Any count you report, or "is this table empty?", uses `count(*)`, never `pg_stat_user_tables.n_live_tup`.
- Content writes follow the brief's pattern: a private before-image in `reports/` first; one transaction with an md5 check of each row's current value, exactly one row changed per statement, and the total equal to the expected count, else roll back; then a read-only verify.
- For old or broken internal links, check the WordPress history (`lib/legacy-redirect-map.ts`) first, then titles, then name similarity.

## Behaviour
- No multiple-choice questions: if something is unclear or unexpected, stop and report.
- If a brief's stated count differs from its list, stop and report.
- Prefer no waits. If a wait is needed, use an idle wait (`timeout 30 tail -f /dev/null`) in the background and continue in the same turn; never a busy loop.
- A brief's pin count can be wrong: you may adjust a pin of the same kind inside a file the brief approves, and you must report it.
- Proof rows use inputs that are valid for the route. Read the page that calls an API before choosing its input.
- A job that must stop before committing saves its prepared work with a named `git stash`. The resume brief applies it, makes only the newly approved edit, re-runs every check, and drops the stash only after they pass.
- After a Codespace restart, a resume brief: check the state (secret presence, branch, lock, `npm ls`, the report so far), add a "restarted and resumed" line to Section 0 of the report, finish only what is missing, and keep the original limits.
- Every job writes one git-ignored report (`reports/<name>.md`): Section 0 first, a three-line outcome, own slips, and the brief's last line.
