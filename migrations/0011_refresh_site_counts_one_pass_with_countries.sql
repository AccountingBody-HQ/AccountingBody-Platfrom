-- ============================================================================
-- 0011_refresh_site_counts_one_pass_with_countries.sql
-- APPLIED 11 Nov 2026 23:04 UTC via Supabase SQL editor (owner) — record of
-- what is live; do not re-run blindly.
--
-- Speed job part 3. Replaces the 0009 body of public.refresh_site_counts().
-- 0009 itself stays as the record of the site_counts table, the
-- newest-first jobs index and the pg_cron job; only the function body
-- written by 0009 is superseded by this file.
--
-- The function now writes, from one read of public.jobs every 10 minutes:
--   jobs_browsable:<ab|et>                              plain-list totals
--   jobs_browsable:<ab|et>:country:<location_country>   one-country totals
-- and removes country rows it did not write in that run, and any old
-- search rows. The Popular-search pre-count from the earlier draft was
-- dropped: Popular-search pills always count live.
--
-- pg_cron job 3 (refresh-site-counts, */10 * * * *) is unchanged: its
-- command is still 'select public.refresh_site_counts();'.
--
-- Text: from BEGIN; to the end this file is byte for byte
-- migrations/proposed/2026-11-11-speed-3/01_refresh_site_counts_v2.sql
-- (checked by script). That folder keeps the timing check (04c), the
-- after-check (01b) and the undo (99_rollback.sql). This file is the
-- source of truth for what is live.
--
-- Function body fingerprints (md5 and length of pg_proc.prosrc):
--   this body, LF line endings:   e2fa7cc06c83cef715c3e087180c19be  1860
--   this body, CRLF line endings: f5a0f31a2f07fac7c832745d2b301607  1914
-- The live body is the CRLF variant (pasted through the SQL editor).
-- Before this change the live body was the 0009 body with CRLF line
-- endings: ec9c609a0df3f9e685acc84a0144e4b8, length 507 (the 0009 file
-- itself, LF: 03dc514ee0589c531f40ef12f1ad66bf, length 489).
--
-- Record of 11 Nov 2026 (UTC):
--   before   pg_cron job 3 runs of the 0009 refresh took 11,121-13,860 ms.
--   23:01    04c_timing.sql (EXPLAIN ANALYZE of the SELECT below):
--            Execution Time 11,430 ms; one Seq Scan on jobs (12,380 rows
--            kept, 31,081 removed by the filter); shared hit=11788;
--            11 rows. GO.
--   23:03    database backup taken and self-checked.
--   23:04:56 this file run as one query. Summary row: plain_rows 2,
--            ab_country_rows 8, et_country_rows 1, search_rows 0,
--            distinct_update_times 1,
--            function_md5 f5a0f31a2f07fac7c832745d2b301607.
--   23:06    01b_after_check.sql: 17 of 17 checks equal_ok true.
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
