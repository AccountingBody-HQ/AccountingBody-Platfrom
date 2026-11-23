# Database migrations

## The rule

**No schema change is applied by hand only.** Every change to the database —
a new column, an altered constraint, a new index, a backfill — gets a numbered
`.sql` file in this directory containing the exact DDL that was run, committed
in the same commit as the code that depends on it.

The change is run either in the Supabase SQL editor or, under the owner's
hands-free arrangement, from the Codespace with `psql`, always after a fresh
backup and the owner's approval of the exact change. The file is not a
substitute for running it. It is the record that the change happened, what it
was, and why.

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
site_counts  job_similar  admin_recycle_bin
```

`admin_recycle_bin` (added by `0027`) holds a full copy of anything the admin
area deletes or a Course Factory save replaces; only the admin routes write
it (`lib/recycle-bin.ts`), and each copy expires after 90 days.

`job_similar` (saved "Similar current roles" lists, one per job and site) was
added by `0020`. Its rows are written only by the nightly
`/api/cron/similar-jobs` route.

`site_counts` (pre-counted totals for public pages) was added by `0009`.
Its rows are written by `public.refresh_site_counts()`, which pg_cron job 3
runs every 10 minutes. Since `0011` the job writes both kinds of key from one
read of `jobs`:

- `jobs_browsable:<ab|et>`: plain-list totals
- `jobs_browsable:<ab|et>:country:<location_country>`: one-country totals

0009's `refresh_site_counts` body is superseded by `0011`.

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
| `0006_active_job_countries.sql` | Countries with active jobs. Never applied on its own: the function did not exist until `0010` created it (11 Nov 2026) |
| `0007` | Unused number; left unused on purpose |
| `0008_saved_jobs.sql` | Saved jobs |
| `0009_site_counts_and_jobs_browsable_index.sql` | `site_counts` table, its refresh function, the newest-first jobs index and the 10-minute pg_cron schedule. Applied 11 Nov 2026 as three separate queries (the index must run alone). Checks and rollback: `proposed/2026-11-11-speed/` |
| `0010_search_jobs_ranked_v2_and_countries.sql` | Faster `search_jobs_ranked` (v2: the query is written out with the actual values on each call) and `get_active_job_countries`, as defined by `0006`. Applied 11 Nov 2026 as two separate queries. Checks, trial helpers and rollback: `proposed/2026-11-11-speed-2/` |
| `0011_refresh_site_counts_one_pass_with_countries.sql` | New `refresh_site_counts` body: plain-list and one-country totals from one read of `jobs` (replaces the `0009` body; the table, index and cron job stay as `0009` records them). Applied 11 Nov 2026 23:04 UTC as one query. Timing check, after-check and rollback: `proposed/2026-11-11-speed-3/` |
| `0012_backfill_job_country_from_location_text.sql` | Backfill of `jobs.location_country` from the last comma segment of `location_text`, for jobs imported before every country was recognised. Part A is a read-only preview, Part B the update, Part C the undo. No schema change. **Part B applied 14 Nov 2026 12:27:28 UTC** from the Codespace (`psql`, one transaction, after a fresh backup): 62 rows (54 active, 8 not), all stamped `updated_at = 2026-11-14 12:27:28.892284+00`. Undo only with the owner's approval: Part C with that stamp and expected count 62 |
| `0013_et_sitemap_index.sql` | **Applied 15 Nov 2026, 18:35 UTC.** A small index on `jobs` (`idx_jobs_et_sitemap`, about 1 MB) for the EthioTax job sitemap read: only jobs whose platform includes `et` and whose status is active or expired, in id order, carrying the four columns the sitemap needs. Part A is read-only pre-checks, Part B the index (run alone, outside a transaction), Part C a read-only verify, Part D the undo. No schema change other than the index. Applied once; do not run it again. |
| `0014_repair_job_country_display_strings.sql` | **Part B applied 15 Nov 2026, 21:02 UTC (3914 rows).** Repair of `jobs.location_country` for Adzuna jobs imported on 9 Sep 2026 that stored the provider's display text (for example a town) as the country: mapped to the real country by the stored value, the last segment of `location_text`, or the provider's single country. Undo: Part C with the private before-image CSV, only with the owner's approval |
| `0015_jobs_ai_duplicate_of_index.sql` | **Applied 17 Nov 2026, 09:18 UTC.** A small partial index on `jobs` (`idx_jobs_ai_duplicate_of`, 8 KB) on `ai_duplicate_of`, only for rows where it is set. `ai_duplicate_of` is a self foreign key (`ON DELETE SET NULL`): without this index every deleted job made the database scan the whole `jobs` table, and the daily retention cron's deletes ran past the API role's 8 s time limit. Run alone, outside a transaction (`CONCURRENTLY`). No schema change other than the index. Applied once; do not run it again. The undo is at the end of the file. |
| `0016_jobs_retention_due_index.sql` | **Applied 17 Nov 2026, 12:03 UTC.** A small partial index on `jobs` (`idx_jobs_retention_due`, 136 KB) on `closed_at`, only for imported jobs that are expired. The retention check in `/api/ops-status` and the daily retention cron look for expired imported jobs closed before a cutoff; without this index the database walked every expired job, and a fresh status answer could come close to its read time limit. Run alone, outside a transaction (`CONCURRENTLY`). No schema change other than the index. Applied once; do not run it again. The undo is at the end of the file. |
| `0017_anon_form_policies_and_truncate.sql` | **Record only - applied 17 Nov 2026, 13:04 UTC (D216).** Removed the 6 public INSERT rules (role anon, check true) on the four form tables and took TRUNCATE away from anon and authenticated on every public table (and for tables postgres creates later). The forms write with the server key. No rows changed. The file stops itself if run. The undo is at the end of the file. |
| `0018_retired_areas_removed.sql` | **Record only - applied 17 Nov 2026, 14:05 and 14:27 UTC (D220, D222).** Owner decision D214: the retired areas removed - HRLake (its area, the 13 et views and the function that read it, its 1 subscriber row), BirrBank, the empty ab and et areas, and the GPE rows. A backup run before each change. The file stops itself if run. Undo: restore from those backups (docs/RUNBOOK.md). |
| `0019_unused_public_tables_removed.sql` | **Record only - applied 17 Nov 2026, 19:11 and 20:18 UTC (D226, D230).** The 31 public tables nothing used (24 empty, then 7 more incl. the old account tables), two helper functions and two empty links removed; the sign-up function now only returns NEW. public now holds only the 25 tables the code uses. A backup run before each change. The file stops itself if run. Undo: restore from those backups (docs/RUNBOOK.md). |
| `0020_job_similar.sql` | **Applied 21 Nov 2026, 02:18:12 UTC (D279)**, from the Codespace (`psql`, one transaction, after a fresh backup). The empty table `job_similar`: one saved similar-jobs list per job and site (up to 6 ids), row level security on with no policy, rights for `service_role` only. Written only by `/api/cron/similar-jobs` (D277). Applied once; do not run it again (it stops itself if run). Undo (owner decision only): `DROP TABLE IF EXISTS public.job_similar;` |
| `0021_duplicate_adverts_counts_and_search.sql` | **Record file, not applied yet (JD-1, D283).** For hiding marked extra copies of one advert (`jobs.ai_duplicate_of`): Part A gives `refresh_site_counts` (same single read of `jobs`) extra `jobs_primary:<ab\|et>` and `jobs_primary:<ab\|et>:country:<location_country>` rows of live primaries, keeping every `jobs_browsable:` row as it is; Part B adds `search_jobs_ranked_primary`, the `0010` v2 search with one added condition (`ai_duplicate_of IS NULL`), same inputs, output and access. Each part one query, applied later by an owner-approved database job after a fresh backup. `JOB_DUPLICATES_HIDDEN` must stay off until it is applied. Undo at the end of the file |
| `0022_jobs_drop_raw_source_data.sql` | **Record file, not applied yet (DL-1, D287).** Removes the unused column `jobs.raw_source_data` (a copy of each provider's original job record, never shown; about 48 MB) with `lock_timeout` 3s. The code stopped naming the column in PR #83; applied later by an owner-approved database job (DL-2) after a fresh backup, only after that PR is live. The drop rewrites no rows; the space comes back at the next `VACUUM FULL public.jobs` (DL-3). Undo (structure only; the data comes back only from the backup) in the file's comments |
| `0023_ops_database_size.sql` | **Record file, not applied yet (LB-1, D287).** The function `public.ops_database_size()` (database size in bytes; SECURITY INVOKER, empty search path, EXECUTE for `service_role` only) read by the `database-size` check of `/api/ops-status`. One transaction with a self-check; applied by an owner-approved database job (M-85) after a fresh backup, BEFORE the LB-1 pull request is merged (until then the check answers `unknown`). Undo: `DROP FUNCTION IF EXISTS public.ops_database_size();` |
| `0024_provider_runs_drop_raw_response_sample.sql` | **Record file, not applied yet (LB-1, D287).** Removes the unused column `provider_runs.raw_response_sample` (one provider record per import run, never read) with `lock_timeout` 3s. Applied by M-85 after a fresh backup, only after the LB-1 pull request is live (the code stopped writing it there). Undo (structure only) in the file's comments |
| `0025_jobs_drop_idx_employer_email.sql` | **Record file, not applied yet (LB-1, D287).** Removes the unused index `idx_jobs_employer_email` (0 scans; no code filters by that column). One statement, run alone outside a transaction (`CONCURRENTLY`). Applied by M-85 after a fresh backup, after the merge. Undo in the file's comments |
| `0026_revoke_admin_update_field.sql` | **Record only - applied 23 Nov 2026, 14:12:19 UTC (D316).** Took the right to run the old helper function `public.admin_update_field` away from PUBLIC, anon and authenticated; the function itself and its `service_role` right are unchanged. No code uses it. Do not run it again (harmless if re-run). Undo in the file's comments |
| `0027_admin_recycle_bin.sql` | **Record file, not applied yet (BP-1, D315).** The empty table `admin_recycle_bin` (a full copy of anything the admin area deletes or a Course Factory save replaces, kept 90 days) and the function `public.admin_recycle_restore(uuid)` that puts one copy back in one transaction. Row level security on with no policy; table and function for `service_role` only. One transaction with a guard and self-checks; applied by an owner-approved database job after a fresh backup, BEFORE the BP-1 pull request is merged. Undo (removes every copy) in the file's comments |
| `0028_jobs_drop_public_read_policy.sql` | **Record file, not applied yet (BP-2).** Removes the policy "Public read active jobs" (`0002`) on `public.jobs`, which nothing in the site uses (every read runs on the server with the secret key). One DROP POLICY; no table, row, grant or other policy changes; row level security stays on. One transaction with a guard and self-checks, run once as postgres through stdin by an owner-approved database job after a fresh backup, BEFORE or AFTER the BP-2 pull request is merged (the site does not use the policy). Undo (restores the `0002` policy exactly) in the file's comments |

## Compare with the live database before any replace

Before any future `CREATE OR REPLACE` of a function recorded here, compare the
live definition with the repository by fingerprint first (the md5 and length
of `pg_proc.prosrc`). Do not assume the repository text is what is live.

Known case: before `0010`, the live `search_jobs_ranked` was the `0004` body
with Windows-style (CRLF) line endings: md5 `9309125892ecddec6014de33e7529552`,
length 3463. The file in this directory has Unix-style (LF) endings: md5
`aad246bd049e61611aed2c5391fdabb3`, length 3389. Same logic, different
fingerprint. The `0010` header gives both fingerprints for its v2 body.

`refresh_site_counts` (live text has CRLF line endings in both cases):

| Body | md5 (CRLF) | Length |
|---|---|---|
| `0009` (live until 11 Nov 2026 23:04 UTC) | `ec9c609a0df3f9e685acc84a0144e4b8` | 507 |
| `0011` (live since then) | `f5a0f31a2f07fac7c832745d2b301607` | 1914 |

The LF fingerprints of both bodies are in the `0011` header.

## pg_cron jobs

Scheduled jobs inside the database, as found on 11 Nov 2026:

| jobid | Name | Schedule | Recorded in |
|---|---|---|---|
| 1 | `delete-unverified-candidates` | `0 2 * * *` | Not in these migrations. Pre-existing; to be captured in the Phase 4 schema capture |
| 2 | `delete-unconfirmed-briefs` | `0 2 * * *` | Not in these migrations. Pre-existing; to be captured in the Phase 4 schema capture |
| 3 | `refresh-site-counts` | `*/10 * * * *` | `0009` (job and command); the function it calls has the `0011` body |

## Known gaps in the baseline

`0001_baseline.sql` does not yet capture RLS policies, triggers, functions,
sequences or extensions. It is sufficient to review and reason about the
schema in code; it is **not** yet sufficient for a true from-scratch rebuild.
Closing those gaps is a tracked follow-up.
