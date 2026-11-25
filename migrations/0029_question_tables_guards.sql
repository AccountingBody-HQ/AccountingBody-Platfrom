-- 0029_question_tables_guards.sql
-- 25 Nov 2026 (owner decisions D338 fix as we go, D339 close-out plan; PQ-1e).
--
-- NOT APPLIED when this file was written. Applied later by an owner-approved
-- database job (M-102) after a fresh backup.
--
-- WHY: the admin tools check these three rules, but two requests in the same
-- second could both pass such a check. The database now refuses the second:
--   1. one practice set per article (question_sets.article_slug, when set);
--   2. a stored answer is A to D or empty (questions.correct_index 0 to 3).
-- And the two columns every page of a set is read by get an index:
--   3. questions.set_id and question_cases.set_id.
-- Schema facts (PQ-1d, 25 Nov 2026 12:14 UTC; PQ-1e, 13:24 UTC, both
-- read-only): slug and content_id are already unique; 0 articles with more
-- than one set; 0 stored answers outside 0 to 3; no index on set_id; all four
-- names below are free.
--
-- WHAT IT DOES NOT DO: it changes no row, column, policy, grant or function,
-- and removes nothing. Sets without an article (null or empty) stay allowed,
-- any number of them.
--
-- SIZE: on 25 Nov 2026 the tables (with their indexes) were questions 6,240 kB,
-- question_sets 312 kB, question_cases 32 kB. Expected new indexes:
-- questions_set_id_idx at most about 200 kB, the other two 16 to 32 kB each;
-- about 0.25 MB in all. The constraint takes no space. Each step reads one
-- small table once, so it takes well under a second. Reads of questions wait
-- for that moment; writes to the three tables wait until COMMIT.
--
-- RUN: once, as postgres, through stdin (psql -X -v ON_ERROR_STOP=1, from the
-- line BEGIN to the line COMMIT), after a fresh backup, BEFORE the PQ-1 pull
-- request is merged: its code then finds the names it knows, and the code that
-- is live before the merge works with the rules as well. It is one
-- transaction: its first guard stops it if anything is not as expected, and
-- its last checks roll everything back if the result is not exactly this.
--
-- UNDO (removes only what this file adds; no row changes):
--   DROP INDEX IF EXISTS public.question_sets_article_slug_key;
--   DROP INDEX IF EXISTS public.questions_set_id_idx;
--   DROP INDEX IF EXISTS public.question_cases_set_id_idx;
--   ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_correct_index_range;

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $guard$
DECLARE
  taken text;
  n     bigint;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'qg_stop: expected to run as postgres - nothing was changed';
  END IF;
  SELECT string_agg(x, ', ' ORDER BY x) INTO taken
  FROM unnest(ARRAY['question_sets_article_slug_key', 'questions_set_id_idx', 'question_cases_set_id_idx', 'questions_correct_index_range']) AS x
  WHERE EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'public' AND c.relname = x)
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname = x);
  IF taken IS NOT NULL THEN
    RAISE EXCEPTION 'qg_stop: already there: % - nothing was changed', taken;
  END IF;
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM public.question_sets WHERE article_slug IS NOT NULL AND article_slug <> '' GROUP BY article_slug HAVING count(*) > 1
  ) AS d;
  IF n <> 0 THEN
    RAISE EXCEPTION 'qg_stop: % articles have more than one set - nothing was changed', n;
  END IF;
  SELECT count(*) INTO n FROM public.questions WHERE correct_index IS NOT NULL AND correct_index NOT BETWEEN 0 AND 3;
  IF n <> 0 THEN
    RAISE EXCEPTION 'qg_stop: % stored answers are outside 0 to 3 - nothing was changed', n;
  END IF;
END
$guard$;

ALTER TABLE public.questions ADD CONSTRAINT questions_correct_index_range CHECK (correct_index IS NULL OR correct_index BETWEEN 0 AND 3);

CREATE UNIQUE INDEX question_sets_article_slug_key ON public.question_sets (article_slug) WHERE article_slug IS NOT NULL AND article_slug <> '';

CREATE INDEX questions_set_id_idx ON public.questions (set_id);

CREATE INDEX question_cases_set_id_idx ON public.question_cases (set_id);

-- PostgreSQL's own text of each part, compared with what was meant. A column
-- of type varchar prints a cast, which is removed before comparing.
DO $check$
DECLARE
  part record;
  def  text;
BEGIN
  FOR part IN
    SELECT * FROM (VALUES
      ('question_sets_article_slug_key', 'CREATE UNIQUE INDEX question_sets_article_slug_key ON public.question_sets USING btree (article_slug) WHERE ((article_slug IS NOT NULL) AND (article_slug <> ''''::text))'),
      ('questions_set_id_idx', 'CREATE INDEX questions_set_id_idx ON public.questions USING btree (set_id)'),
      ('question_cases_set_id_idx', 'CREATE INDEX question_cases_set_id_idx ON public.question_cases USING btree (set_id)')
    ) AS v(name, meant)
  LOOP
    SELECT replace(pg_get_indexdef(i.indexrelid), '(article_slug)::text', 'article_slug') INTO def
    FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || part.name) AND i.indisvalid;
    IF def IS DISTINCT FROM part.meant THEN
      RAISE EXCEPTION 'qg_check_failed: % is %', part.name, coalesce(def, 'missing');
    END IF;
  END LOOP;

  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conrelid = 'public.questions'::regclass AND conname = 'questions_correct_index_range' AND contype = 'c';
  IF def IS DISTINCT FROM 'CHECK (((correct_index IS NULL) OR ((correct_index >= 0) AND (correct_index <= 3))))' THEN
    RAISE EXCEPTION 'qg_check_failed: questions_correct_index_range is %', coalesce(def, 'missing');
  END IF;
END
$check$;

SELECT 'qg|created|indexes|3|constraints|1|rows_changed|0';

COMMIT;
