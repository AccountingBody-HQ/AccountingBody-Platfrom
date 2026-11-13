-- ============================================================================
-- RUN 11 Nov 2026 23:01 UTC: 11,430 ms, one scan — GO (read-only).
-- NOT A MIGRATION. Changes nothing.
-- Was run ON ITS OWN, as one query, BEFORE 01_refresh_site_counts_v2.sql.
--
-- ANALYZE really runs this read-only query; expect a time near or below
-- today's ~13 s; GO only if Execution Time <= 15,000 ms.
--
-- What it is: EXPLAIN (ANALYZE, BUFFERS) of exactly the SELECT that feeds
-- the one INSERT in 01's new refresh_site_counts() (same text, with the
-- INSERT line and the ON CONFLICT lines left off). It reads public.jobs
-- and writes nothing: no INSERT, no UPDATE, no DELETE.
--
-- Read in the result:
--   Execution Time (last line): GO only if <= 15,000 ms. Today's refresh
--     (0009) takes 11,121 to 13,860 ms per pg_cron run.
--   Exactly ONE scan node on jobs, inside "CTE b" (for example
--     "Seq Scan on jobs j", or an Index Scan or Bitmap Heap Scan on jobs
--     with a status = 'active' index). Two scan nodes on jobs = NO-GO.
--   "CTE Scan on b" under the join with the two platforms.
--   Top node "Sort" (Sort Key: key) with about 11 actual rows: 2 plain
--     totals plus one per country (ab 8, et 1 at 22:38).
--   Buffers: "shared hit" + "shared read" on the jobs scan is the IO cost;
--     a high "read" means the pages came from disk (cold), and a second
--     run is usually faster. Report the first run's time, then a second.
-- ============================================================================

EXPLAIN (ANALYZE, BUFFERS)
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
ORDER BY r.key;
