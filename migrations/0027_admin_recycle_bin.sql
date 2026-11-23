-- 0027_admin_recycle_bin.sql
-- 23 Nov 2026 (owner decision D315; BOARD #10, audit A7-07 "no undo: hard deletes").
--
-- WHY: every admin delete was permanent, and every Course Factory save replaced
-- a course's whole structure with no way back. This adds ONE new
-- AccountingBody-owned table that keeps a full JSON copy of anything the admin
-- area deletes or a Course Factory save replaces, and ONE function that puts a
-- copy back in a single transaction (all rows or none).
--
-- WHAT IT DOES NOT DO: it changes no existing table, row, policy or grant.
--
-- ACCESS: the table has RLS on with no policy, and neither the table nor the
-- function is granted to anon or authenticated, so only the server's secret key
-- (service_role) can use them. The public site never reads them.
--
-- SIZE: copies expire after 90 days; the app deletes expired copies whenever it
-- writes to or lists the bin (lib/recycle-bin.ts). Expected well under 1 MB.
--
-- RUN: once, as postgres, with psql -v ON_ERROR_STOP=1 -f, after a fresh backup,
-- BEFORE the code that uses it is merged (the table alone changes nothing).
-- It is one transaction: its first guard stops it if the table already exists,
-- and its last checks roll everything back if the result is not exactly this.
--
-- UNDO (destructive: removes every copy in the bin):
--   DROP FUNCTION IF EXISTS public.admin_recycle_restore(uuid);
--   DROP TABLE IF EXISTS public.admin_recycle_bin;

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $guard$
BEGIN
  IF to_regclass('public.admin_recycle_bin') IS NOT NULL THEN
    RAISE EXCEPTION 'rb_stop: public.admin_recycle_bin already exists - nothing was changed';
  END IF;
  IF to_regprocedure('public.admin_recycle_restore(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'rb_stop: public.admin_recycle_restore(uuid) already exists - nothing was changed';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'rb_stop: expected to run as postgres - nothing was changed';
  END IF;
END
$guard$;

CREATE TABLE public.admin_recycle_bin (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text        NOT NULL,
  reason       text        NOT NULL CHECK (reason IN ('delete', 'course_save')),
  label        text        NOT NULL CHECK (char_length(label) BETWEEN 1 AND 300),
  source_table text        NOT NULL,
  source_id    text,
  payload      jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  row_count    integer     NOT NULL CHECK (row_count >= 0),
  deleted_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  restored_at  timestamptz
);

CREATE INDEX admin_recycle_bin_deleted_at_idx ON public.admin_recycle_bin (deleted_at DESC);
CREATE INDEX admin_recycle_bin_expires_at_idx ON public.admin_recycle_bin (expires_at);

ALTER TABLE public.admin_recycle_bin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_recycle_bin FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_recycle_bin TO service_role;

-- Restores one bin item: inserts every saved row back with its original id, in
-- parent-before-child order, in ONE transaction. Any conflict (for example an
-- address that is now taken by another row) raises and nothing is restored.
CREATE FUNCTION public.admin_recycle_restore(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  item   public.admin_recycle_bin%ROWTYPE;
  t      text;
  n      integer;
  counts jsonb := '{}'::jsonb;
  allowed constant text[] := ARRAY[
    'courses', 'course_chapters', 'course_lessons', 'articles', 'course_lesson_articles',
    'question_sets', 'questions', 'question_cases',
    'job_providers', 'provider_runs',
    'studio_references',
    'help_requests', 'contact_submissions', 'firms_applications', 'email_subscribers',
    'job_seeker_registrations', 'employer_briefs'
  ];
BEGIN
  SELECT * INTO item FROM public.admin_recycle_bin WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recycle bin item not found' USING ERRCODE = 'P0002';
  END IF;
  IF item.restored_at IS NOT NULL THEN
    RAISE EXCEPTION 'recycle bin item already restored' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(item.payload) AS k(key) WHERE NOT (k.key = ANY (allowed))) THEN
    RAISE EXCEPTION 'recycle bin item names a table that cannot be restored' USING ERRCODE = 'P0001';
  END IF;
  FOREACH t IN ARRAY allowed LOOP
    IF item.payload ? t AND jsonb_typeof(item.payload -> t) = 'array' AND jsonb_array_length(item.payload -> t) > 0 THEN
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)', t, t)
        USING item.payload -> t;
      GET DIAGNOSTICS n = ROW_COUNT;
      counts := counts || jsonb_build_object(t, n);
    END IF;
  END LOOP;
  UPDATE public.admin_recycle_bin SET restored_at = now() WHERE id = p_id;
  RETURN counts;
END
$fn$;

REVOKE ALL ON FUNCTION public.admin_recycle_restore(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recycle_restore(uuid) TO service_role;


DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_recycle_bin'::regclass) THEN
    RAISE EXCEPTION 'rb_check_failed: row level security is off';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_recycle_bin') THEN
    RAISE EXCEPTION 'rb_check_failed: unexpected policy';
  END IF;
  IF has_table_privilege('anon', 'public.admin_recycle_bin', 'SELECT')
     OR has_table_privilege('authenticated', 'public.admin_recycle_bin', 'SELECT')
     OR has_table_privilege('anon', 'public.admin_recycle_bin', 'INSERT')
     OR has_table_privilege('authenticated', 'public.admin_recycle_bin', 'INSERT') THEN
    RAISE EXCEPTION 'rb_check_failed: anon or authenticated holds a table right';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.admin_recycle_bin', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'rb_check_failed: service_role lacks a table right';
  END IF;
  IF has_function_privilege('anon', 'public.admin_recycle_restore(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_recycle_restore(uuid)', 'EXECUTE')
     OR has_function_privilege('public', 'public.admin_recycle_restore(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'rb_check_failed: the restore function is executable by the public';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.admin_recycle_restore(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'rb_check_failed: service_role cannot execute the restore function';
  END IF;
  IF (SELECT count(*) FROM public.admin_recycle_bin) <> 0 THEN
    RAISE EXCEPTION 'rb_check_failed: table is not empty';
  END IF;
END
$check$;

SELECT 'rb|created|rls|on|policies|0|anon|none|service_role|ok';

NOTIFY pgrst, 'reload schema';

COMMIT;
