-- 0005_email_subscribers_pending.sql
-- Date written: 2026-09-14 — Session 13, Task 4/5 (subscribe dedup)
--
-- APPLIED: this migration was already run by the operator directly in the
-- Supabase SQL editor on 14 September 2026, BEFORE this corrected version
-- was written. This file is a record of what was applied and a corrected
-- baseline, not a pending change — running it again is safe (both
-- statements are idempotent) but is not required.
--
-- CORRECTED 2026-09-14: the CREATE TABLE section below was originally
-- written from inference (reading application code, not the database) and
-- was WRONG in several places — notably, it guessed `status` was nullable
-- with no default, and it omitted `tags`, `created_at` and `updated_at`
-- entirely because no application code in this repo references them. The
-- operator subsequently queried information_schema directly against the
-- live table and supplied the authoritative column list, reproduced below
-- exactly. Every column, type, nullability and default in the CREATE
-- TABLE statement now comes from that live introspection, not from
-- inference — nothing here is guessed.
--
-- SCOPE NOTE (carried over from the original version of this file):
-- migrations/README.md documents this directory as covering only seven
-- named AccountingBody-owned tables, and email_subscribers is not among
-- them. Both statements below remain non-destructive regardless (see
-- SAFETY below). This is unchanged from the original version and still
-- worth the operator's awareness, but is not re-litigated here since the
-- operator has already run this migration.
--
-- WHAT THIS FILE DOES — exactly two things:
--
-- (A) CREATE TABLE IF NOT EXISTS public.email_subscribers — a baseline
--     capture of the table's live structure, sourced from
--     information_schema, not inferred from application code. Because the
--     table already exists in production, this statement is a NO-OP
--     against the live database — IF NOT EXISTS means Postgres does not
--     inspect or reconcile the existing table's actual columns,
--     constraints or types against what's written here. It exists purely
--     so this repo has an accurate, reviewable baseline for this table.
--
-- (B) ALTER TABLE ... ADD COLUMN IF NOT EXISTS last_confirmation_sent_at
--     — the column the subscribe-dedup feature (app/api/subscribe/route.ts,
--     lib/subscribe-dedup.ts) reads and writes. Already applied live;
--     kept here, unchanged, because it is idempotent and safe to leave in
--     place as the historical record of the actual change.
--
-- SAFETY — this project has NO DATABASE BACKUPS:
--   * CREATE TABLE IF NOT EXISTS — never drops, alters, or re-creates an
--     existing table; a no-op if the table is already there.
--   * ALTER TABLE ... ADD COLUMN IF NOT EXISTS — never touches an
--     existing column; a no-op if the column is already there (which it
--     now is).
--   * No DROP, DELETE, UPDATE, TRUNCATE, ALTER COLUMN, or ALTER TYPE
--     anywhere in this file.
--   * Both statements are safely re-runnable any number of times.


-- ----------------------------------------------------------------------------
-- (A) Baseline capture — sourced from information_schema (authoritative),
-- supplied by the operator 2026-09-14. Expected no-op on production, since
-- the table already exists with this exact shape.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id                        uuid        NOT NULL DEFAULT gen_random_uuid(),
  email                     text        NOT NULL,
  platform                  text        NOT NULL,
  status                    text        NOT NULL DEFAULT 'subscribed'::text,
  source                    text,
  tags                      text[]               DEFAULT '{}'::text[],
  subscribed_at             timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at           timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  confirmation_token        text,
  last_confirmation_sent_at timestamptz,
  CONSTRAINT email_subscribers_pkey PRIMARY KEY (id),
  -- Confirmed live by usage, not just inferred: the confirm-subscription
  -- upsert (app/api/confirm-subscription/route.ts:49-54) and the
  -- subscribe-dedup upsert (app/api/subscribe/route.ts) both target
  -- onConflict: "email,platform", which requires a unique or exclusion
  -- constraint on exactly these two columns. Exact live constraint name
  -- still unconfirmed; this name is a plausible identifier only.
  CONSTRAINT email_subscribers_email_platform_key UNIQUE (email, platform)
);


-- ----------------------------------------------------------------------------
-- (B) The real change — adds the column the subscribe-dedup feature
-- depends on. Nullable, no default, matching the live column exactly.
-- ----------------------------------------------------------------------------
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS last_confirmation_sent_at timestamptz;
