# AccountingBody project guide

Read this before touching anything. It applies to every Claude Code session in this repository.

The owner is non-technical. Explain results in plain English. Decisions and audit records are kept privately by the owner, so if something here seems to conflict with a job's brief, stop and ask rather than choosing.

In this guide, `<admin>` stands for the admin area's folder name. Do not write the real value in documents: the admin path comes from `ADMIN_PATH`.

## 1. What this repository is

One codebase serves two live sites:

- **accountingbody.com** is served by Vercel.
- **ethiotax.com** is a separate Cloudflare Worker, kept in its own repository, that fetches accountingbody.com and re-brands it. The app also contains EthioTax branches keyed on the request.

A change here can reach both sites, and markup changes can affect the Worker even though its code is not in this repository.

| Area | Technology |
|---|---|
| Framework | Next.js 14.2.35 App Router, React 18, TypeScript strict mode |
| Styling | Tailwind CSS, `app/globals.css` |
| Database | Supabase through supabase-js over HTTPS; no direct Postgres driver in the app |
| Email | Resend |
| Error reporting | Sentry |
| Bot check | Cloudflare Turnstile |
| Admin AI tools | Anthropic SDK |
| Tests | vitest |
| Hosting | Vercel; a push to `main` deploys automatically |

## 2. Map of the codebase

| Path | What lives there |
|---|---|
| `app/` | Pages and route handlers (App Router) |
| `app/page.tsx` | Home page |
| `app/jobs/` | Job listings, job pages, employer flows |
| `app/study/`, `app/practice-questions/`, `app/free-courses/` | Study content, questions, courses |
| `app/get-help/`, `app/firms-freelancers/` | Service and enquiry pages |
| `app/api/` | Public route handlers |
| `app/api/version/` | Shows which commit and deployment are live; used to confirm a release or rollback (`docs/RELEASE.md`) |
| `app/api/cron/`, `app/api/ingest/` | Scheduled jobs and job ingestion; schedules are in `vercel.json` |
| `app/<admin>/`, `app/api/<admin>/` | Admin area pages and admin route handlers |
| `components/` | Shared UI |
| `components/layout/` | Site navigation and layout parts |
| `components/book/` | AB Press templates (locked, see section 6) |
| `lib/` | Data access, jobs, normalisers, helpers |
| `lib/adapters/`, `lib/ingestion/` | Job provider adapters and the ingestion pipeline |
| `lib/test-helpers/` | Shared test helpers |
| `migrations/` | Numbered SQL record of database changes; read `migrations/README.md` first |
| `middleware.ts` | Runs on every matched request. Never rename it |
| `next.config.mjs` | Next.js config, redirects, Sentry wrapper |
| `vercel.json` | Redirects, cron schedules, response headers |
| `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts` | Error reporting set-up |
| `tailwind.config.ts` | Design tokens |
| `.github/workflows/ci.yml` | CI: lint, type check, tests, production build (placeholder configuration only) |
| `docs/RELEASE.md` | How to release a change and how to undo it |
| `docs/RULES.md` | Numbered legacy rules |
| `.env.example` | Every environment variable name, no values |
| `reports/` | Git-ignored job reports (section 7) |
| `sanity/`, `scripts/`, one-off scripts in the repository root | Historical. Do not run or extend them |

**Tests** sit beside the code they cover, as `*.test.ts`.

**Redirects** live in three places: `next.config.mjs`, `vercel.json` and `middleware.ts`. Check all three before adding or changing one.

**Large files:** `app/page.tsx` and `lib/jobs.ts` are well over 800 lines, and so are several admin pages. Make targeted edits only; never rewrite a whole file.

## 3. Safety rules

### Public repository

This repository is public. Anything committed can be read by anyone, and stays in history.

- Never commit secrets, keys, tokens, connection strings or real values of any kind.
- Never write security weaknesses, open issues or attack paths in tracked files, commit messages or code comments. Those go in the git-ignored report.
- Keep private business information and people's names out of tracked files. The only email address for tracked documents is info@accountingbody.com.
- Never write the admin path value in documents.

### Secrets

- Never open, print, search, list, diff or name `.env`, `.env.local` or any other `.env.*` file in a command. `.env.example` is the only exception.
- Find variable names by searching tracked code for `process.env.`.
- Search with `git grep` and `git ls-files`, which skip ignored files. Avoid plain `grep -r`, `find` and `ls -a` at the repository root.
- If a secret appears in any output, stop and tell the owner. Do not repeat it.

### Working limits

- Read a file before writing to it.
- One task per job. One change per release. Do not tidy nearby code.
- No push, merge or deploy without the owner's explicit go-ahead.
- No network unless the brief explicitly allows it. That includes `git fetch`, `git pull`, `git push`, `npm install`, `npx` downloads, `curl`, `wget`, `gh`, live sites and AI calls.
- No sub-agents unless the brief asks for them.
- No live database changes from this environment. Every data or schema change needs a fresh backup and the owner's approval of the exact change.
- Keep scratch files under `reports/` and delete them when finished.
- Never run `npm audit fix --force`, codemods or `--fix` tools without approval.
- Do not run old scripts from `scripts/` or the repository root.
- Stop and ask about anything outside the task.

