-- ============================================================================
-- 0024_provider_runs_drop_raw_response_sample.sql
-- Date: 21 Nov 2026
--
-- NOT APPLIED — record.
-- applied by M-85 after the merge, once no deployed code writes the column,
-- after a fresh backup and the owner's approval.
--
-- What: removes the column public.provider_runs.raw_response_sample.
--
-- Why (D287): it held a copy of one provider record per import run, which
-- nothing reads. The code stopped writing it in the LB-1 pull request, so
-- import runs keep working once it is gone. Dropping it before that code is
-- live would make the live run update fail.
--
-- The drop only marks the column as gone (no rows are rewritten); the space
-- comes back at the next VACUUM FULL public.provider_runs.
--
-- UNDO (structure only; the data comes back only from the backup): ALTER TABLE public.provider_runs ADD COLUMN IF NOT EXISTS raw_response_sample jsonb;
-- ============================================================================

SET lock_timeout = '3s';
ALTER TABLE public.provider_runs DROP COLUMN IF EXISTS raw_response_sample;
