-- ============================================================================
-- NOT APPLIED. Undo for speed job part 2 (01 and 02). Safe to run twice.
-- Run as one query. One transaction: all of it or nothing.
-- ============================================================================
--
-- PART 1 puts back public.search_jobs_ranked exactly as migrations/0004
-- defines it: the statement below is copied byte for byte from 0004
-- (checked by script), followed by the grants of 0003.
-- PART 2 drops public.get_active_job_countries(text) ONLY if 02 created it
-- (its comment starts 'AccountingBody:'); otherwise it is left alone.
-- Then the API is told to reload.
-- ============================================================================

BEGIN;

-- ── PART 1: search_jobs_ranked back to migrations/0004 ─────────────────────

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
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH filtered AS (
    SELECT
      j.*,
      CASE
        WHEN p_search IS NOT NULL AND btrim(p_search) <> ''
          THEN ts_rank_cd(j.search_vector, websearch_to_tsquery('english', p_search), 32)
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
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR j.search_vector @@ websearch_to_tsquery('english', p_search)
      )
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
  )
  SELECT
    f.id, f.slug, f.title, f.company_name, f.company_domain, f.description, f.excerpt,
    f.location_text, f.location_city, f.location_country, f.location_remote,
    f.salary_text, f.salary_min, f.salary_max, f.salary_currency,
    f.employment_type, f.seniority_level, f.category,
    f.qualifications_required, f.skills_required, f.skills_nice_to_have,
    f.apply_method, f.application_url, f.application_email,
    f.source, f.source_url, f.platform, f.is_featured,
    f.published_at, f.created_at, f.expires_at
  FROM filtered f
  ORDER BY
    CASE WHEN p_sort_by = 'recent'      THEN f.created_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'salary_high' THEN f.salary_max END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'salary_high' THEN f.salary_min END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'salary_low'  THEN f.salary_min END ASC  NULLS LAST,
    CASE WHEN p_sort_by = 'salary_low'  THEN f.salary_max END ASC  NULLS LAST,
    -- ctr deliberately excluded — see header comment. Weight redistributed
    -- to recency: 0.25 -> 0.30. source_score and quality_score stay at
    -- their migrations/0003 values (0.20, 0.10); relevance stays 0.40.
    -- Sum is still 1.00 (0.40 + 0.30 + 0.20 + 0.10).
    CASE WHEN p_sort_by NOT IN ('recent', 'salary_high', 'salary_low')
      THEN 0.40 * f.relevance_score
         + 0.30 * f.recency_score
         + 0.20 * f.source_score
         + 0.10 * f.quality_score
    END DESC NULLS LAST,
    f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset
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


-- ── PART 2: drop get_active_job_countries only if 02 created it ────────────

DO $$
BEGIN
  IF to_regprocedure('public.get_active_job_countries(text)') IS NOT NULL
     AND coalesce(obj_description(to_regprocedure('public.get_active_job_countries(text)'), 'pg_proc'), '') LIKE 'AccountingBody:%' THEN
    DROP FUNCTION public.get_active_job_countries(text);
  END IF;
END
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
