-- ============================================================================
-- NOT APPLIED. Proposed 11 November 2026 (speed job, owner decision D108).
-- Run only after the owner has approved it and taken a fresh backup.
-- Order: 04 (before checks) -> 01 -> 02 -> 03 -> 04 (after checks).
-- Undo: 99_rollback.sql.
-- ============================================================================
--
-- What this does
--   Creates one small table, public.site_counts, holding pre-counted totals,
--   and one function, public.refresh_site_counts(), that recounts them.
--   The site reads the jobs total from this table instead of counting the
--   jobs table on each visit (lib/jobs.ts, getBrowsableJobsTotal).
--
-- Rows written by the function
--   jobs_browsable:ab   jobs a visitor can browse on accountingbody.com
--   jobs_browsable:et   jobs a visitor can browse on ethiotax.com
--   One row per platform: the site asks for the total per platform.
--
-- "Browsable" is exactly the filter in lib/jobs.ts (getActiveDirectJobs's
-- count path, the old fetchBrowsableJobsCount, get_active_job_countries):
--   status = 'active'
--   AND platform @> ARRAY[<platform>]
--   AND (expires_at IS NULL OR expires_at > now())
--   with no source restriction.
--
-- Who can read it
--   Every server-side client in lib/supabase-server.ts uses the secret key,
--   so public pages read as service_role. service_role gets SELECT only.
--   anon and authenticated get nothing. Nobody but the function writes.
--
-- Additive: no existing table, column, function, policy or index changes.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- Runs in one transaction; the whole file succeeds or nothing changes.
-- ============================================================================

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
