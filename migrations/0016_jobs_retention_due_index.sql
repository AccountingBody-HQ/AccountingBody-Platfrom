-- ============================================================================
-- 0016_jobs_retention_due_index.sql
-- Date: 17 Nov 2026
--
-- APPLIED on 17 Nov 2026 at 12:03 UTC (built in about 10 s; valid;
-- 139,264 bytes). Kept as the record. Do not run it again. The undo is at
-- the end.
--
-- What: one small partial index on public.jobs(closed_at), only for
-- imported jobs that are expired (status 'expired', source not
-- 'employer'), about 10,100 rows on 17 Nov 2026.
--
-- Why: the retention check in /api/ops-status and the daily retention
-- cron (app/api/cron/prune-expired-jobs, owner decision D140) both look
-- for expired imported jobs closed before a cutoff. Without this index the
-- database walked every expired job (5,752 buffers) to find the few that
-- are due; under load that took up to 2.6 s, and a fresh ops-status answer
-- took up to 6.8 s against its 6 s read limit (FINDINGS FB). With the
-- index both reads touch 2 buffers (0.03-0.04 ms).
--
-- Owner approval: D212. Applied: D213 (backup run 44078287204 first).
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction and changes no
-- rows: it runs alone with its own statement_timeout (CLAUDE.md section 3).

SET statement_timeout = '15min';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_retention_due ON public.jobs (closed_at) WHERE status = 'expired' AND source <> 'employer';

-- Undo (owner decision only):
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_jobs_retention_due;
