-- ============================================================================
-- APPLIED 11 Nov 2026 — kept for checks/rollback; source of truth is 0009
-- (migrations/0009_site_counts_and_jobs_browsable_index.sql).
-- Proposed 11 November 2026 (speed job, owner decision D108).
-- Run after 01 and 02. Undo: 99_rollback.sql, part A.
-- ============================================================================
--
-- Step 1, read-only: is pg_cron switched on?
--   One row (pg_cron) -> carry on with steps 2 and 3.
--   No rows           -> switch it on first: Supabase dashboard, Database,
--                        Extensions, pg_cron, enable. That is an owner step.
--   (migrations/0002 recorded pg_cron 1.6.4 as installed on 11 Sept 2026.)
select extname, extversion from pg_extension where extname = 'pg_cron';

-- Step 2: write the first counts now, then show them.
select public.refresh_site_counts();
select key, value, updated_at from public.site_counts order by key;

-- Step 3: recount every 10 minutes, inside the database.
-- Scheduling the same job name again replaces it (pg_cron 1.3 and later),
-- so this line is safe to run twice.
--
-- Why pg_cron and not the existing 15-minute Vercel cron
-- (/api/ingest/orchestrator): it runs inside the database, so it does not
-- depend on a deploy, on the cron secret or on the orchestrator reaching its
-- end (it returns early when no provider is due, or on an error); it needs
-- no grant to the API roles; and every 10 minutes keeps the total within
-- about 12.5 minutes old, inside D108's ~15 minutes. The orchestrator's
-- 15 minutes plus the site's 2-minute cache would not be.
select cron.schedule('refresh-site-counts', '*/10 * * * *', 'select public.refresh_site_counts();');

-- Show the job that is now scheduled.
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'refresh-site-counts';
