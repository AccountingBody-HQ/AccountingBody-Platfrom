-- ============================================================================
-- 0013_et_sitemap_index.sql
-- Date: 15 Nov 2026
--
-- APPLIED on 15 Nov 2026 at 18:35 UTC (built in 7 s; valid; about 1 MB).
-- Kept as the record. Do not run it again. The undo is Part D.
--
-- What: one small index on public.jobs, idx_jobs_et_sitemap. It lists only
-- the jobs the EthioTax sitemap reads (platform includes 'et', status
-- active or expired), in id order, and carries the four columns the
-- sitemap needs, so each page of the sitemap read is answered from the
-- index alone.
--
-- Why: the EthioTax job sitemap (lib/jobs.ts, getJobSitemapEntries) reads
-- about 8,200 of about 46,700 jobs in nine pages of 1,000, by id. With
-- today's indexes each page walks the primary key and discards the rows
-- of other sites, or sorts every matching row. The database's own
-- statistics for this read showed a mean of 0.9 s per page for pages 2-9
-- and 2.3 s for page 1.
--
-- Measured on 15 Nov 2026 on temporary copies of the seven columns
-- involved (46,677 rows, 8,232 matching; nothing was changed in the real
-- database):
--   all nine pages, today's indexes:  45,572 buffers, 89.2 ms
--   all nine pages, with this index:     148 buffers,  3.2 ms,
--                                        Index Only Scan on every page,
--                                        0 heap fetches
--   index size on the copy:           1,015,808 bytes (about 1 MB)
-- The copies are compact, so the real table's times are larger than the
-- 89.2 ms above; the real-table gain in milliseconds is to be read from
-- Part C after applying.
--
-- The read arrives through the database API with parameters. Tested in
-- the default plan_cache_mode (auto) with the API's exact statement text
-- and untyped parameters: 10 of 10 and 16 of 16 runs stayed on
-- value-specific plans that use the index. Planner cost of the whole
-- statement with the index: 41 (page 1) and 22-63 (pages 2-9), against
-- 274 and 268 for the plan without parameter values, which cannot use a
-- partial index. Those two figures were read on the real table.
-- If the table's visibility map were mostly unset (it was 13,448 of
-- 13,448 pages set when measured), the database could fall back to
-- today's plan for some pages: the same result at today's cost.
--
-- How to run:
--   1. Fresh backup.
--   2. Part A (read-only). The owner approves the exact Part B statement.
--   3. Part B ALONE, as its own query, outside a transaction.
--      CREATE INDEX CONCURRENTLY cannot run inside a transaction and does
--      not block reads or writes on the table while it builds.
--   4. Part C (read-only).
-- Do not run this file as one query.
--
-- Additive: no table, column, row, function or existing index is changed.
-- No application code changes with it; the query text stays the same.
-- Undo: Part D.
-- Scope: one index on public.jobs, an AccountingBody-owned table (see
-- README.md).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART A — READ-ONLY PRE-CHECKS. Run on its own.
--   A1  rows the index would hold. Measured 15 Nov 2026: 8,232 of 46,677.
--   A2  the index must not exist yet: expect 0 rows. If a row comes back
--       with is_valid = false, an earlier build was interrupted: run
--       Part D first, then Part B.
--   A3  database size in bytes. Measured 15 Nov 2026: 405,892,243.
--       The index adds about 1 MB.
-- ----------------------------------------------------------------------------
BEGIN READ ONLY;

SELECT
  count(*) AS all_rows,
  count(*) FILTER (
    WHERE platform @> ARRAY['et']::text[] AND status IN ('active','expired')
  ) AS rows_in_index
FROM public.jobs;

SELECT c.relname AS index_name, i.indisvalid AS is_valid
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname = 'idx_jobs_et_sitemap'
  AND c.relnamespace = 'public'::regnamespace;

SELECT pg_database_size(current_database()) AS database_bytes;

ROLLBACK;


-- ----------------------------------------------------------------------------
-- PART B — THE INDEX. Only after a fresh backup and the owner's approval of
-- this exact statement. RUN ALONE, as its own query (CONCURRENTLY: no
-- transaction).
-- ----------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_et_sitemap ON public.jobs USING btree (id) INCLUDE (slug, expires_at, published_at, created_at) WHERE platform @> ARRAY['et']::text[] AND status IN ('active','expired');


-- ----------------------------------------------------------------------------
-- PART C — READ-ONLY VERIFY. Run on its own, after Part B has finished.
--   C1  expect one row: is_valid = true, is_ready = true, about 1 MB.
--       If is_valid is false the build was interrupted: run Part D, then
--       Part B again.
--   C2  page 1 of the sitemap read. Expect "Index Only Scan using
--       idx_jobs_et_sitemap".
--   C3  a middle page (after the 4,000th matching row). Expect "Index Only
--       Scan using idx_jobs_et_sitemap" for the outer read.
-- C2 and C3 are plain EXPLAIN: they show the plan and run nothing.
-- ----------------------------------------------------------------------------
BEGIN READ ONLY;

SELECT
  c.relname AS index_name,
  i.indisvalid AS is_valid,
  i.indisready AS is_ready,
  pg_relation_size(c.oid) AS index_bytes,
  pg_get_indexdef(c.oid) AS definition
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname = 'idx_jobs_et_sitemap'
  AND c.relnamespace = 'public'::regnamespace;

EXPLAIN
SELECT id, slug, expires_at, published_at, created_at
FROM public.jobs
WHERE status = ANY ('{active,expired}') AND platform @> '{et}'
ORDER BY id ASC
LIMIT 1000;

EXPLAIN
SELECT id, slug, expires_at, published_at, created_at
FROM public.jobs
WHERE status = ANY ('{active,expired}') AND platform @> '{et}'
  AND id > (
    SELECT id
    FROM public.jobs
    WHERE status = ANY ('{active,expired}') AND platform @> '{et}'
    ORDER BY id ASC
    OFFSET 3999 LIMIT 1
  )
ORDER BY id ASC
LIMIT 1000;

ROLLBACK;


-- ----------------------------------------------------------------------------
-- PART D — UNDO. Only with the owner's approval. RUN ALONE, as its own
-- query (CONCURRENTLY: no transaction).
--
-- Removes the index and nothing else. No row is touched; the sitemap read
-- goes back to today's plans.
--
-- Clean-up after an interrupted build: if Part B is cancelled or fails part
-- way, PostgreSQL leaves the index behind marked INVALID. It is never used
-- for reads but is still kept up to date on every write, and
-- "IF NOT EXISTS" in Part B would then skip the build without an error.
-- Run this statement to remove the leftover, then run Part B again.
-- ----------------------------------------------------------------------------
DROP INDEX CONCURRENTLY IF EXISTS idx_jobs_et_sitemap;
