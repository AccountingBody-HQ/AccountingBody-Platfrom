-- ============================================================================
-- APPLIED 11 Nov 2026 — kept for checks/rollback; source of truth is 0010.
-- (v2. Proposed 11 November 2026, speed job part 2.)
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d.
-- Only after 00b shows no real difference and 00c shows good times.
-- Then run 01b AT ONCE; if 01b errors, run 99_rollback.sql at once.
-- Undo: 99_rollback.sql. One transaction: all of it or nothing.
-- ============================================================================
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
