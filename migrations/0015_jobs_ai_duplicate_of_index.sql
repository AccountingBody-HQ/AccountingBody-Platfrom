-- ============================================================================
-- 0015_jobs_ai_duplicate_of_index.sql
-- Date: 17 Nov 2026
--
-- APPLIED on 17 Nov 2026 at 09:18 UTC (built in 16 s; valid; 8,192 bytes).
-- Kept as the record. Do not run it again. The undo is at the end.
--
-- What: one small partial index on public.jobs(ai_duplicate_of), only for
-- rows where ai_duplicate_of is set (0 rows on 17 Nov 2026).
--
-- Why: ai_duplicate_of is a self foreign key (jobs_ai_duplicate_of_fkey,
-- ON DELETE SET NULL). Without an index, every deleted job made the
-- database scan the whole jobs table to find rows pointing at it. The
-- daily retention cron (app/api/cron/prune-expired-jobs, owner decision
-- D140) deletes 100 jobs per call, so its first real run on 17 Nov 2026
-- at 07:30 UTC was cancelled by the API role's 8 s statement_timeout and
-- deleted nothing (FINDINGS EX, EY). With the index the foreign-key check
-- is an index lookup (0.7 ms instead of a 0.3-15 s full scan); a manual
-- run at 09:23 UTC then deleted all 1,899 due jobs (D201).
--
-- Owner approval: D199. Applied: D200 (backup run 44052081697 first).
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction and changes no
-- rows: it runs alone with its own statement_timeout (CLAUDE.md section 3).

SET statement_timeout = '15min';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_ai_duplicate_of ON public.jobs (ai_duplicate_of) WHERE ai_duplicate_of IS NOT NULL;

-- Undo (owner decision only):
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_jobs_ai_duplicate_of;
