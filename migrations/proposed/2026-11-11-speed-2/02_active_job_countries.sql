-- ============================================================================
-- NOT APPLIED. Proposed 11 November 2026 (speed job part 2).
-- Run after 01 (or on its own; it does not depend on 01).
-- Undo: 99_rollback.sql (drops this function only if this file created it).
-- ============================================================================
--
-- What this does
--   Creates public.get_active_job_countries(p_platform text), exactly as
--   migrations/0006_active_job_countries.sql defines it and exactly as the
--   code calls it: lib/jobs.ts fetchActiveJobCountries,
--     rpc('get_active_job_countries', { p_platform: platform })
--   reading rows { country, job_count }. Every /jobs/listings visit logs
--   "Could not find the function public.get_active_job_countries(p_platform)
--   in the schema cache" today, which means the API cannot see it.
--   Then it tells the API (PostgREST) to reload, so the site sees the
--   function at once.
--
-- If the function ALREADY exists (04a, check 'get_active_job_countries'),
-- this file stops and changes nothing: the API may then only need the
-- reload. In that case run just the last line of this file on its own:
--   NOTIFY pgrst, 'reload schema';
--
-- Additive: creates one function; no table, column or index changes.
-- Safe to re-run: after a successful run the function carries the
-- 'AccountingBody:' comment, so the check lets the replace go ahead.
-- ============================================================================

BEGIN;

-- Stop, changing nothing, if a function with this exact signature exists
-- and was not created by this file. to_regprocedure returns NULL for a
-- missing function instead of failing.
DO $$
BEGIN
  IF to_regprocedure('public.get_active_job_countries(text)') IS NOT NULL
     AND coalesce(obj_description(to_regprocedure('public.get_active_job_countries(text)'), 'pg_proc'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.get_active_job_countries(text) already exists and was not created by this file. Nothing was changed. See the note at the top of this file.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_active_job_countries(
  p_platform text
)
RETURNS TABLE (
  country   text,
  job_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    j.location_country AS country,
    count(*)           AS job_count
  FROM public.jobs j
  WHERE j.status = 'active'
    AND j.platform @> ARRAY[p_platform]
    AND (j.expires_at IS NULL OR j.expires_at > now())
    AND j.location_country IS NOT NULL
  GROUP BY j.location_country
  ORDER BY job_count DESC, country ASC
$$;

COMMENT ON FUNCTION public.get_active_job_countries(text) IS
  'AccountingBody: countries with browsable jobs per platform (migrations/0006; created by speed job part 2).';

-- Same access as 0006: only the server key calls it. Supabase grants
-- EXECUTE on new functions to the API roles by default, so those are taken
-- away explicitly.
REVOKE ALL ON FUNCTION public.get_active_job_countries(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_job_countries(text) TO service_role;

COMMIT;

-- Tell the API to reload its list of functions now.
NOTIFY pgrst, 'reload schema';