### Before calling a job finished

- Record the commit and how to undo it.
- Preview before live. Check both hosts: accountingbody.com and ethiotax.com.
- Report your own slips honestly.

## 4. How to check a change

The Codespace has 2 cores, about 7.8 GiB of RAM and no swap. Run one heavy process at a time.

Run these from the repository root. `unshare -rn` removes network access, so the checks are proven offline.

```bash
mkdir -p reports/.tmp

# Type check
unshare -rn ./node_modules/.bin/tsc --noEmit --incremental false

# Lint: the same folders as the project's lint script
unshare -rn ./node_modules/.bin/eslint --ext .js,.jsx,.ts,.tsx app components lib

# Tests
TMPDIR="$PWD/reports/.tmp" unshare -rn ./node_modules/.bin/vitest run --cache=false

rm -rf reports/.tmp
```

Do not run these in the Codespace:

| Command | Why not |
|---|---|
| `npm run build` | Runs out of memory. CI runs the production build, and Vercel builds a preview of each pushed branch |
| `npm run dev` | Not part of the check process here |
| `npm run lint` | `next lint` loads local environment files at start-up. Run ESLint directly as above; CI runs `npm run lint` in a clean environment |

vitest is configured not to load local environment files (`vitest.config.ts`).

Use Node.js 24 everywhere: local work, CI and hosting. The version is defined in `.nvmrc` and `package.json` `engines`; change both together.

### After a release

Only when the owner has approved the release:

1. Check the Vercel preview before production.
2. Check both hosts.
3. Purge the Vercel and Cloudflare caches after any deploy that changes cached pages.

## 5. Coding conventions

### Single sources

| Concern | Where it lives | Rule |
|---|---|---|
| Job queries | `lib/jobs.ts` | New job queries go here |
| Server database clients | `lib/supabase-server.ts` | Get every server-side supabase-js client from `getServerSupabase(context)`. Each context (`publicRead`, `publicWrite`, `admin`, `cron`, `ingest`) has a fixed request time limit. Files that still call `createClient` themselves are on an explicit list in `lib/supabase-client-sources.test.ts`; later steps move them and the list only shrinks |
| Cached database reads | `lib/cache-guard.ts` | Wrap every `unstable_cache` database read with `guardCachedRead`, using the same key parts. The similar-jobs reads, which are off, are not wrapped yet |
| Job emails | `lib/jobEmails.ts` | New job emails go here |
| Admin session check | `lib/admin-auth.ts` | Every admin page and route checks the session on the server |
| Admin colours | `lib/admin-theme.ts` | Use `ADMIN_COLORS`, not raw colour values |
| Canonical URLs | `lib/canonical.ts` | Use `getSiteUrl` and `canonicalMetadata` |
| Job URLs | `lib/job-format.ts` | Use its canonical job URL helper |
| Site codes | `lib/site-codes.ts` | Reuse the existing codes |
| Ingestion keywords | `lib/ingestion/keywords.ts` | All keyword logic goes here |
| Job data-quality metrics | `lib/ingestion/quality.ts` | Compute metrics here |
| Provider knowledge | The `job_providers` table | Do not hard-code provider details in TypeScript |
| Environment variable names | `.env.example` | Add new names in the same commit as the code |

### Data and server code

- Server code creates database clients only through `lib/supabase-server.ts` and picks the context for the work: `publicRead` for anything a public page or read API uses, `publicWrite` for a write a visitor triggers, and `admin`, `cron` or `ingest` only for work that no public request uses. A function shared between a public path and longer work keeps the public limit for the public path.
- Never create a Supabase client at module scope. Create it inside a function, as `getSupabase()` does in `lib/jobs.ts`. Treat other SDK clients the same way.
- Always check the returned `error`. supabase-js and Resend return errors rather than throwing them, so success must never be assumed.
- A route returns success only if the work really happened. It never keeps an old value quietly.
- Query tables flat, with no embedded relations. Fetch related rows in a second query.
- Admin queries filter by site, using the column that table has (`platform` or `show_on_sites`). If a screen is meant to show all sites, say so in a comment.
- Internal fields and raw database errors never reach an anonymous visitor.
- Cron and ingest routes check `CRON_SECRET` and refuse the request if it is wrong or missing.
- Public forms verify the Turnstile token on the server.
- Server-only secrets never go in a `NEXT_PUBLIC_` variable.
- Popular reads use `unstable_cache`, as `lib/jobs.ts` and `lib/db.ts` do. Treat any new query on a busy page as a database load decision.
- Cached database reads go through the cache guard (`lib/cache-guard.ts`); never cache a failure. The cached function throws on a database error, and the caller catches outside the cache and returns its fallback.
- Keep existing `fetchCache` settings and `await` on `headers()` and `cookies()`. They are deliberate.
- Every database change gets a numbered file in `migrations/`, in the same commit as the code that needs it.
- The `public` database schema is shared with other products. Only touch the tables listed in `migrations/README.md`.

