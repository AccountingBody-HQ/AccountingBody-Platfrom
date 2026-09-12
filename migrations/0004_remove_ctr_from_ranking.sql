-- 0004_remove_ctr_from_ranking.sql
-- Date: 2026-09-12
-- Why: search_jobs_ranked's relevance formula (migrations/0003) weights
-- ctr at 0.05. ctr is computed in lib/jobs.ts's incrementJobClicks /
-- incrementJobImpressions as click_count / impression_count. Impressions
-- are never recorded anywhere in the codebase (incrementJobImpressions has
-- no callers — confirmed by grep, not assumed), so impression_count is
-- permanently 0 for every row. That makes both functions' shared formula
-- `ctr = impressionCount > 0 ? clickCount / impressionCount : 0.01`
-- evaluate its true branch never and its false branch always: ctr sits at
-- its column default of 0.5 (migrations/0001_baseline.sql:118) until a
-- job's first click, at which point incrementJobClicks recomputes it and
-- — because impressionCount is still 0 — sets it to exactly 0.01, not a
-- higher value. So the one event ctr is supposed to reward (a click)
-- currently makes a job's ctr term, and therefore 0.05 of its total
-- ranking score, drop by a factor of 50. The signal is not merely
-- noise; it is inverted.
--
-- This migration removes the ctr term from the formula entirely and
-- redistributes its 0.05 weight to recency (0.25 -> 0.30), not to
-- source_score or quality_score. Reasoning: source_score and
-- quality_score are both set once at row creation and never updated
-- again for the life of the row — they're static per-row constants, the
-- same category of signal ctr was supposed to supplement with something
-- that actually changes over time. source_score specifically is also,
-- as of this migration, nearly a constant across the entire live
-- dataset — every active row today is adzuna-sourced (source_score
-- 0.5 for all of them; see SOURCE_SCORE in lib/jobs.ts) — so weighting
-- it higher would not currently improve differentiation between listings
-- at all, it would just make an already-uniform term count for more.
-- recency is the only remaining term that (a) applies to every row
-- regardless of whether a search term was supplied — relevance_score is
-- 0 with no search term, so it isn't a candidate either — and (b) is
-- still genuinely dynamic, changing continuously as jobs age, which is
-- the actual property ctr was meant to contribute and currently doesn't.
--
-- What has to be true before ctr can return to this formula: impressions
-- must be recorded from somewhere (nothing does today), and that
-- recording must be atomic at the volume involved — the existing
-- incrementJobImpressions/incrementJobClicks read-then-write pattern is
-- already documented in lib/jobs.ts as "Best-effort... Phase 2 should
-- move these to a Postgres RPC... for atomicity at scale," and firing
-- impressions once per rendered listings card (up to 24 per page load)
-- against that non-atomic pattern would both undercount heavily under
-- concurrent traffic and add a large number of extra round trips per
-- page view. Re-deriving ctr honestly also requires clearing every row's
-- currently-corrupted value (0.01 for anything ever clicked, 0.5 default
-- otherwise reflects no real rate for either) rather than resuming
-- accumulation on top of it.
--
-- Backward-compatible by construction: same function name, same
-- parameter list (names, types, order, defaults), same RETURNS TABLE
-- shape as migrations/0003_search_jobs_ranked.sql. Only the ORDER BY
-- expression inside the function body changes. lib/jobs.ts's call site
-- (`supabase.rpc('search_jobs_ranked', {...})`) needs no change.
--
-- Additive and reversible: CREATE OR REPLACE on an existing function,
-- no table/column changes, no data migration. Because the function's
-- name and parameter *types* are unchanged, this REPLACE preserves the
-- REVOKE/GRANT already applied in migrations/0003 (Postgres privileges
-- attach to the function's identity, which CREATE OR REPLACE does not
-- alter) — no need to repeat those statements here. Reverting to
-- migrations/0003's formula means re-running that file's
-- CREATE OR REPLACE FUNCTION block.
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
