-- ============================================================================
-- 0022_jobs_drop_raw_source_data.sql
-- Date: 21 Nov 2026
--
-- NOT APPLIED — applied later by an owner-approved database job (DL-2) after
-- a fresh backup, only after PR #83 is live.
--
-- What: removes the column public.jobs.raw_source_data.
--
-- Why (D287 (2)): it holds a copy of each provider's original job record,
-- which is never shown anywhere and holds about 48 MB. The code stopped
-- naming the column in PR #83, so imports and job posts keep working once
-- it is gone.
--
-- The drop only marks the column as gone (no rows are rewritten, the size
-- does not change); the space comes back at the next VACUUM FULL public.jobs
-- (DL-3, headroom rule).
--
-- UNDO (structure only; the data comes back only from the backup): ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS raw_source_data jsonb;
-- ============================================================================

SET lock_timeout = '3s';
ALTER TABLE public.jobs DROP COLUMN IF EXISTS raw_source_data;
