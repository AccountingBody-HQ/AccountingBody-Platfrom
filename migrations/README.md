# Database migrations

## The rule

**No schema change is applied by hand only.** Every change to the database —
a new column, an altered constraint, a new index, a backfill — gets a numbered
`.sql` file in this directory containing the exact DDL that was run, committed
in the same commit as the code that depends on it.

Applying the change in the Supabase SQL editor is still how it actually gets
run (the Codespace has no database credentials). The file is not a substitute
for that. It is the record that the change happened, what it was, and why.

## Why this exists

Before `0001_baseline.sql` (11 September 2026), this platform had **no
migration files at all**. Seven columns were added by hand in Session 4, one
more in Session 5, and the schema's only definition lived inside the Supabase
project. It could not be reviewed, diffed, rebuilt, or reproduced anywhere.

That was the single largest maintainability weakness in the system — flagged
across three consecutive handovers and never addressed. This directory is the
fix.

## Naming

```
0001_baseline.sql
0002_short_description_of_change.sql
0003_another_change.sql
```

Four-digit zero-padded prefix, incrementing, never reused. Lowercase
underscore-separated description. One logical change per file.

## What goes in a migration file

- A header comment: date, which session, and **why** — not just what.
- The exact DDL that was run against production.
- Where a change is destructive or irreversible, say so explicitly at the top.
- Where a change was applied to live data (a backfill, a status sweep), include
  the `UPDATE`/`SELECT` exactly as run, and record the row count it affected.

## Scope — important

The `public` schema is **shared** between AccountingBody, EthioTax, GPE and
HagerLand. It holds 50+ tables, most of which this platform does not own.

Migrations in this directory cover only the AccountingBody-owned tables:

```
jobs  job_providers  provider_runs  job_applications
employer_briefs  job_seeker_registrations  firms_applications
site_counts
```

`site_counts` (pre-counted totals for public pages) was added by `0009`.

Rule 6 stands: the HagerLand `hrlake` / `et.*` schemas are off-limits. Never
extend a migration here to touch another product's tables.

## Files

| File | What it records |
|---|---|
| `0001_baseline.sql` | Table baseline |
| `0002_rls_triggers_functions.sql` | RLS, triggers, functions, foreign keys |
| `0003_search_jobs_ranked.sql` | Ranked job search function |
| `0004_remove_ctr_from_ranking.sql` | Ranking without click-through rate |
| `0005_email_subscribers_pending.sql` | Pending email subscribers |
| `0006_active_job_countries.sql` | Countries with active jobs |
| `0007` | Unused number; left unused on purpose |
| `0008_saved_jobs.sql` | Saved jobs |
| `0009_site_counts_and_jobs_browsable_index.sql` | `site_counts` table, its refresh function, the newest-first jobs index and the 10-minute pg_cron schedule. Applied 11 Nov 2026 as three separate queries (the index must run alone). Checks and rollback: `proposed/2026-11-11-speed/` |

## pg_cron jobs

Scheduled jobs inside the database, as found on 11 Nov 2026:

| jobid | Name | Schedule | Recorded in |
|---|---|---|---|
| 1 | `delete-unverified-candidates` | `0 2 * * *` | Not in these migrations. Pre-existing; to be captured in the Phase 4 schema capture |
| 2 | `delete-unconfirmed-briefs` | `0 2 * * *` | Not in these migrations. Pre-existing; to be captured in the Phase 4 schema capture |
| 3 | `refresh-site-counts` | `*/10 * * * *` | `0009` |

## Known gaps in the baseline

`0001_baseline.sql` does not yet capture RLS policies, triggers, functions,
sequences or extensions. It is sufficient to review and reason about the
schema in code; it is **not** yet sufficient for a true from-scratch rebuild.
Closing those gaps is a tracked follow-up.
