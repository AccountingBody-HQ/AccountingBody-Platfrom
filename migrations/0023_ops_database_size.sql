-- ============================================================================
-- 0023_ops_database_size.sql
-- Date: 21 Nov 2026
--
-- NOT APPLIED — record; applied by M-85 BEFORE the merge of the LB-1 pull
-- request, after a fresh backup and the owner's approval, as one
-- transaction. Until it is applied, the database-size check of
-- /api/ops-status answers unknown (503).
--
-- What: the function public.ops_database_size(), which returns the size of
-- the database in bytes. Only service_role may run it.
--
-- Why (D287, DL-4): /api/ops-status says failing above 300 MB, so the free
-- plan's 500 MB is never reached by surprise. The answer shows the word
-- only, never the number.
--
-- Rights: SECURITY INVOKER (the default). service_role has CONNECT on the
-- database, which is all pg_database_size needs. The search path is empty
-- and every name is schema-qualified. EXECUTE is taken from PUBLIC, anon and
-- authenticated and given to service_role only. CREATE FUNCTION (not OR
-- REPLACE) stops if the function already exists; the self-check raises, and
-- the transaction rolls back, on any difference. The schema reload notice is
-- sent after COMMIT.
--
-- UNDO: DROP FUNCTION IF EXISTS public.ops_database_size();
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $g$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'lb1_stop: expected to run as postgres - nothing was changed';
  END IF;
END
$g$;
CREATE FUNCTION public.ops_database_size()
  RETURNS bigint
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = ''
AS $f$
  SELECT pg_catalog.pg_database_size(pg_catalog.current_database())
$f$;
COMMENT ON FUNCTION public.ops_database_size() IS
  'AccountingBody: database size in bytes for /api/ops-status (D287, DL-4). service_role only.';
REVOKE ALL ON FUNCTION public.ops_database_size() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_database_size() TO service_role;
DO $c$
DECLARE
  f regprocedure := to_regprocedure('public.ops_database_size()');
BEGIN
  IF f IS NULL THEN
    RAISE EXCEPTION 'lb1_check_failed: the function does not exist';
  END IF;
  IF (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid = f) THEN
    RAISE EXCEPTION 'lb1_check_failed: the function has definer rights';
  END IF;
  IF (SELECT p.proconfig FROM pg_catalog.pg_proc p WHERE p.oid = f) IS DISTINCT FROM ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'lb1_check_failed: the search path setting differs';
  END IF;
  IF (SELECT p.provolatile FROM pg_catalog.pg_proc p WHERE p.oid = f) <> 's'
     OR (SELECT p.prorettype FROM pg_catalog.pg_proc p WHERE p.oid = f) <> 'pg_catalog.int8'::regtype THEN
    RAISE EXCEPTION 'lb1_check_failed: not a STABLE function returning bigint';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p, aclexplode(p.proacl) a WHERE p.oid = f AND a.grantee = 0) THEN
    RAISE EXCEPTION 'lb1_check_failed: PUBLIC may run the function';
  END IF;
  IF has_function_privilege('anon', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'lb1_check_failed: anon may run the function';
  END IF;
  IF has_function_privilege('authenticated', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'lb1_check_failed: authenticated may run the function';
  END IF;
  IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'lb1_check_failed: service_role may not run the function';
  END IF;
END
$c$;
COMMIT;
NOTIFY pgrst, 'reload schema';
