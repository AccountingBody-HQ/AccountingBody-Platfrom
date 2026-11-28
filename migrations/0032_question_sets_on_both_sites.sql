-- ============================================================================
-- 0032_question_sets_on_both_sites.sql
-- Date: 28 Nov 2026 (E1a; owner decision D373 E)
--
-- NOT APPLIED when this file was committed. It is run ONCE (Part B) by the
-- owner-approved E1a database step AFTER the E1a release is live, after a
-- fresh backup. The outcome is recorded in ab-control. Do not run it again:
-- Part B stops itself when the count is not the expected one.
--
-- Why: every study note is on both sites, but 71 published practice sets
-- were saved for Accounting Body only, because the import screen's default
-- tick was "accountingbody" (E1a makes both sites the default). The owner
-- decided that every practice set is on both sites (D373 E).
--
-- What changes: ONLY public.question_sets.show_on_sites, ONLY on published
-- sets whose value is exactly '{ab}', from '{ab}' to '{ab,et}'. Nothing else
-- is written by this file: no other column, row, table, policy or grant.
-- updated_at is not touched.
--
-- Order: fresh backup -> Part A (read-only) -> Part B once (its output holds
-- the list of changed ids: save it in the private report, it is the undo) ->
-- Part A again (read-only) -> the public caches catch up within 1 hour.
-- Undo: Part C, with the ids saved from Part B, only with the owner's approval.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Part A — read-only check (run as: BEGIN READ ONLY; … ROLLBACK;)
-- ----------------------------------------------------------------------------
-- SELECT 'a|published|' || count(*) FROM public.question_sets WHERE status = 'published';
-- SELECT 'a|published_ab_only|' || count(*) FROM public.question_sets WHERE status = 'published' AND show_on_sites = '{ab}';
-- SELECT 'a|published_ab_et|' || count(*) FROM public.question_sets WHERE status = 'published' AND show_on_sites = '{ab,et}';
-- SELECT 'a|published_other|' || count(*) FROM public.question_sets WHERE status = 'published' AND show_on_sites IS DISTINCT FROM '{ab}' AND show_on_sites IS DISTINCT FROM '{ab,et}';
-- SELECT 'a|not_published_ab_only|' || count(*) FROM public.question_sets WHERE status IS DISTINCT FROM 'published' AND show_on_sites = '{ab}';
-- SELECT 'a|triggers|' || count(*) FROM pg_trigger WHERE tgrelid = 'public.question_sets'::regclass AND NOT tgisinternal;


-- ----------------------------------------------------------------------------
-- Part B — the change (one transaction; stops itself on any other count)
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE e1a_ab_only ON COMMIT DROP AS
  SELECT id FROM public.question_sets
  WHERE status = 'published' AND show_on_sites = '{ab}';

-- The undo list: the ids that are about to change.
SELECT 'b|undo_ids|' || coalesce(string_agg(id::text, ',' ORDER BY id::text), '') FROM e1a_ab_only;

DO $$
DECLARE
  n_before  integer;
  n_changed integer;
  n_left    integer;
  n_both    integer;
  n_total   integer;
BEGIN
  SELECT count(*) INTO n_before FROM e1a_ab_only;
  IF n_before <> 71 THEN
    RAISE EXCEPTION 'e1a_stop: % published sets on ab only, expected 71', n_before;
  END IF;

  UPDATE public.question_sets q
     SET show_on_sites = '{ab,et}'
    FROM e1a_ab_only a
   WHERE q.id = a.id
     AND q.status = 'published'
     AND q.show_on_sites = '{ab}';
  GET DIAGNOSTICS n_changed = ROW_COUNT;
  IF n_changed <> 71 THEN
    RAISE EXCEPTION 'e1a_stop: % rows changed, expected 71', n_changed;
  END IF;

  SELECT count(*) INTO n_left  FROM public.question_sets WHERE status = 'published' AND show_on_sites = '{ab}';
  SELECT count(*) INTO n_both  FROM public.question_sets WHERE status = 'published' AND show_on_sites = '{ab,et}';
  SELECT count(*) INTO n_total FROM public.question_sets WHERE status = 'published';
  IF n_left <> 0 OR n_both <> 182 OR n_total <> 182 THEN
    RAISE EXCEPTION 'e1a_check_failed: left %, both %, published %', n_left, n_both, n_total;
  END IF;
END $$;

SELECT 'b|changed|71|published_ab_only|'
       || (SELECT count(*) FROM public.question_sets WHERE status = 'published' AND show_on_sites = '{ab}')
       || '|published_ab_et|'
       || (SELECT count(*) FROM public.question_sets WHERE status = 'published' AND show_on_sites = '{ab,et}');
COMMIT;


-- ----------------------------------------------------------------------------
-- Part C — undo (only with the owner's approval; <IDS> = the saved list)
-- ----------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.question_sets SET show_on_sites = '{ab}'
--  WHERE id::text = ANY (string_to_array('<IDS>', ','))
--    AND show_on_sites = '{ab,et}';
-- -- expect UPDATE 71; any other count → ROLLBACK;
-- COMMIT;