### Admin area

- Server admin pages and the admin layout call `await requireAdmin()` (`lib/admin-auth.ts`) as their first statement. Admin pages marked `'use client'` are covered by the layout. `lib/admin-pages.test.ts` checks this.
- Every admin API route handler starts with `if (!(await isAuthenticated(req))) return signedOutResponse()`, both imported from `@/lib/admin-auth`. A route never defines its own check. `lib/admin-api-routes.test.ts` checks this.
- Admin screens call admin API routes only through `adminFetch` (`lib/admin-fetch.ts`), never plain `fetch`. When the session has ended, the shared signed-out notice (`components/AdminSignedOutNotice.tsx`, shown by the admin layout) tells the user. `lib/admin-client-calls.test.ts` checks this.
- Admin sessions need `ADMIN_SESSION_SECRET` (at least 32 characters) as well as `ADMIN_SECRET`; both are listed in `.env.example`. There is one session check, `isAdminSessionValid` in `lib/middleware-logic.ts`, used by middleware, `requireAdmin()` and `isAuthenticated()`.

### Job ingestion

- Keep `dedup_hash` behaviour stable. Duplicates are found with a plain `insert()`, treating error `23505` as a duplicate, not with `upsert`.
- Rejected jobs stay out of the duplicate check, so they can be ingested again later.
- If every keyword in a provider run fails, the adapter throws, so the run is recorded as failed.
- Keep relevance enforcement on for a provider unless its own filter has been tested.

### Quizzes

- Scenario questions never shuffle their options. See the scenario branch in `components/QuizRenderer.tsx`.

### React

- No `on*` event handlers in server components. Move them into a `'use client'` component.
- Never rename `middleware.ts`.

### Tools for editing

- Use the edit tools for source files, not shell heredocs. They handle bracketed paths such as `app/jobs/[slug]/page.tsx` safely.

### Design

| Token | Value |
|---|---|
| Gold accent | `#C9982A`. Never introduce `#D4A017` in new code |
| Navy | `#0C1A3D` |
| Page background | `#F8F7F4` |
| Display font | DM Serif Display |
| Body font | DM Sans |
| Mono font | JetBrains Mono |

The Tailwind `gold-500` and `accent` tokens and `ADMIN_COLORS.gold` currently hold the old gold. On public pages, use `#C9982A` directly. In admin screens, keep using `ADMIN_COLORS`. Do not change a token's value without the owner's approval.

### Accessibility

- Text contrast is at least 4.5:1. Gold `#C9982A` passes on navy (6.5:1) but not on white (2.6:1), so do not use it for text on light backgrounds.
- Every interactive element has a visible focus style.
- Every input has a label.

## 6. Must not change without the owner's explicit approval

- Repository collaborators, settings and name. The spelling "Platfrom" is intentional; never rename it.
- Repository visibility.
- The admin path mechanism.
- AB Press. It is locked, including `components/book/PracticeKitTemplate.tsx`, `lib/ab-press-builder.ts`, and its `generate-pq` route under `app/api/<admin>/ab-press/`. Make no changes unless the owner explicitly asks. One owner-approved exception: its admin login-check lines may later be replaced by the shared check.
- Addresses (URLs and slugs) of published articles, question sets, courses and jobs. Change one only with a permanent redirect. Never re-generate a slug for an existing row.
- Job records. They are kept, never deleted; expired jobs are hidden. The only exception: a job row created moments earlier in the same request may be removed if checkout set-up fails, because it was never public.
- Database tables that look unused. Never drop a table on code evidence alone.
- The EthioTax DNS and Worker set-up.
- Hosting firewall and bot-protection settings.
- Spend limits on paid services.
- Main navigation and the home page header. Repairs only, with approval.
- The similar-jobs feature. It stays off until it is rebuilt to use precomputed results.
- The database. No change without a fresh backup and the owner's approval of the exact change.
- Any separate project of the owner's, including anything sharing this database. It is not touched from here.

## 7. How a job reports

Every job writes one report file in the git-ignored `reports/` folder.

1. Confirm the file is ignored with `git check-ignore -v reports/<name>.md`. Stop if it is not.
2. If the file already exists, append an addendum rather than replacing it.
3. Write **Section 0: Step R** before changing anything: the goal, the plan, assumptions and any disagreement with the brief. Save it. Never rewrite Section 0.
4. Do the work and append the rest. Mark anything that cannot be proven from the repository as UNVERIFIED, and say what would settle it.
5. Record the commands run, the checks and their results, the commit, how to undo it, and confirmation of what was and was not pushed.
6. List your own slips honestly, however small.
7. Finish by printing only two lines:

```text
Report: reports/<name>.md
Status: <one line>
```

Disagree before acting. If a brief is wrong, unsafe or contradictory, say so in Section 0 and stop if it is unsafe.

## 8. Legacy numbered rules

Code comments cite rule numbers such as "Rule 101". `docs/RULES.md` lists every known number, with its status. This guide takes priority over that table.
