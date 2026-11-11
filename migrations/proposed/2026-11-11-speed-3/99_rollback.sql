-- ============================================================================
-- NOT APPLIED. Run ONLY if 01b shows a mismatch or an error.
--
-- Undo for 01_refresh_site_counts_v2.sql (speed job part 3):
--   - puts back public.refresh_site_counts() exactly as migration 0009
--     created it (the CREATE statement below is copied byte for byte from
--     migrations/0009_site_counts_and_jobs_browsable_index.sql, body md5
--     03dc514ee0589c531f40ef12f1ad66bf, length 489), with 0009's comment
--     and the same owner-only EXECUTE,
--   - deletes only the rows whose key starts with 'jobs_browsable:' and
--     contains ':country:' or ':search:'. The plain-list rows
--     (jobs_browsable:ab, jobs_browsable:et) are kept.
-- The pg_cron job is not touched: its command does not change.
-- The site keeps working throughout: with those rows gone, one-country and
-- Popular-search lists count live, as before part 3.
--
-- Run the whole file as ONE query. One transaction. Safe to run twice.
-- ============================================================================

BEGIN;

-- Never replace a same-named object that is not ours. to_regclass and
-- to_regprocedure return NULL for a missing object instead of failing.
DO $guard$
BEGIN
  IF to_regclass('public.site_counts') IS NULL
     OR coalesce(obj_description(to_regclass('public.site_counts'), 'pg_class'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.site_counts is missing or is not the AccountingBody table. Nothing was changed.';
  END IF;
  IF to_regprocedure('public.refresh_site_counts()') IS NULL
     OR coalesce(obj_description(to_regprocedure('public.refresh_site_counts()'), 'pg_proc'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.refresh_site_counts() is missing or is not the AccountingBody function. Nothing was changed.';
  END IF;
END
$guard$;

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

REVOKE ALL ON FUNCTION public.refresh_site_counts() FROM PUBLIC, anon, authenticated, service_role;

DELETE FROM public.site_counts
WHERE starts_with(key, 'jobs_browsable:')
  AND (strpos(key, ':country:') > 0 OR strpos(key, ':search:') > 0);

COMMIT;

-- Read-only result: body_is_0009 must be true, filter_rows must be 0.
select
  (
    select md5(p.prosrc) = '03dc514ee0589c531f40ef12f1ad66bf'
    from pg_proc p
    where p.oid = to_regprocedure('public.refresh_site_counts()')::oid
  ) as body_is_0009,
  count(*) filter (where starts_with(key, 'jobs_browsable:')
                     and (strpos(key, ':country:') > 0 or strpos(key, ':search:') > 0)) as filter_rows,
  count(*) filter (where key in ('jobs_browsable:ab', 'jobs_browsable:et')) as plain_rows
from public.site_counts;
