-- ============================================================================
-- TRIAL helper — used and dropped 11 Nov 2026. Source of truth is 0010.
-- (Proposed 11 November 2026, speed job part 2.)
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d.
-- One transaction. Safe to run twice, and safe if 00 was never run.
-- ============================================================================
--
-- Removes the trial copy public.search_jobs_ranked_trial created by 00, and
-- only that: it is dropped only if its comment starts with
-- 'AccountingBody: TRIAL'. A same-named function that is not ours is left
-- alone (a notice says so). The live public.search_jobs_ranked is never
-- touched. to_regprocedure returns NULL for a missing function instead of
-- failing.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.search_jobs_ranked_trial(text, text, text, text, text[], text[], boolean, integer, integer, integer, text[], text[], text, integer, integer)') IS NULL THEN
    RAISE NOTICE 'public.search_jobs_ranked_trial does not exist; nothing to drop.';
  ELSIF coalesce(obj_description(to_regprocedure('public.search_jobs_ranked_trial(text, text, text, text, text[], text[], boolean, integer, integer, integer, text[], text[], text, integer, integer)'), 'pg_proc'), '') LIKE 'AccountingBody: TRIAL%' THEN
    DROP FUNCTION public.search_jobs_ranked_trial(
      text, text, text, text, text[], text[], boolean, integer, integer,
      integer, text[], text[], text, integer, integer
    );
  ELSE
    RAISE NOTICE 'public.search_jobs_ranked_trial is not the AccountingBody trial copy; left alone.';
  END IF;
END
$$;

COMMIT;
