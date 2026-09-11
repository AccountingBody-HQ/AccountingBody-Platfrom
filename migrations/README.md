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

Migrations in this directory cover only the seven AccountingBody-owned tables:

```
jobs  job_providers  provider_runs  job_applications
employer_briefs  job_seeker_registrations  firms_applications
```

Rule 6 stands: the HagerLand `hrlake` / `et.*` schemas are off-limits. Never
extend a migration here to touch another product's tables.

## Known gaps in the baseline

`0001_baseline.sql` does not yet capture RLS policies, triggers, functions,
sequences or extensions. It is sufficient to review and reason about the
schema in code; it is **not** yet sufficient for a true from-scratch rebuild.
Closing those gaps is a tracked follow-up.
