# Legacy rules

Earlier work on this project used a numbered rule list. The full list was not kept, so this table rebuilds what is known from code comments and from the owner's notes. `CLAUDE.md` is the working guide and summarises the rules still in force. If the two differ, `CLAUDE.md` wins.

**Reading the table**

- **Status:** KEEP (in force as written), REWRITE (in force with the wording here), RETIRE (no longer applies).
- **Text lost:** the original wording cannot be recovered. Such a rule is **not in force unless restored**, even if its topic is known.
- **From code:** the meaning is read from a code comment, not from the original list, and the owner has not yet confirmed it.
- **Collision:** two meanings share one number, or may do. Do not cite these numbers alone; describe the rule.
- `<admin>` stands for the admin area's folder name. The admin path comes from `ADMIN_PATH`.

| Number | Rule | Status | Reason | Where it applies |
|---|---|---|---|---|
| 1 | The admin path comes from the `ADMIN_PATH` environment variable. Its value is never written in new code or documents. | REWRITE | Wording now also covers documents. | `middleware.ts` |
| 2, 3 | Text lost — not in force unless restored. | — | No record found. | — |
| 4 (a) | Never run `npm audit fix --force`. | KEEP | Forced upgrades can break the app. **Collision** with 4 (b). | `package.json` |
| 4 (b) | A job can be saved only if it is active, not past its expiry, and shown on this platform. | KEEP | From code. Looks like a step number from a feature brief, not a project rule. **Collision** with 4 (a). | `lib/saved-jobs-store.ts` |
| 5 | Never rename `middleware.ts`, except as an owner-approved step in a framework upgrade. | REWRITE | Adds the one approved route for a rename. | `middleware.ts` |
| 6 | Other products' database schemas and tables are off-limits. Migrations here cover only tables this platform owns. | KEEP | From code. **Possible collision:** the original rule 6 text is lost. | `migrations/README.md`, `migrations/0001_baseline.sql`, `migrations/0002_rls_triggers_functions.sql` |
| 7–9 | Text lost — not in force unless restored. | — | No record found. | — |
| 10 | Admin queries filter by site, using the column that table has (`platform` or `show_on_sites`). A screen meant to show all sites says so in a comment. | REWRITE | The site column differs by table. See rule 57. | `app/<admin>/`, `app/api/<admin>/` |
| 11 | Text lost — not in force unless restored. | — | No record found. | — |
| 12 | Concerned Sanity. Text lost — not in force unless restored. | RETIRE | Sanity is retired. | `sanity/` |
| 13–19 | Text lost — not in force unless restored. | — | No record found. | — |
| 20 | Use Python pathlib for TSX file writes. | RETIRE | Replaced by the edit tools, which handle bracketed paths safely. Confirmed by the owner. | `CLAUDE.md` |
| 21–33 | Text lost — not in force unless restored. | — | No record found. | — |
| 34 | Use Python pathlib for TSX file writes. | RETIRE | Same as rule 20. Confirmed by the owner. | `CLAUDE.md` |
| 35–37 | Text lost — not in force unless restored. | — | No record found. | — |
| 38 | Concerned Careerjet. Text lost — not in force unless restored. | RETIRE | Careerjet is retired. | `app/api/careerjet/route.ts` |
| 39 | Concerned Careerjet. Text lost — not in force unless restored. | RETIRE | Careerjet is retired. | `app/api/careerjet/route.ts` |
| 40–51 | Text lost — not in force unless restored. | — | No record found. | — |
| 52 | Query tables flat, with no embedded relations. | KEEP | From code. **Possible collision:** original text lost. | `app/api/<admin>/courses/[courseId]/route.ts`, `app/<admin>/courses/page.tsx` |
| 53 | Text lost — not in force unless restored. | — | No record found. | — |
| 54 | Copy code into a self-contained page rather than importing it from another page. | RETIRE | From code. Conflicts with single sources. Confirmed by the owner. **Possible collision:** original text lost. | `app/<admin>/content-factory/page.tsx` |
| 55 | Concerned Sanity. Text lost — not in force unless restored. | RETIRE | Sanity is retired. | `sanity/` |
| 56 | Text lost — not in force unless restored. | — | No record found. | — |
| 57 | An exception to rule 10. Text lost — not in force unless restored. | REWRITE | Exceptions are now stated in a comment on each screen. | `app/<admin>/`, `app/api/<admin>/` |
| 58 | Text lost — not in force unless restored. | — | No record found. | — |
| 59 | Scenario questions never shuffle their options. | KEEP | Option order is part of the question. | `components/QuizRenderer.tsx` |
| 60 | Text lost — not in force unless restored. | — | No record found. | — |
| 61 | Normalisers have no runtime dependencies beyond the standard library, so they work in Node.js routes and at the edge. | KEEP | From code. **Possible collision:** original text lost. | `lib/article-normaliser.ts`, `lib/publication-filter.ts` |
| 62–65 | Text lost — not in force unless restored. | — | No record found. | — |
| 66–68 | AB Press keeps single sources for its templates and is locked. The wording of each rule is lost; the combined meaning is known. | KEEP | Published output depends on these files. | `components/book/PracticeKitTemplate.tsx`, `lib/ab-press-builder.ts`, `app/api/<admin>/ab-press/generate-pq/route.ts` |
| 69 | Never create a Supabase client, or any other SDK client, at module scope. Create it inside a function. | REWRITE | Extends the rule from Supabase to all SDK clients. | `lib/jobs.ts`, `lib/db.ts`, `lib/providers.ts` |
| 70 | New job queries go in `lib/jobs.ts`. | REWRITE | Applies to new work; older call sites move when they are next changed. | `lib/jobs.ts` |
| 71 | New job emails go in `lib/jobEmails.ts`. | REWRITE | Applies to new work; older call sites move when they are next changed. | `lib/jobEmails.ts` |
| 72 | The gold accent is `#C9982A`. Never introduce `#D4A017` in new code. | REWRITE | Older tokens still hold the old gold; see `CLAUDE.md`. Related to rule 92. | `tailwind.config.ts`, `app/globals.css`, `lib/admin-theme.ts` |
| 73 | No `on*` event handlers in server components. | KEEP | They fail at runtime. | `app/`, `components/` |
| 74 | Purge the Vercel and Cloudflare caches after a deploy that changes cached pages. | KEEP | Otherwise visitors keep seeing old pages. | `CLAUDE.md` |
| 75–81 | Unknown whether these existed. Not in force unless restored. | — | No record found. | — |
| 82 | Provider knowledge lives in the `job_providers` table, never hard-coded in TypeScript. | KEEP | From code. | `migrations/0001_baseline.sql`, `lib/providers.ts` |
| 83–91 | Unknown whether these existed. Not in force unless restored. | — | No record found. | — |
| 92 | Admin colours come from the `ADMIN_COLORS` tokens. | KEEP | From code. Related to rule 72. | `lib/admin-theme.ts` |
| 93 | Internal fields and raw errors never reach an anonymous visitor. | KEEP | From code. | `lib/saved-jobs-store.ts` |
| 94–97 | Unknown whether these existed. Not in force unless restored. | — | No record found. | — |
| 98 | Detect duplicate jobs with a plain `insert()`, treating error `23505` as a duplicate. Do not use `upsert` against the partial index. | KEEP | From code. | `migrations/0001_baseline.sql`, `app/api/ingest/[slug]/route.ts` |
| 99, 100 | Unknown whether these existed. Not in force unless restored. | — | No record found. | — |
| 101 | Never assume success. Check and log the returned error. | REWRITE | From code. Written for provider code; now applies to all Supabase and email calls. | `lib/providers.ts`, `lib/provider-alerts.ts` |
| 102, 103 | Unknown whether these existed. Not in force unless restored. | — | No record found. | — |
| 104 | Relevance is enforced for a provider unless its own filter has been tested and confirmed. | KEEP | From code. | `app/<admin>/providers/new/page.tsx`, `app/<admin>/providers/[slug]/edit/page.tsx` |
| 105 | Rejected jobs stay out of the duplicate check, so they can be ingested again later. | KEEP | From code. | `migrations/0001_baseline.sql` |
| 106–119 | Unknown whether these existed. Not in force unless restored. | — | No record found. | — |
| 120 | A total provider outage must be recorded as a failed run, never as a successful run with zero jobs. | KEEP | From code. | `lib/adapters/generic-rest.ts`, `lib/adapters/rss.ts`, `lib/adapters/adzuna.ts` |
| 121 | Unknown whether this existed. Not in force unless restored. | — | No record found. | — |
| 122 | A route never reports success while quietly keeping the old value. | KEEP | From code. | `app/api/<admin>/providers/[slug]/edit/route.ts` |
