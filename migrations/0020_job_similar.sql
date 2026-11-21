-- ============================================================================
-- 0020_job_similar.sql
-- Date: 21 Nov 2026
--
-- Record only. Applied 21 Nov 2026, 02:18:12 UTC (D279), from the Codespace
-- with psql after backup run 44854364996, as one transaction. The file stops
-- itself if run again: its first guard raises when the table exists.
--
-- What: the empty table public.job_similar, one saved "Similar current
-- roles" list per (job, site): job_id, platform ('ab' or 'et'), up to 6
-- similar job ids (never the job itself, never NULL) and computed_at. Row
-- level security on with no policy; only service_role may read and write.
--
-- Why (D51/M16, design D277): job pages read a list computed once a night
-- instead of running text searches on every page view. Written only by
-- /api/cron/similar-jobs; read by getSimilarJobs in lib/jobs.ts.
--
-- Undo (owner decision only):
-- DROP TABLE IF EXISTS public.job_similar;
--
-- The applied script follows exactly as it was run.
-- sjdb.sql - SJ-DB (owner D278, design D277): create the EMPTY table public.job_similar (migration 0020). One transaction; it checks its own result and rolls back if anything is not exactly as designed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $g$
BEGIN
  IF to_regclass('public.job_similar') IS NOT NULL THEN
    RAISE EXCEPTION 'sjdb_stop: public.job_similar already exists - nothing was changed';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'sjdb_stop: expected to run as postgres - nothing was changed';
  END IF;
END
$g$;
CREATE TABLE public.job_similar (
  job_id      uuid        NOT NULL,
  platform    text        NOT NULL,
  similar_ids uuid[]      NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_similar_pkey PRIMARY KEY (job_id, platform),
  CONSTRAINT job_similar_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT job_similar_platform_check CHECK (platform IN ('ab', 'et')),
  CONSTRAINT job_similar_ids_check CHECK (
    cardinality(similar_ids) <= 6
    AND array_position(similar_ids, job_id) IS NULL
    AND array_position(similar_ids, NULL) IS NULL
  )
);
COMMENT ON TABLE public.job_similar IS
  'AccountingBody: saved similar-jobs lists (D51/M16, D277). Written only by /api/cron/similar-jobs.';
ALTER TABLE public.job_similar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_similar FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_similar TO service_role;
DO $c$
DECLARE
  t oid := 'public.job_similar'::regclass;
  sr text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t) THEN
    RAISE EXCEPTION 'sjdb_check_failed: row level security is off';
  END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = t) <> 'postgres' THEN
    RAISE EXCEPTION 'sjdb_check_failed: owner is not postgres';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c, aclexplode(c.relacl) a
             WHERE c.oid = t AND a.grantee <> c.relowner
               AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) <> 'service_role')) THEN
    RAISE EXCEPTION 'sjdb_check_failed: a role other than the owner and service_role holds a right';
  END IF;
  SELECT string_agg(a.privilege_type, ',' ORDER BY a.privilege_type) INTO sr
    FROM pg_class c, aclexplode(c.relacl) a
   WHERE c.oid = t AND a.grantee <> 0 AND pg_get_userbyid(a.grantee) = 'service_role';
  IF sr IS DISTINCT FROM 'DELETE,INSERT,SELECT,UPDATE' THEN
    RAISE EXCEPTION 'sjdb_check_failed: service_role rights are %', coalesce(sr, 'none');
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid = t) <> 0 THEN
    RAISE EXCEPTION 'sjdb_check_failed: unexpected policy';
  END IF;
  IF (SELECT string_agg(conname || ':' || contype::text, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = t)
     IS DISTINCT FROM 'job_similar_ids_check:c,job_similar_job_id_fkey:f,job_similar_pkey:p,job_similar_platform_check:c' THEN
    RAISE EXCEPTION 'sjdb_check_failed: constraints differ';
  END IF;
  IF (SELECT confdeltype FROM pg_constraint WHERE conrelid = t AND conname = 'job_similar_job_id_fkey')::text <> 'c' THEN
    RAISE EXCEPTION 'sjdb_check_failed: foreign key is not ON DELETE CASCADE';
  END IF;
  IF (SELECT count(*) FROM public.job_similar) <> 0 THEN
    RAISE EXCEPTION 'sjdb_check_failed: table is not empty';
  END IF;
END
$c$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'sjdb|committed|' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS');
