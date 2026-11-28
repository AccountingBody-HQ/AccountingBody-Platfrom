-- ============================================================================
-- 0033_question_sets_registry.sql
-- Date: 28 Nov 2026 (E2; owner decisions D373, D379)
--
-- NOT APPLIED when this file was committed. It is run ONCE (Part B) by the
-- owner-approved E2 database step, after a fresh backup and BEFORE the E2
-- release is merged, so the new Content Studio can save its quality record.
-- The outcome is recorded in ab-control. Do not run it again: Part B stops
-- itself when any of the four columns already exists.
--
-- Why: every practice set made in the Content Studio records which prompt
-- made it (prompt id and version), which AI model was used, and the quality
-- gate's score (D373, the registry). Sets made before have no record.
--
-- What changes: ONLY public.question_sets gets four new, empty (NULL)
-- columns and four CHECK rules on them. No existing value, row, table,
-- policy, grant or trigger is changed; nothing is backfilled. The roles anon
-- and authenticated have no rights on question_sets (migration 0031), so
-- they get none on the new columns either; Part B proves it.
--
-- Order: fresh backup -> Part A (read-only) -> Part B once -> Part A again
-- (read-only) -> then the E2 release is merged.
-- Undo: Part C, only with the owner's approval and only together with a
-- rollback of the E2 release (the release writes these columns).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Part A — read-only check (run as: BEGIN READ ONLY; … ROLLBACK;)
-- ----------------------------------------------------------------------------
-- SELECT 'a|sets|' || count(*) FROM public.question_sets;
-- SELECT 'a|published|' || count(*) FROM public.question_sets WHERE status = 'published';
-- SELECT 'a|registry_columns|' || count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'question_sets' AND column_name IN ('prompt_id', 'prompt_version', 'model', 'quality_score');
-- SELECT 'a|registry_rules|' || count(*) FROM pg_constraint WHERE conrelid = 'public.question_sets'::regclass AND conname IN ('question_sets_prompt_id_format', 'question_sets_prompt_version_length', 'question_sets_model_length', 'question_sets_quality_score_range');
-- SELECT 'a|browser_table_rights|' || count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'question_sets' AND grantee IN ('anon', 'authenticated');
-- SELECT 'a|triggers|' || count(*) FROM pg_trigger WHERE tgrelid = 'public.question_sets'::regclass AND NOT tgisinternal;


-- ----------------------------------------------------------------------------
-- Part B — the change (one transaction; stops itself if anything is unexpected)
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
  n_cols   integer;
  n_rights integer;
BEGIN
  SELECT count(*) INTO n_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'question_sets'
     AND column_name IN ('prompt_id', 'prompt_version', 'model', 'quality_score');
  IF n_cols <> 0 THEN
    RAISE EXCEPTION 'e2_stop: % of the four columns already exist, expected 0', n_cols;
  END IF;
  SELECT count(*) INTO n_rights FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'question_sets'
     AND grantee IN ('anon', 'authenticated');
  IF n_rights <> 0 THEN
    RAISE EXCEPTION 'e2_stop: % browser table rights on question_sets, expected 0', n_rights;
  END IF;
END $$;

ALTER TABLE public.question_sets
  ADD COLUMN prompt_id      text,
  ADD COLUMN prompt_version text,
  ADD COLUMN model          text,
  ADD COLUMN quality_score  smallint,
  ADD CONSTRAINT question_sets_prompt_id_format
    CHECK (prompt_id IS NULL OR prompt_id ~ '^[0-9a-f]{16}$'),
  ADD CONSTRAINT question_sets_prompt_version_length
    CHECK (prompt_version IS NULL OR char_length(prompt_version) BETWEEN 1 AND 200),
  ADD CONSTRAINT question_sets_model_length
    CHECK (model IS NULL OR char_length(model) BETWEEN 1 AND 100),
  ADD CONSTRAINT question_sets_quality_score_range
    CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100);

DO $$
DECLARE
  n_cols   integer;
  n_rules  integer;
  n_filled integer;
  n_rights integer;
  n_colr   integer;
BEGIN
  SELECT count(*) INTO n_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'question_sets'
     AND column_name IN ('prompt_id', 'prompt_version', 'model', 'quality_score')
     AND is_nullable = 'YES' AND column_default IS NULL;
  SELECT count(*) INTO n_rules FROM pg_constraint
   WHERE conrelid = 'public.question_sets'::regclass AND contype = 'c'
     AND conname IN ('question_sets_prompt_id_format', 'question_sets_prompt_version_length',
                     'question_sets_model_length', 'question_sets_quality_score_range');
  SELECT count(*) INTO n_filled FROM public.question_sets
   WHERE prompt_id IS NOT NULL OR prompt_version IS NOT NULL OR model IS NOT NULL OR quality_score IS NOT NULL;
  SELECT count(*) INTO n_rights FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'question_sets'
     AND grantee IN ('anon', 'authenticated');
  SELECT count(*) INTO n_colr FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'question_sets'
     AND grantee IN ('anon', 'authenticated');
  IF n_cols <> 4 OR n_rules <> 4 OR n_filled <> 0 OR n_rights <> 0 OR n_colr <> 0 THEN
    RAISE EXCEPTION 'e2_check_failed: columns %, rules %, filled %, table rights %, column rights %',
      n_cols, n_rules, n_filled, n_rights, n_colr;
  END IF;
END $$;

SELECT 'b|added|columns|4|rules|4|filled|0|sets|'
       || (SELECT count(*) FROM public.question_sets);
COMMIT;


-- ----------------------------------------------------------------------------
-- Part C — undo (only with the owner's approval, together with a rollback of
-- the E2 release; it removes the record of every set made since)
-- ----------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.question_sets
--   DROP CONSTRAINT question_sets_quality_score_range,
--   DROP CONSTRAINT question_sets_model_length,
--   DROP CONSTRAINT question_sets_prompt_version_length,
--   DROP CONSTRAINT question_sets_prompt_id_format,
--   DROP COLUMN quality_score,
--   DROP COLUMN model,
--   DROP COLUMN prompt_version,
--   DROP COLUMN prompt_id;
-- COMMIT;
