-- 0003_search_jobs_ranked.sql
-- Date: 2026-09-12
-- Why: lib/jobs.ts's getActiveDirectJobs pulled at most 500 rows into
-- application memory (pre-sorted by source_score, then re-ranked and
-- paginated in JavaScript) before this migration. Two consequences: (1)
-- the UI reports the true, uncapped total from a separate count query, but
-- any page beyond ~21 (at 24 rows/page) returns empty once a filtered set
-- exceeds 500 matching rows, because there is nothing past index 500 to
-- slice from; (2) rows are pre-sorted by source_score before the cap is
-- applied, so lower-scored sources (adzuna) are the first silently
-- dropped, regardless of relevance. This function moves sorting and
-- windowing into Postgres so a query returns exactly the requested page,
-- at any offset, against the true filtered set — no 500-row ceiling.
--
-- This also replaces the hardcoded relevance = 1.0 placeholder documented
-- in lib/jobs.ts ("Phase 1 ranking note ... requires a database function
-- (RPC) that was not part of the authorised Phase 1 migration") with a
-- real ts_rank_cd() score against jobs.search_vector, which is already
-- GIN-indexed (idx_jobs_search_vector) and already weighted A/B/C across
-- title/company+location/description by jobs_search_vector_trigger()
-- (migrations/0002). Normalization flag 32 (rank / (rank + 1)) bounds the
-- result to [0, 1), so it's comparable in scale to the other weighted
-- terms (recency, source_score, quality_score, ctr are already ~[0,1]) —
-- without this, ts_rank_cd's raw, unbounded, corpus-dependent scale would
-- make the 0.40 relevance weight arbitrarily over- or under-influential
-- relative to the other four terms. When no search term is supplied,
-- relevance_score is 0 for every row (not defaulted to 1.0) — a term that
-- is identical for every row cannot change their relative order, so this
-- is the honest way to make the search-term signal "contribute nothing"
-- rather than skew results toward some arbitrary constant.
--
-- Additive and reversible: creates one new function, no table/column
-- changes, no data migration. Safe to re-run (CREATE OR REPLACE). Can be
-- dropped with `DROP FUNCTION public.search_jobs_ranked(text, text, text,
-- text, text[], text[], boolean, integer, integer, integer, text[],
-- text[], text, integer, integer);` with no data loss — the application
-- code that calls it (lib/jobs.ts, getActiveDirectJobs) would need to
-- revert first.
--
-- Scope: public.jobs only, one of the seven AccountingBody-owned tables
-- per migrations/README.md.

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
    CASE WHEN p_sort_by NOT IN ('recent', 'salary_high', 'salary_low')
      THEN 0.40 * f.relevance_score
         + 0.25 * f.recency_score
         + 0.20 * f.source_score
         + 0.10 * f.quality_score
         + 0.05 * f.ctr
    END DESC NULLS LAST,
    f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset
$$;

-- The weights (0.40 / 0.25 / 0.20 / 0.10 / 0.05) and the recency half-life
-- (21 days) now live only here — lib/jobs.ts's former RANK_WEIGHTS,
-- RECENCY_HALF_LIFE_DAYS, recencyDecay() and compositeScore() were deleted
-- when getActiveDirectJobs was switched to call this function, so there is
-- exactly one implementation of the scoring formula, not two to keep in
-- sync.

-- This function is only ever called server-side via the service-role
-- connection (same access model as every other read in lib/jobs.ts — RLS
-- does not gate that connection, see the x-et-platform header-trust audit
-- for why that matters). Restrict execution accordingly rather than
-- leaving it callable by anon/authenticated through PostgREST's automatic
-- RPC exposure by default.
REVOKE EXECUTE ON FUNCTION public.search_jobs_ranked(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_jobs_ranked(
  text, text, text, text, text[], text[], boolean, integer, integer,
  integer, text[], text[], text, integer, integer
) TO service_role;
