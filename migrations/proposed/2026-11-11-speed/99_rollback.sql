-- ============================================================================
-- NOT APPLIED. Undo for 01-03 of the speed job (11 November 2026).
-- Safe to run more than once. The site keeps working throughout: with the
-- table gone it falls back to an estimated total, then to no total.
--
-- Run PART A as one query, then PART B on its own as a separate query
-- (DROP INDEX CONCURRENTLY cannot run inside a transaction).
-- ============================================================================

-- ── PART A: stop the schedule, remove the function and the table ───────────
BEGIN;

DO $$
BEGIN
  -- Only if pg_cron is installed and our job exists. Nested so that
  -- cron.job is only looked at when the extension is there.
  IF EXISTS (select 1 from pg_extension where extname = 'pg_cron') THEN
    IF EXISTS (select 1 from cron.job where jobname = 'refresh-site-counts') THEN
      PERFORM cron.unschedule('refresh-site-counts');
    END IF;
  END IF;

  -- Never drop a same-named object that is not ours.
  IF to_regclass('public.site_counts') IS NOT NULL
     AND coalesce(obj_description('public.site_counts'::regclass, 'pg_class'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.site_counts is not the AccountingBody table. Nothing was changed.';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.refresh_site_counts();
DROP TABLE IF EXISTS public.site_counts;

COMMIT;

-- ── PART B: run alone, as its own query ────────────────────────────────────
-- Kept behind "--" so it cannot run by accident together with PART A.
-- To use it: open a new query, paste the line below, remove the leading
-- "-- " and run it on its own.
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_jobs_browsable_newest;
