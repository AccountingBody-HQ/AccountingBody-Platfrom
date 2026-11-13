-- ============================================================================
-- APPLIED 11 Nov 2026 23:04 UTC — kept for checks/rollback; source of truth
-- is migrations/0011_refresh_site_counts_one_pass_with_countries.sql.
-- Do not run it again.
--
-- Speed job part 3 (revised): the refresh that already writes the
-- plain-list totals every 10 minutes (public.refresh_site_counts(),
-- migration 0009, pg_cron job refresh-site-counts) also writes, in the
-- same statement and from the same single read of public.jobs:
--   jobs_browsable:<platform>:country:<location_country exactly as stored>
--     one row per country with at least one browsable job, per platform
-- and then removes the country rows it did not write in this run (for
-- example a country that dropped to no jobs), and any old search rows.
-- No other row is touched.
--
-- "Browsable" is the same as everywhere else:
--   status = 'active' AND platform @> ARRAY[<platform>]
--   AND (expires_at IS NULL OR expires_at > now())
-- The plain totals (jobs_browsable:ab, jobs_browsable:et) are the sum of
-- ALL country groups of that platform, including jobs with no country, an
-- empty country or a very long one, so they equal 0009's count(*) exactly.
-- A platform with no browsable jobs still gets its plain row, with 0.
-- Country rows skip no country, empty names (the site never asks for one)
-- and names over 200 characters (so a key always fits the primary-key
-- index); the site counts those live, as today.
--
-- Same name, no arguments, SECURITY DEFINER, same search_path and
-- statement_timeout, same owner-only EXECUTE as 0009. pg_cron's command
-- ('select public.refresh_site_counts();') does not change.
--
-- Run the whole file as ONE query in the Supabase SQL editor. It is one
-- transaction: if anything fails, including the first run at the end,
-- nothing is changed. Then run 01b_after_check.sql at once.
-- Undo: 99_rollback.sql.
--
-- Function body fingerprints (md5 and length of pg_proc.prosrc):
--   0009 body, LF line endings:   03dc514ee0589c531f40ef12f1ad66bf  489
--   0009 body, CRLF line endings: ec9c609a0df3f9e685acc84a0144e4b8  507
--   this body, LF line endings:   e2fa7cc06c83cef715c3e087180c19be  1860
--   this body, CRLF line endings: f5a0f31a2f07fac7c832745d2b301607  1914
-- ============================================================================

BEGIN;

-- Stop, changing nothing, unless the table and the function exist, are
-- ours (comment starting 'AccountingBody:'), and the live function body is
-- either the 0009 body or this file's body (so running this file twice is
-- safe). to_regclass and to_regprocedure return NULL for a missing object
-- instead of failing.
DO $guard$
DECLARE
  v_md5 text;
