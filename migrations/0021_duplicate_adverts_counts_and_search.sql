-- ============================================================================
-- 0021_duplicate_adverts_counts_and_search.sql
-- Date: 21 Nov 2026 (JD-1, board #7 step 2; design D283)
--
-- NOT APPLIED. This file is the record of a later database change: it is
-- applied later by an owner-approved database job after a fresh backup.
-- Until then nothing here exists on the database.
--
-- Why: the nightly similar-jobs run can mark extra copies of one advert
-- (same title, company, provider and sites) in jobs.ai_duplicate_of (D283).
-- Visitor lists hide marked copies only when JOB_DUPLICATES_HIDDEN is
-- exactly "true". Two readers live inside the database and cannot read that
-- switch, so this file gives them a primaries-only form beside today's:
--   PART A  public.refresh_site_counts(): the same single read of jobs also
--           writes 'jobs_primary:<ab|et>' and
--           'jobs_primary:<ab|et>:country:<location_country>', the live
--           rows that are not marked copies. Today's 'jobs_browsable:' rows
--           are written exactly as before.
--   PART B  public.search_jobs_ranked_primary(...): a new function, the
--           0010 v2 search_jobs_ranked with the same inputs and output and
--           one added condition, "AND j.ai_duplicate_of IS NULL". A new name
--           rather than a new parameter: CREATE OR REPLACE cannot add a
--           parameter, and a second function with the same name and
--           defaulted inputs would make API calls ambiguous (PGRST203).
-- The app reads these only when JOB_DUPLICATES_HIDDEN is "true", so that
-- switch must never be turned on before this file is applied.
--
-- How to apply (later job): PART A as one query, PART B as one query, each
-- one transaction, outside the import windows (05-10 and 16-22 UTC) and not
-- at :00/:10/... when pg_cron job 3 runs. No index is added: the default
-- list's index (0009 idx_jobs_browsable_newest) keeps serving its order; the
-- extra condition is checked on the same rows it already reads.
--
-- Function body fingerprints (md5 and length of pg_proc.prosrc):
--   PART A refresh_site_counts, LF:   5bd0718b5cf8337cae0b3346a68bb95d  2648
--   PART A refresh_site_counts, CRLF: 4bf4afc9de3d2603abddd57f7fe2debc  2722
--   PART B search_jobs_ranked_primary, LF:   2082c3161c4bfb3a1d5c7f67be4566ba  4855
--   PART B search_jobs_ranked_primary, CRLF: 29cc00fd0901be8e52aa188b36a20450  4987
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- PART A — refresh_site_counts with live primaries (one query)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Stop, changing nothing, unless the table and the function are ours and
-- the live body is the 0011 body or this file's body.
DO $guard$
DECLARE
  v_md5 text;
BEGIN
  IF to_regclass('public.site_counts') IS NULL
     OR coalesce(obj_description(to_regclass('public.site_counts'), 'pg_class'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.site_counts is missing or not the AccountingBody table. Nothing was changed.';
  END IF;
  IF to_regprocedure('public.refresh_site_counts()') IS NULL
     OR coalesce(obj_description(to_regprocedure('public.refresh_site_counts()'), 'pg_proc'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.refresh_site_counts() is missing or not the AccountingBody function. Nothing was changed.';
  END IF;

  SELECT md5(p.prosrc) INTO v_md5
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.refresh_site_counts()')::oid;

  IF v_md5 NOT IN (
    'e2fa7cc06c83cef715c3e087180c19be',  -- 0011, LF
    'f5a0f31a2f07fac7c832745d2b301607',  -- 0011, CRLF (live since 11 Nov 2026)
    '5bd0718b5cf8337cae0b3346a68bb95d',  -- this file, LF
    '4bf4afc9de3d2603abddd57f7fe2debc'   -- this file, CRLF
  ) THEN
    RAISE EXCEPTION 'public.refresh_site_counts() body is neither the 0011 body nor this file''s body (md5 %). Nothing was changed.', v_md5;
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
  -- The same read counts the live primaries (rows that are not a marked
  -- extra copy of an advert, D283) into the 'jobs_primary:' keys.
  INSERT INTO public.site_counts AS sc (key, value, updated_at)
  WITH b AS MATERIALIZED (
    SELECT j.platform, j.location_country, (j.ai_duplicate_of IS NULL) AS is_primary
    FROM public.jobs j
    WHERE j.status = 'active'
      AND (j.expires_at IS NULL OR j.expires_at > now())
  ),
  p AS (
    SELECT v.platform
    FROM (VALUES ('ab'::text), ('et'::text)) AS v(platform)
  ),
  g AS (
    SELECT p.platform, b.location_country, count(*) AS n,
      count(*) FILTER (WHERE b.is_primary) AS n_primary
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
    UNION ALL
    SELECT
      'jobs_primary:' || p.platform,
      coalesce(sum(g.n_primary), 0)::bigint
    FROM p
    LEFT JOIN g ON g.platform = p.platform
    GROUP BY p.platform
    UNION ALL
    SELECT
      'jobs_primary:' || g.platform || ':country:' || g.location_country,
      g.n_primary
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
          OR starts_with(key, 'jobs_browsable:et:country:')
          OR starts_with(key, 'jobs_primary:ab:country:')
          OR starts_with(key, 'jobs_primary:et:country:'))
         AND updated_at <> now())
     OR starts_with(key, 'jobs_browsable:ab:search:')
     OR starts_with(key, 'jobs_browsable:et:search:');
END;
$$;

COMMENT ON FUNCTION public.refresh_site_counts() IS
  'AccountingBody: recounts public.site_counts (D108): plain-list and one-country totals, and the same for live primaries (D283), from one read of public.jobs. Called every 10 minutes by pg_cron job refresh-site-counts.';

-- As 0009 and 0011: only the owner (and pg_cron, which runs as the owner)
-- may call it. The same line as 0011; no right in use changes.
REVOKE ALL ON FUNCTION public.refresh_site_counts() FROM PUBLIC, anon, authenticated, service_role;

-- Fill the new rows now, inside the same transaction.
SELECT public.refresh_site_counts();

-- Unless all four plain rows were written in this transaction, undo it all.
DO $check$
BEGIN
  IF (
    SELECT count(*)
    FROM public.site_counts
    WHERE key IN ('jobs_browsable:ab', 'jobs_browsable:et', 'jobs_primary:ab', 'jobs_primary:et')
      AND updated_at = now()
  ) <> 4 THEN
    RAISE EXCEPTION 'The four plain-list totals were not written. Nothing was changed.';
  END IF;
END
$check$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- PART B — search_jobs_ranked_primary (one query)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Stop, changing nothing, if a function with this signature exists and was
-- not created by this file.
DO $guard$
BEGIN
  IF to_regprocedure('public.search_jobs_ranked_primary(text, text, text, text, text[], text[], boolean, integer, integer, integer, text[], text[], text, integer, integer)') IS NOT NULL
     AND coalesce(obj_description(to_regprocedure('public.search_jobs_ranked_primary(text, text, text, text, text[], text[], boolean, integer, integer, integer, text[], text[], text, integer, integer)'), 'pg_proc'), '') NOT LIKE 'AccountingBody:%' THEN
    RAISE EXCEPTION 'public.search_jobs_ranked_primary already exists and was not created by this file. Nothing was changed.';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.search_jobs_ranked_primary(
  p_platform           text,
  p_search             text    DEFAULT NULL,
  p_location           text    DEFAULT NULL,
  p_location_country   text    DEFAULT NULL,
  p_employment_types   text[]  DEFAULT NULL,
  p_seniority_levels   text[]  DEFAULT NULL,
  p_remote_only        boolean DEFAULT NULL,
  p_salary_min         integer DEFAULT NULL,
  p_salary_max         integer DEFAULT NULL,
  p_posted_within_days integer DEFAULT NULL,
  p_qualifications     text[]  DEFAULT NULL,
  p_sources            text[]  DEFAULT NULL,
  p_sort_by            text    DEFAULT 'relevance',
  p_limit              integer DEFAULT 24,
  p_offset             integer DEFAULT 0
)
RETURNS TABLE (
  id                       uuid,
  slug                     text,
  title                    text,
  company_name             text,
  company_domain           text,
  description              text,
  excerpt                  text,
  location_text            text,
  location_city            text,
  location_country         text,
  location_remote          boolean,
  salary_text              text,
  salary_min               integer,
  salary_max               integer,
  salary_currency          text,
  employment_type          text,
  seniority_level          text,
  category                 text,
  qualifications_required  text[],
  skills_required          text[],
  skills_nice_to_have      text[],
  apply_method             text,
  application_url          text,
  application_email        text,
  source                   text,
  source_url               text,
  platform                 text[],
  is_featured              boolean,
  published_at             timestamptz,
  created_at               timestamptz,
  expires_at               timestamptz
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rank  text;
  v_where text := '';
  v_sql   text;
BEGIN
  -- Search words: the same "given?" test as 0004.
  IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
    v_where := v_where || format(
      ' AND j.search_vector @@ websearch_to_tsquery(''english'', %L)', p_search);
    v_rank := format(
      'ts_rank_cd(j.search_vector, websearch_to_tsquery(''english'', %L), 32)', p_search);
  ELSE
    v_rank := '0::real';
  END IF;

  -- Every other filter, each written only when 0004 would apply it.
  IF p_sources IS NOT NULL THEN
    v_where := v_where || format(' AND j.source = ANY(%L::text[])', p_sources);
  END IF;
  IF p_location IS NOT NULL AND btrim(p_location) <> '' THEN
    v_where := v_where || format(' AND j.location_text ILIKE %L', '%' || p_location || '%');
  END IF;
  IF p_location_country IS NOT NULL AND p_location_country <> 'all' THEN
    v_where := v_where || format(' AND j.location_country = %L', p_location_country);
  END IF;
  IF p_employment_types IS NOT NULL THEN
    v_where := v_where || format(' AND j.employment_type = ANY(%L::text[])', p_employment_types);
  END IF;
  IF p_seniority_levels IS NOT NULL THEN
    v_where := v_where || format(' AND j.seniority_level = ANY(%L::text[])', p_seniority_levels);
  END IF;
  IF p_remote_only IS TRUE THEN
    v_where := v_where || ' AND j.location_remote = true';
  END IF;
  IF p_salary_min IS NOT NULL THEN
    v_where := v_where || format(' AND j.salary_min >= %L::integer', p_salary_min);
  END IF;
  IF p_salary_max IS NOT NULL THEN
    v_where := v_where || format(' AND j.salary_max <= %L::integer', p_salary_max);
  END IF;
  IF p_posted_within_days IS NOT NULL THEN
    v_where := v_where || format(
      ' AND j.created_at >= now() - (%L || '' days'')::interval', p_posted_within_days);
  END IF;
  IF p_qualifications IS NOT NULL AND array_length(p_qualifications, 1) IS NOT NULL THEN
    v_where := v_where || format(
      ' AND EXISTS (SELECT 1 FROM unnest(%L::text[]) AS q'
      || ' WHERE j.title ILIKE ''%%'' || q || ''%%'' OR j.description ILIKE ''%%'' || q || ''%%'')',
      p_qualifications);
  END IF;

  v_sql := format($q$
    WITH page AS (
      SELECT
        f.id,
        CASE WHEN %1$L = 'recent'      THEN f.created_at END AS k1,
        CASE WHEN %1$L = 'salary_high' THEN f.salary_max END AS k2,
        CASE WHEN %1$L = 'salary_high' THEN f.salary_min END AS k3,
        CASE WHEN %1$L = 'salary_low'  THEN f.salary_min END AS k4,
        CASE WHEN %1$L = 'salary_low'  THEN f.salary_max END AS k5,
        CASE WHEN %1$L NOT IN ('recent', 'salary_high', 'salary_low')
          THEN 0.40 * f.relevance_score
             + 0.30 * f.recency_score
             + 0.20 * f.source_score
             + 0.10 * f.quality_score
        END AS k6,
        f.created_at AS k7
      FROM (
        SELECT
          j.id,
          j.created_at,
          j.salary_min,
          j.salary_max,
          j.source_score,
          j.quality_score,
          %2$s AS relevance_score,
          CASE
            WHEN COALESCE(j.published_at, j.created_at) IS NULL THEN 1.0
            ELSE exp(
              (-ln(2) * GREATEST(0,
                EXTRACT(EPOCH FROM (now() - COALESCE(j.published_at, j.created_at))) / 86400.0
              )) / 21.0
            )
          END AS recency_score
        FROM public.jobs j
        WHERE j.status = 'active'
          AND j.platform @> ARRAY[%3$L]
          AND (j.expires_at IS NULL OR j.expires_at > now())
          AND j.ai_duplicate_of IS NULL%4$s
      ) f
      ORDER BY
        k1 DESC NULLS LAST,
        k2 DESC NULLS LAST,
        k3 DESC NULLS LAST,
        k4 ASC  NULLS LAST,
        k5 ASC  NULLS LAST,
        k6 DESC NULLS LAST,
        k7 DESC
      LIMIT %5$L
      OFFSET %6$L
    )
    SELECT
      j.id, j.slug, j.title, j.company_name, j.company_domain, j.description, j.excerpt,
      j.location_text, j.location_city, j.location_country, j.location_remote,
      j.salary_text, j.salary_min, j.salary_max, j.salary_currency,
      j.employment_type, j.seniority_level, j.category,
      j.qualifications_required, j.skills_required, j.skills_nice_to_have,
      j.apply_method, j.application_url, j.application_email,
      j.source, j.source_url, j.platform, j.is_featured,
      j.published_at, j.created_at, j.expires_at
    FROM page p
    JOIN public.jobs j ON j.id = p.id
    ORDER BY
      p.k1 DESC NULLS LAST,
      p.k2 DESC NULLS LAST,
      p.k3 DESC NULLS LAST,
      p.k4 ASC  NULLS LAST,
      p.k5 ASC  NULLS LAST,
      p.k6 DESC NULLS LAST,
      p.k7 DESC
  $q$,
    p_sort_by,   -- %1$L
    v_rank,      -- %2$s (built above, never caller text without %L)
    p_platform,  -- %3$L
    v_where,     -- %4$s (built above, never caller text without %L)
    p_limit,     -- %5$L
    p_offset     -- %6$L
  );

  RETURN QUERY EXECUTE v_sql;
END;
$$;

COMMENT ON FUNCTION public.search_jobs_ranked_primary(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) IS
  'AccountingBody: search_jobs_ranked (0010 v2) without marked extra copies of an advert (jobs.ai_duplicate_of IS NULL, D283). Called only when JOB_DUPLICATES_HIDDEN is "true".';

-- Access exactly as search_jobs_ranked (0003/0010): only the server key may
-- call it. Supabase grants EXECUTE on new functions to the API roles by
-- default, so those are taken away from this new function explicitly.
REVOKE ALL ON FUNCTION public.search_jobs_ranked_primary(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_jobs_ranked_primary(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) TO service_role;

COMMIT;

-- Tell the API to reload its list of functions now.
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Undo (owner decision only, after a fresh backup). First turn
-- JOB_DUPLICATES_HIDDEN off and deploy, so no page reads these any more.
--   PART B:
--     DROP FUNCTION IF EXISTS public.search_jobs_ranked_primary(
--       text, text, text, text, text[], text[], boolean, integer, integer,
--       integer, text[], text[], text, integer, integer);
--     NOTIFY pgrst, 'reload schema';
--   PART A: run the 0011 function statement again (migrations/0011, from
--   CREATE OR REPLACE FUNCTION public.refresh_site_counts() to its REVOKE
--   line, as one transaction), then:
--     DELETE FROM public.site_counts WHERE starts_with(key, 'jobs_primary:');
-- ============================================================================
