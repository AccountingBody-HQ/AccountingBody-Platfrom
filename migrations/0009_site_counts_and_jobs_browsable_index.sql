-- ============================================================================
-- 0009_site_counts_and_jobs_browsable_index.sql
-- APPLIED 11 Nov 2026 via Supabase SQL editor (owner).
-- After backup run #2 (18:16 UTC, 53 MB, self-check passed).
--
-- Why (owner decision D108, speed job): the jobs list, footer, home page and
-- jobs hub read the browsable-jobs total from a pre-counted row instead of
-- counting public.jobs on each visit, and the default jobs list (no search
-- words, no chosen sort) is a plain newest-first read served by one index.
-- App code: lib/jobs.ts (getBrowsableJobsTotal, getDefaultOrderJobs,
-- DEFAULT_LIST_ORDER) and app/api/jobs/direct/route.ts.
--
-- Applied as THREE separate queries, in this order:
--   PART 1  table, policy, grants and refresh function (one transaction)
--   PART 2  the index. CREATE INDEX CONCURRENTLY cannot run inside a
--           transaction: it must be run ALONE, as its own query.
--   PART 3  first count and the 10-minute pg_cron schedule
-- Do not run this file as one query. The text of each part is exactly what
-- was run (from migrations/proposed/2026-11-11-speed/01, 02 and 03; the
-- first attempt at part 1 errored in its guard and changed nothing, and
-- part 1 below is the corrected version, commit 4f24318, that was applied).
--
-- Result: idx_jobs_browsable_newest valid (3616 kB); pg_cron jobid 3
-- 'refresh-site-counts' '*/10 * * * *', active, first run 18:40:00 UTC
-- succeeded; site_counts jobs_browsable:ab 12380, jobs_browsable:et 3089
-- (equal to the exact counts).
--
-- Additive: no existing table, column, function, policy or index changed.
-- Checks and rollback: migrations/proposed/2026-11-11-speed/
-- (04*_checks, 99_rollback.sql).
-- Scope: new AccountingBody table public.site_counts (see README.md) and
-- one index on public.jobs.
-- ============================================================================


-- ── PART 1: table, policy, grants, refresh function (one query) ────────────

BEGIN;

-- The public schema is shared with other products. Stop, changing nothing,
-- if a table or function with these names already exists and is not ours
-- (ours carry a comment starting 'AccountingBody:'). to_regclass and
-- to_regprocedure return NULL for a missing object instead of failing, so
-- these checks also work on a database where neither object exists yet.
DO $$
BEGIN
  IF to_regclass('public.site_counts') IS NOT NULL
     AND coalesce(obj_description(to_regclass('public.site_counts'), 'pg_class'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.site_counts already exists and is not the AccountingBody table. Nothing was changed.';
  END IF;
  IF to_regprocedure('public.refresh_site_counts()') IS NOT NULL
     AND coalesce(obj_description(to_regprocedure('public.refresh_site_counts()'), 'pg_proc'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.refresh_site_counts() already exists and is not the AccountingBody function. Nothing was changed.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.site_counts (
  key        text        PRIMARY KEY,
  value      bigint      NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_counts IS
  'AccountingBody: pre-counted totals for public pages (D108). Written only by public.refresh_site_counts().';

ALTER TABLE public.site_counts ENABLE ROW LEVEL SECURITY;

-- Supabase gives new public tables to anon/authenticated/service_role by
-- default; take that away, then give back read-only to service_role.
REVOKE ALL ON TABLE public.site_counts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.site_counts TO service_role;

-- service_role skips RLS anyway; the policy states the intent explicitly.
DROP POLICY IF EXISTS site_counts_read_service_role ON public.site_counts;
CREATE POLICY site_counts_read_service_role
  ON public.site_counts
  FOR SELECT
  TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.refresh_site_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
BEGIN
  INSERT INTO public.site_counts AS sc (key, value, updated_at)
  SELECT
    'jobs_browsable:' || p.platform,
    (
      SELECT count(*)
      FROM public.jobs j
      WHERE j.status = 'active'
        AND j.platform @> ARRAY[p.platform]
        AND (j.expires_at IS NULL OR j.expires_at > now())
    ),
    now()
  FROM (VALUES ('ab'::text), ('et'::text)) AS p(platform)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;
END;
$$;

COMMENT ON FUNCTION public.refresh_site_counts() IS
  'AccountingBody: recounts public.site_counts (D108). Called every 10 minutes by pg_cron job refresh-site-counts.';

-- Only the owner (the role running this file, which pg_cron also runs as)
-- may call it. Supabase grants EXECUTE on new functions to the API roles by
-- default, so that is taken away explicitly.
REVOKE ALL ON FUNCTION public.refresh_site_counts() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;


-- ── PART 2: RUN ALONE, as its own query (CONCURRENTLY: no transaction) ─────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_browsable_newest
  ON public.jobs USING btree (published_at DESC NULLS LAST, created_at DESC, id DESC)
  INCLUDE (platform, expires_at)
  WHERE status = 'active';


-- ── PART 3: first count and 10-minute schedule (one query) ─────────────────

-- Step 1, read-only: is pg_cron switched on?
--   One row (pg_cron) -> carry on with steps 2 and 3.
--   No rows           -> switch it on first: Supabase dashboard, Database,
--                        Extensions, pg_cron, enable. That is an owner step.
--   (migrations/0002 recorded pg_cron 1.6.4 as installed on 11 Sept 2026.)
select extname, extversion from pg_extension where extname = 'pg_cron';

-- Step 2: write the first counts now, then show them.
select public.refresh_site_counts();
select key, value, updated_at from public.site_counts order by key;

-- Step 3: recount every 10 minutes, inside the database.
-- Scheduling the same job name again replaces it (pg_cron 1.3 and later),
-- so this line is safe to run twice.
--
-- Why pg_cron and not the existing 15-minute Vercel cron
-- (/api/ingest/orchestrator): it runs inside the database, so it does not
-- depend on a deploy, on the cron secret or on the orchestrator reaching its
-- end (it returns early when no provider is due, or on an error); it needs
-- no grant to the API roles; and every 10 minutes keeps the total within
-- about 12.5 minutes old, inside D108's ~15 minutes. The orchestrator's
-- 15 minutes plus the site's 2-minute cache would not be.
select cron.schedule('refresh-site-counts', '*/10 * * * *', 'select public.refresh_site_counts();');

-- Show the job that is now scheduled.
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'refresh-site-counts';
