-- ============================================================================
-- NOT APPLIED. Proposed for review. Do not run until the owner and the
-- reviewer have read 04a's result and approved this exact file.
--
-- Speed job part 3: the refresh that already writes the plain-list totals
-- every 10 minutes (public.refresh_site_counts(), migration 0009, pg_cron
-- job refresh-site-counts) also writes, in the same run:
--   jobs_browsable:<platform>:country:<location_country exactly as stored>
--     one row per country with at least one browsable job, per platform
--   jobs_browsable:<platform>:search:<words>
--     one row per Popular search, per platform (twelve rows, 0 allowed)
-- and removes the country and search rows it did not write in this run
-- (for example a country that dropped to no jobs). No other row is touched.
-- The two existing rows (jobs_browsable:ab, jobs_browsable:et) are counted
-- exactly as in 0009.
--
-- "Browsable" is the same as everywhere else:
--   status = 'active' AND platform @> ARRAY[<platform>]
--   AND (expires_at IS NULL OR expires_at > now())
-- The country rows use the same equality as the site's country filter
-- (location_country = <value>, case-sensitive, NULL never matches). The
-- search rows use websearch_to_tsquery('english', <words>), the words being
-- exactly what the site passes to its word count for each Popular button
-- (trimmed and lowercased; '&' kept as it is).
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
--   this body, LF line endings:   7e9cb5dcd980a987293f26f04898237e  3311
--   this body, CRLF line endings: c46dfe3d6fcede914977da6d094452f2  3396
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
    '7e9cb5dcd980a987293f26f04898237e',  -- this file, LF
    'c46dfe3d6fcede914977da6d094452f2'   -- this file, CRLF
  ) THEN
    RAISE EXCEPTION 'public.refresh_site_counts() body is not the 0009 body (md5 %). Nothing was changed.', v_md5;
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
  -- 1. Plain-list totals, exactly as in 0009.
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

  -- Parts 2 to 4 run in their own sub-block: if one of them fails, the
  -- plain-list totals above are still saved and a warning is logged. The
  -- country and search rows then keep their old time and the site stops
  -- using them once they are 6 hours old.
  BEGIN
    -- 2. One row per country with browsable jobs, per platform, in one
    --    pass. Empty names are skipped (the site never asks for one), and
    --    so are names over 200 characters, so a key always fits the
    --    primary-key index. The site counts those live, as today.
    INSERT INTO public.site_counts AS sc (key, value, updated_at)
    SELECT
      'jobs_browsable:' || p.platform || ':country:' || j.location_country,
      count(*),
      now()
    FROM public.jobs j
    JOIN (VALUES ('ab'::text), ('et'::text)) AS p(platform)
      ON j.platform @> ARRAY[p.platform]
    WHERE j.status = 'active'
      AND (j.expires_at IS NULL OR j.expires_at > now())
      AND j.location_country IS NOT NULL
      AND j.location_country <> ''
      AND length(j.location_country) <= 200
    GROUP BY p.platform, j.location_country
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at;

    -- 3. The six Popular searches, per platform. A count of 0 is written.
    INSERT INTO public.site_counts AS sc (key, value, updated_at)
    SELECT
      'jobs_browsable:' || p.platform || ':search:' || w.words,
      (
        SELECT count(*)
        FROM public.jobs j
        WHERE j.status = 'active'
          AND j.platform @> ARRAY[p.platform]
          AND (j.expires_at IS NULL OR j.expires_at > now())
          AND j.search_vector @@ websearch_to_tsquery('english', w.words)
      ),
      now()
    FROM (VALUES ('ab'::text), ('et'::text)) AS p(platform)
    CROSS JOIN (VALUES
      ('management accountant'::text),
      ('tax manager'::text),
      ('financial controller'::text),
      ('audit senior'::text),
      ('fp&a analyst'::text),
      ('cfo'::text)
    ) AS w(words)
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at;

    -- 4. Remove country and search rows not written in this run. Every
    --    row written above has updated_at = now(), which is fixed for the
    --    whole transaction. Only these four prefixes are looked at.
    DELETE FROM public.site_counts
    WHERE (starts_with(key, 'jobs_browsable:ab:country:')
        OR starts_with(key, 'jobs_browsable:et:country:')
        OR starts_with(key, 'jobs_browsable:ab:search:')
        OR starts_with(key, 'jobs_browsable:et:search:'))
      AND updated_at <> now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_site_counts: country and search counts not refreshed (%)', SQLSTATE;
  END;
END;
$$;

COMMENT ON FUNCTION public.refresh_site_counts() IS
  'AccountingBody: recounts public.site_counts (D108): plain-list totals, one-country totals and Popular-search totals. Called every 10 minutes by pg_cron job refresh-site-counts.';

-- Same as 0009: only the owner (and pg_cron, which runs as the owner) may
-- call it. CREATE OR REPLACE keeps the existing grants; this repeats the
-- REVOKE so the result does not depend on that.
REVOKE ALL ON FUNCTION public.refresh_site_counts() FROM PUBLIC, anon, authenticated, service_role;

-- Fill the new rows now, inside the same transaction.
SELECT public.refresh_site_counts();

-- The sub-block in the function only warns on a failure. Here, at install
-- time, a missing result stops everything instead: unless the twelve
-- search rows were written in this transaction and at least one country
-- row exists for 'ab', the whole file is undone.
DO $check$
BEGIN
  IF (
    SELECT count(*)
    FROM public.site_counts
    WHERE (starts_with(key, 'jobs_browsable:ab:search:') OR starts_with(key, 'jobs_browsable:et:search:'))
      AND updated_at = now()
  ) <> 12 THEN
    RAISE EXCEPTION 'The Popular-search counts were not written. Nothing was changed.';
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
  count(*) filter (where starts_with(key, 'jobs_browsable:ab:search:')) as ab_search_rows,
  count(*) filter (where starts_with(key, 'jobs_browsable:et:search:')) as et_search_rows,
  min(updated_at) as oldest_update,
  max(updated_at) as newest_update,
  (
    select md5(p.prosrc)
    from pg_proc p
    where p.oid = to_regprocedure('public.refresh_site_counts()')::oid
  ) as function_md5
from public.site_counts;
