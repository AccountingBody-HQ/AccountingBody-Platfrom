-- ============================================================================
-- 0010_search_jobs_ranked_v2_and_countries.sql
-- APPLIED 11 Nov 2026 via Supabase SQL editor (owner) — record of what is
-- live; do not re-run blindly.
--
-- Speed job part 2. Two changes, applied as two separate queries in this
-- order (each one transaction):
--   PART 1  public.search_jobs_ranked v2 (plpgsql, format() with %L, then
--           RETURN QUERY EXECUTE). Text exactly as
--           migrations/proposed/2026-11-11-speed-2/01_search_jobs_ranked_fast.sql
--   PART 2  public.get_active_job_countries(text), then the API reload
--           (NOTIFY pgrst). Text exactly as
--           migrations/proposed/2026-11-11-speed-2/02_active_job_countries.sql
-- Each part below is that file without its old status banner; from BEGIN;
-- to the end the text is byte for byte the proposed file (checked by script).
-- The proposed folder keeps the checks (04a, 01b, 04b), the trial helpers
-- (00, 00b, 00c, 00d, used and dropped 11 Nov) and the undo (99_rollback.sql).
-- This file is the source of truth for what is live.
--
-- Sequence on 11 Nov 2026 (UTC):
--   ~20:10  first version (v1, plpgsql with plan_cache_mode) swapped in.
--   ~20:40  replaced by v2 (this file, part 1).
--   then    99_rollback.sql was run by accident and restored the 0004 logic;
--   ~20:44  part 1 (v2), the smoke test (01b) and part 2 were run again.
--   Smoke test: ab no words 24, ab cfo 24, et no words 24,
--   live_language 'plpgsql, v2 (EXECUTE)'.
--
-- Notes
--   - Before this change the live search_jobs_ranked was the 0004 body with
--     CRLF line endings: md5 9309125892ecddec6014de33e7529552, length 3463.
--     The same text with LF endings (as in migrations/0004) has md5
--     aad246bd049e61611aed2c5391fdabb3, length 3389. Same logic.
--   - v2 body in this file (between AS $$ and $$): length 4815, md5
--     562f61be14d4f61b16bb023067641559 (LF). If the editor stored CRLF endings, as it
--     did for 0004: length 4946, md5 a5bc6944b543e9b322ad41cdd6e1b91d.
--   - migrations/0006 had never been applied before this file:
--     get_active_job_countries(text) did not exist until part 2 created it.
--     Part 2 defines it as 0006 does, with an 'AccountingBody:' comment.
--   - 0007 is deliberately unused; do not create it.
--   - Before any future replace of these functions, compare the live
--     fingerprint (md5 of pg_proc.prosrc) with the repository first.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — search_jobs_ranked v2 (from 01_search_jobs_ranked_fast.sql)
-- ════════════════════════════════════════════════════════════════════════════
--
-- What this does
--   Replaces public.search_jobs_ranked with a faster version that returns
--   the same rows in the same order. Same name, same inputs (names, types,
--   order, defaults), same output columns, same filters, same ranking
--   formula (0.40 relevance + 0.30 recency + 0.20 source_score
--   + 0.10 quality_score) and the same seven sort keys, then created_at, as
--   migrations/0004. The live code (R1) and the new code call it as before.
--
-- Why v2 (v1 was planned without the real words)
--   v1 used plpgsql variables with plan_cache_mode = force_custom_plan.
--   Live, 11 Nov ~20:25, that still left the planner guessing for some
--   words: 'treasury' took 16,867 ms inside the function against
--   2,996 ms for the same query written out with the word. v2 writes the
--   query out with the actual values on every call (format() + RETURN
--   QUERY EXECUTE), so the database plans exactly the written-out query.
--
-- How the query is built
--   - Only filters whose input is given are written into the query; an
--     unused filter is left out completely (no "input IS NULL OR ..."). The
--     "is it given?" test for each filter is exactly 0004's.
--   - With search words, the word test and the relevance score both use
--     websearch_to_tsquery('english', '<words>') with the words as a quoted
--     literal. Without words, there is no word test and relevance is
--     0::real (0004's "ELSE 0" has type real there too).
--   - Every value is written as a quoted literal (%L), none as a parameter:
--     EXECUTE plans each call fresh, so there is no saved plan to protect,
--     and literals let the planner see platform, country, sources, sort,
--     page size and offset when choosing the plan (for example the word
--     index, or which sort keys are constant and drop out).
--   - Two steps are kept: matching jobs are scored and sorted with only the
--     sort columns, and full rows (with the long description) are read for
--     the requested page only, then put back in the same order. This keeps
--     the sort small, which matters most with no words (all ~15,500 active
--     jobs are sorted then).
--
-- Injection safety (every value the caller supplies, and how it is quoted)
--   p_platform           %L  inside ARRAY[...]
--   p_search             %L  inside websearch_to_tsquery('english', ...), twice
--   p_location           %L  of '%' || p_location || '%' (as 0004's pattern)
--   p_location_country   %L
--   p_employment_types   %L  of the text[] value, then ::text[]
--   p_seniority_levels   %L  of the text[] value, then ::text[]
--   p_remote_only        no value written (only decides whether the
--                        constant "j.location_remote = true" is added)
--   p_salary_min         %L, then ::integer
--   p_salary_max         %L, then ::integer
--   p_posted_within_days %L, used as (... || ' days')::interval (as 0004)
--   p_qualifications     %L  of the text[] value, then ::text[]
--   p_sources            %L  of the text[] value, then ::text[]
--   p_sort_by            %L  (compared with fixed words inside CASE)
--   p_limit, p_offset    %L  (NULL keeps 0004's meaning: no limit / 0)
--   Nothing the caller supplies is ever joined into the query text without
--   %L. %I and %s are not used for caller values (%s only inserts query
--   pieces this function built itself).
--
-- Ties: rows with exactly equal sort keys have no defined order in 0004
-- either; no tie-breaker is added (00b checks differences are ties only).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.search_jobs_ranked(
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
          AND (j.expires_at IS NULL OR j.expires_at > now())%4$s
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

-- Access exactly as migrations/0003: only the server key may call it.
-- On the live database this changes nothing (0003 already set it); it only
-- matters if the function had to be created fresh.
REVOKE ALL ON FUNCTION public.search_jobs_ranked(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_jobs_ranked(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) TO service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — get_active_job_countries (from 02_active_job_countries.sql)
-- ════════════════════════════════════════════════════════════════════════════
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
