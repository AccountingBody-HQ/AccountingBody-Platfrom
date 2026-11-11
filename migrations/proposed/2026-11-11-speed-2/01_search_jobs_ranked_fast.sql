-- ============================================================================
-- NOT APPLIED. Proposed 11 November 2026 (speed job part 2).
-- Run only after the owner has approved it and taken a fresh backup.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d.
-- Only after 00b shows no real difference and 00c shows good times.
-- Then run 01b AT ONCE; if 01b errors, run 99_rollback.sql at once.
-- Undo: 99_rollback.sql.
-- One transaction: the whole file succeeds or nothing changes.
-- ============================================================================
--
-- What this does
--   Replaces public.search_jobs_ranked with a faster version that returns
--   the same rows in the same order. Same name, same inputs (names, types,
--   order, defaults), same output columns, same filters, same ranking
--   formula (0.40 relevance + 0.30 recency + 0.20 source_score
--   + 0.10 quality_score, then created_at) as migrations/0004. The live
--   code (R1) and the new code call it exactly as before.
--
-- Why the 0004 version is slow with search words
--   0004 is LANGUAGE sql with a SET option, so Postgres cannot merge it into
--   the calling query. Its statement is planned once with the inputs still
--   unknown. Every filter is written "(input IS NULL OR condition)", so that
--   plan cannot know a search is happening and cannot use the word index
--   (idx_jobs_search_vector, GIN). It reads every active job, checks the
--   words on each, scores every match, carries whole rows (including the
--   long description) through the sort, and only then keeps 24. On the
--   NANO database that exceeds the 8-second limit.
--
-- What changes (and only this)
--   1. LANGUAGE plpgsql with SET plan_cache_mode = force_custom_plan: the
--      query is planned on every call with the actual inputs, so unused
--      filters drop out and, with search words, the word index finds the
--      matching jobs first.
--   2. The search words are turned into a search query once
--      (websearch_to_tsquery('english', p_search), as in 0004), not per row.
--   3. Matching jobs are scored and sorted using only the columns the order
--      needs; full rows are read only for the requested page, then put back
--      in the same order.
--   Not changed: who may call it. The REVOKE/GRANT at the end repeat 0003
--   exactly (EXECUTE for service_role only).
--
-- Ties: rows with exactly equal sort keys have no defined order in 0004
-- either; this version keeps that (no new tie-breaker), so results are the
-- same as 0004 up to the order of exact ties.
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
SET plan_cache_mode = force_custom_plan
AS $$
#variable_conflict use_column
DECLARE
  -- Same test as 0004 ("p_search IS NOT NULL AND btrim(p_search) <> ''").
  v_has_search boolean := p_search IS NOT NULL AND btrim(p_search) <> '';
  v_query      tsquery := CASE
                            WHEN p_search IS NOT NULL AND btrim(p_search) <> ''
                              THEN websearch_to_tsquery('english', p_search)
                          END;
BEGIN
  RETURN QUERY
  WITH page AS (
    SELECT
      f.id,
      -- The sort keys of 0004, each as a column, in the same order.
      CASE WHEN p_sort_by = 'recent'      THEN f.created_at END AS k1,
      CASE WHEN p_sort_by = 'salary_high' THEN f.salary_max END AS k2,
      CASE WHEN p_sort_by = 'salary_high' THEN f.salary_min END AS k3,
      CASE WHEN p_sort_by = 'salary_low'  THEN f.salary_min END AS k4,
      CASE WHEN p_sort_by = 'salary_low'  THEN f.salary_max END AS k5,
      CASE WHEN p_sort_by NOT IN ('recent', 'salary_high', 'salary_low')
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
        CASE
          WHEN v_has_search
            THEN ts_rank_cd(j.search_vector, v_query, 32)
          ELSE 0
        END AS relevance_score,
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
        AND j.platform @> ARRAY[p_platform]
        AND (j.expires_at IS NULL OR j.expires_at > now())
        AND (p_sources IS NULL OR j.source = ANY(p_sources))
        AND (NOT v_has_search OR j.search_vector @@ v_query)
        AND (p_location IS NULL OR btrim(p_location) = '' OR j.location_text ILIKE '%' || p_location || '%')
        AND (p_location_country IS NULL OR p_location_country = 'all' OR j.location_country = p_location_country)
        AND (p_employment_types IS NULL OR j.employment_type = ANY(p_employment_types))
        AND (p_seniority_levels IS NULL OR j.seniority_level = ANY(p_seniority_levels))
        AND (p_remote_only IS NOT TRUE OR j.location_remote = true)
        AND (p_salary_min IS NULL OR j.salary_min >= p_salary_min)
        AND (p_salary_max IS NULL OR j.salary_max <= p_salary_max)
        AND (
          p_posted_within_days IS NULL
          OR j.created_at >= now() - (p_posted_within_days || ' days')::interval
        )
        AND (
          p_qualifications IS NULL OR array_length(p_qualifications, 1) IS NULL
          OR EXISTS (
            SELECT 1 FROM unnest(p_qualifications) AS q
            WHERE j.title ILIKE '%' || q || '%' OR j.description ILIKE '%' || q || '%'
          )
        )
    ) f
    ORDER BY
      k1 DESC NULLS LAST,
      k2 DESC NULLS LAST,
      k3 DESC NULLS LAST,
      k4 ASC  NULLS LAST,
      k5 ASC  NULLS LAST,
      k6 DESC NULLS LAST,
      k7 DESC
    LIMIT p_limit
    OFFSET p_offset
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
    p.k7 DESC;
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
