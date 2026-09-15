-- 0006_active_job_countries.sql
-- Date: 2026-09-15
-- Why: JobListingsClient.tsx's country filter offers 12 hardcoded options
-- (11 real countries + 'all'). Measured externally against
-- /api/jobs/direct: those 11 options sum to 9,541 of 13,254 active
-- AccountingBody jobs — 3,713 jobs (28%) sit in a location_country value
-- with no matching dropdown option and are permanently unreachable
-- through this filter, regardless of how many jobs arrive from that
-- country. location_country itself is populated (0 of 8,911 sampled
-- Adzuna rows null) — only the list of choices is wrong, and it cannot
-- self-correct as new countries appear in the data.
--
-- This migration adds one new function, get_active_job_countries, that
-- returns the real distinct location_country values for a platform, with
-- a per-country job count, restricted to exactly the same "reachable"
-- definition getActiveDirectJobs's own count path already uses: status =
-- 'active', platform @> ARRAY[p_platform], and not yet expired. Ordered
-- by count descending so the application layer can offer the
-- highest-value options first without re-sorting. location_country IS
-- NULL rows are excluded by the WHERE clause, not filtered out
-- afterwards, so an empty/null value can never surface as a dropdown
-- option labelled "null" or similar.
--
-- Deliberately a read-only aggregate, not a change to search_jobs_ranked
-- or to how any filter's WHERE clause matches rows — this only changes
-- which options the country dropdown is populated with. No filter's
-- query semantics change.
--
-- 'Worldwide' is a real stored location_country value, not a UI-only
-- concept — confirmed separately by measurement (an exact-equality
-- location_country = 'Worldwide' filter returned 38 jobs; exact equality
-- cannot match a value that was never stored) — so it is included here
-- automatically, with no special-casing needed in this function. Any
-- label rewording for display (e.g. "Worldwide / Remote") is an
-- application-layer concern, not this function's.
--
-- No new index needed: migrations/0001_baseline.sql already has a partial
-- btree index on (location_country, location_city) WHERE status =
-- 'active', which covers this query's WHERE clause on the hot column.
-- This function is also cached for 6 hours at the call site
-- (lib/jobs.ts, getCachedActiveJobCountries) since the set of countries
-- with active jobs changes far more slowly than the job count itself, so
-- actual query volume against this function is a small fraction of one
-- call per platform per 6 hours, not per page view.
--
-- Additive and reversible: creates one new function, no table/column
-- changes, no data migration, no data touched. Can be dropped with
-- `DROP FUNCTION public.get_active_job_countries(text);` with no data
-- loss — the application code that calls it (lib/jobs.ts,
-- getActiveJobCountries) would need to revert first, at which point
-- JobListingsClient.tsx's built-in fallback list keeps the country filter
-- working exactly as it does today.
--
-- Scope: public.jobs only, one of the seven AccountingBody-owned tables
-- per migrations/README.md.

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

-- Same access model as search_jobs_ranked (migrations/0003): this is only
-- ever called server-side via the service-role connection (lib/jobs.ts's
-- getSupabase()), so PostgREST's automatic anon/authenticated RPC
-- exposure is revoked and execution restricted to service_role.
REVOKE EXECUTE ON FUNCTION public.get_active_job_countries(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_active_job_countries(text) TO service_role;
