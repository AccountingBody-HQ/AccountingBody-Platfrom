-- ============================================================================
-- 0008_saved_jobs.sql
-- AccountingBody Platform — saved jobs (anonymous visitor bookmarks)
--
-- Purpose: backend table for the Save button on job listings, replacing the
-- localStorage-only implementation (ab_saved_jobs key in
-- app/jobs/listings/JobListingsClient.tsx). Each row is one visitor's save
-- of one job on one platform. Apply BEFORE the Step 2 code ships.
--
-- Retention: rows whose last_seen_at is older than 7 days are deleted by a
-- daily cron added in Step 2. last_seen_at is refreshed (throttled to at
-- most once per hour per visitor) whenever the server reads or writes that
-- visitor's saved jobs. This is the ONLY deletion path for this table and it
-- only ever touches public.saved_jobs.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.saved_jobs;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(), -- surrogate key
  visitor_id    uuid        NOT NULL,                              -- anonymous visitor id from the ab_vid cookie
  job_id        uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE, -- the saved job; cascades if a job row is ever removed (jobs are never deleted today, so this is a safety net, not a routine path)
  platform      text        NOT NULL CHECK (platform IN ('ab','et')), -- which brand the save happened on: accountingbody.com or ethiotax.com
  created_at    timestamptz NOT NULL DEFAULT now(),                -- when the visitor first saved this job
  last_seen_at  timestamptz NOT NULL DEFAULT now(),                -- last time this visitor's saved jobs were read or written; drives the 7-day inactivity clean-up
  CONSTRAINT saved_jobs_visitor_platform_job_key
    UNIQUE (visitor_id, platform, job_id)                          -- one save per visitor per platform per job
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_visitor_list
  ON public.saved_jobs (visitor_id, platform, created_at DESC);
-- serves "list my saved jobs" and the 200-row cap count

CREATE INDEX IF NOT EXISTS idx_saved_jobs_last_seen
  ON public.saved_jobs (last_seen_at);
-- serves the daily 7-day clean-up

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.saved_jobs FROM anon, authenticated;
-- matches the existing zero-grant pattern; the app uses service_role

COMMIT;
