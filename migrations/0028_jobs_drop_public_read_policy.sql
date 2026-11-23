-- 0028_jobs_drop_public_read_policy.sql
-- 23 Nov 2026 (FINDINGS KM, DS-2; BOARD #18 personal data, audit A7-11).
--
-- WHY: the policy "Public read active jobs" (0002) lets anyone holding the
-- public (anon) key read EVERY column of every active job through the
-- database API, including employer_email, employer_phone and
-- application_email of employer-posted jobs. The site never uses it: every
-- read runs on the server with the secret key (lib/supabase-server.ts), which
-- bypasses RLS. Removing it closes that door; the public job pages are
-- unaffected.
--
-- WHAT: one DROP POLICY. No table, row, grant or other policy changes.
--
-- RUN: once, as postgres, piped through stdin (docs/AGENT-RULES.md; never
-- psql -f on a migration file), after a fresh backup. One transaction: the
-- first guard stops it if the policy is not exactly as 0002 created it; the
-- last check rolls everything back if any SELECT policy remains on jobs.
--
-- UNDO (restores the 0002 policy exactly):
--   CREATE POLICY "Public read active jobs" ON public.jobs
--     FOR SELECT TO public USING (status = 'active');

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'jp_stop: expected to run as postgres - nothing was changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs' AND policyname = 'Public read active jobs'
      AND cmd = 'SELECT' AND roles = ARRAY['public']::name[] AND qual = '(status = ''active''::text)'
  ) THEN
    RAISE EXCEPTION 'jp_stop: the policy is not exactly as 0002 created it (or is already gone) - nothing was changed';
  END IF;
END
$guard$;

DROP POLICY "Public read active jobs" ON public.jobs;

DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs') THEN
    RAISE EXCEPTION 'jp_check_failed: a policy remains on public.jobs';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.jobs'::regclass) THEN
    RAISE EXCEPTION 'jp_check_failed: row level security is off on public.jobs';
  END IF;
END
$check$;

SELECT 'jp|dropped|jobs_policies|0|rls|on';

COMMIT;
