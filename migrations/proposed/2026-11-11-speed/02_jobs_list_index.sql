-- ============================================================================
-- NOT APPLIED. Proposed 11 November 2026 (speed job, owner decision D108).
-- Run after 01, on its own: this file must be the only statement in the
-- query. CREATE INDEX CONCURRENTLY cannot run inside a transaction, so do
-- not paste it together with any other file.
-- Undo: 99_rollback.sql, part B.
-- ============================================================================
--
-- One index for the two things that must be fast:
--   (i)  the count in public.refresh_site_counts(): an index-only scan of
--        active jobs, checking platform and expires_at from the index itself
--        (both are INCLUDEd), without reading the table rows;
--   (ii) the default jobs list, page N (lib/jobs.ts, getDefaultOrderJobs):
--        WHERE status='active' AND platform @> {p} AND not expired
--        ORDER BY source_score DESC, published_at DESC NULLS LAST,
--                 created_at DESC, id DESC
--        LIMIT 24 OFFSET 24*(N-1)
--        The index is already in that order, so the database reads entries
--        from the top and stops after the requested page; nothing is sorted.
--
-- Why partial (WHERE status = 'active'): the "browsable" filter is
-- status + platform + expiry. Expiry compares with now(), which an index
-- predicate cannot contain, and platform is an array; status = 'active' is
-- the only fixed part, and it already excludes every expired, closed,
-- rejected and draft job, which keeps the index small.
--
-- Why source_score first: it is the only boost in today's 'Most relevant'
-- score besides age and search words (migrations/0004, weight 0.20).
-- Direct employer jobs have the highest value, so they stay on top of the
-- default list (owner condition a).
--
-- CONCURRENTLY: the jobs table stays readable and writable while it builds.
-- If the build is interrupted it can leave an INVALID index behind, which
-- IF NOT EXISTS would then skip; 04_checks_readonly.sql shows whether it is
-- valid. If it is not: run 99_rollback.sql part B, then this file again.
--
-- Additive: no existing index changes. The live code does not need it to
-- work; it only makes the new code's queries fast.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_browsable_default_order
  ON public.jobs USING btree (source_score DESC, published_at DESC NULLS LAST, created_at DESC, id DESC)
  INCLUDE (platform, expires_at)
  WHERE status = 'active';