BEGIN
  IF to_regclass('public.site_counts') IS NULL THEN
    RAISE EXCEPTION 'public.site_counts does not exist. Nothing was changed.';
  END IF;
  IF coalesce(obj_description(to_regclass('public.site_counts'), 'pg_class'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.site_counts is not the AccountingBody table. Nothing was changed.';
  END IF;
  IF to_regprocedure('public.refresh_site_counts()') IS NULL THEN
    RAISE EXCEPTION 'public.refresh_site_counts() does not exist. Nothing was changed.';
  END IF;
  IF coalesce(obj_description(to_regprocedure('public.refresh_site_counts()'), 'pg_proc'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.refresh_site_counts() is not the AccountingBody function. Nothing was changed.';
  END IF;

  SELECT md5(p.prosrc) INTO v_md5
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.refresh_site_counts()')::oid;

  IF v_md5 NOT IN (
    '03dc514ee0589c531f40ef12f1ad66bf',  -- 0009, LF
    'ec9c609a0df3f9e685acc84a0144e4b8',  -- 0009, CRLF
    'e2fa7cc06c83cef715c3e087180c19be',  -- this file, LF
    'f5a0f31a2f07fac7c832745d2b301607'   -- this file, CRLF
  ) THEN
    RAISE EXCEPTION 'public.refresh_site_counts() body is neither the 0009 body nor this file''s body (md5 %). Nothing was changed.', v_md5;
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
  -- One statement, one read of public.jobs: b is MATERIALIZED, so jobs is
  -- scanned once whatever plan the planner picks for the platform join.
  -- Rows go in key order, so two runs at once lock keys in the same order.
  INSERT INTO public.site_counts AS sc (key, value, updated_at)
  WITH b AS MATERIALIZED (
    SELECT j.platform, j.location_country
    FROM public.jobs j
    WHERE j.status = 'active'
      AND (j.expires_at IS NULL OR j.expires_at > now())
  ),
  p AS (
    SELECT v.platform
    FROM (VALUES ('ab'::text), ('et'::text)) AS v(platform)
  ),
  g AS (
    SELECT p.platform, b.location_country, count(*) AS n
    FROM p
    JOIN b ON b.platform @> ARRAY[p.platform]
    GROUP BY p.platform, b.location_country
  )
  SELECT r.key, r.value, now()
  FROM (
    SELECT
      'jobs_browsable:' || p.platform AS key,
      coalesce(sum(g.n), 0)::bigint AS value
    FROM p
    LEFT JOIN g ON g.platform = p.platform
    GROUP BY p.platform
    UNION ALL
    SELECT
      'jobs_browsable:' || g.platform || ':country:' || g.location_country,
      g.n
    FROM g
    WHERE g.location_country IS NOT NULL
      AND g.location_country <> ''
      AND length(g.location_country) <= 200
  ) AS r
  ORDER BY r.key
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at;

  -- Remove country rows not written in this run (every row written above
  -- has updated_at = now(), fixed for the whole transaction) and any
  -- search rows left from earlier drafts. Only these prefixes are looked at.
  DELETE FROM public.site_counts
  WHERE ((starts_with(key, 'jobs_browsable:ab:country:')
          OR starts_with(key, 'jobs_browsable:et:country:'))
         AND updated_at <> now())
     OR starts_with(key, 'jobs_browsable:ab:search:')
     OR starts_with(key, 'jobs_browsable:et:search:');
END;
$$;

COMMENT ON FUNCTION public.refresh_site_counts() IS
  'AccountingBody: recounts public.site_counts (D108): plain-list totals and one-country totals, from one read of public.jobs. Called every 10 minutes by pg_cron job refresh-site-counts.';

-- Same as 0009: only the owner (and pg_cron, which runs as the owner) may
-- call it. CREATE OR REPLACE keeps the existing grants; this repeats the
-- REVOKE so the result does not depend on that.
REVOKE ALL ON FUNCTION public.refresh_site_counts() FROM PUBLIC, anon, authenticated, service_role;

-- Fill the new rows now, inside the same transaction.
SELECT public.refresh_site_counts();

-- Unless both plain rows and at least one 'ab' country row were written in
-- this transaction, undo the whole file.
DO $check$
BEGIN
  IF (
    SELECT count(*)
    FROM public.site_counts
    WHERE key IN ('jobs_browsable:ab', 'jobs_browsable:et')
      AND updated_at = now()
  ) <> 2 THEN
    RAISE EXCEPTION 'The two plain-list totals were not written. Nothing was changed.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.site_counts
    WHERE starts_with(key, 'jobs_browsable:ab:country:')
      AND updated_at = now()
  ) THEN
    RAISE EXCEPTION 'No country counts were written for ab. Nothing was changed.';
  END IF;
END
$check$;

COMMIT;

-- Read-only summary (the SQL editor shows the last result).
select
  count(*) filter (where key in ('jobs_browsable:ab', 'jobs_browsable:et')) as plain_rows,
  count(*) filter (where starts_with(key, 'jobs_browsable:ab:country:')) as ab_country_rows,
  count(*) filter (where starts_with(key, 'jobs_browsable:et:country:')) as et_country_rows,
  count(*) filter (where strpos(key, ':search:') > 0) as search_rows,
  count(distinct updated_at) as distinct_update_times,
  max(updated_at) as newest_update,
  (
    select md5(p.prosrc)
    from pg_proc p
    where p.oid = to_regprocedure('public.refresh_site_counts()')::oid
  ) as function_md5
from public.site_counts;
