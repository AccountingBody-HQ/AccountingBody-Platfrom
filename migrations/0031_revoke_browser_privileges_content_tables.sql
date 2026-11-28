-- 0031_revoke_browser_privileges_content_tables.sql
-- 28 Nov 2026 (PRIV-9; owner decisions D352, D353 (6), D362). PostgreSQL 17.
--
-- WHY: the site reads and writes the fourteen tables below only on the
-- server, with the secret key (lib/supabase-server.ts). No code uses the
-- browser (publishable) key. The table rights the roles anon and
-- authenticated hold on these tables are not needed, so they are removed,
-- and tables that postgres creates later no longer give those roles any
-- right by default. Access stays with the server only (UK GDPR Art. 32,
-- security of processing). Nothing changes for visitors. Together with
-- 0030 this leaves anon and authenticated with no table right in the
-- public schema.
--
-- WHAT: one REVOKE ALL of the table rights of anon and authenticated on
-- articles, book_publications, course_chapters, course_lesson_articles,
-- course_lessons, courses, job_providers, jobs, provider_errors,
-- provider_runs, question_cases, question_sets, questions and
-- social_posts; and one change of the default rights postgres gives to
-- new tables in the public schema (anon and authenticated removed).
--
-- WHAT IT DOES NOT DO: no row, column, table, policy, function, sequence
-- or row level security change; service_role, postgres and every other
-- table keep their rights; the default rights of other roles (for example
-- supabase_admin) and the defaults for sequences and functions are not
-- changed.
--
-- RUN: once, as postgres, through stdin (docs/AGENT-RULES.md; never psql -f
-- on a migration file), after a fresh backup. One transaction: the first
-- guard stops it (nothing changed) if a table is missing or not owned by
-- postgres, has column rights for those roles, holds a right other than the
-- seven expected ones for those roles or any right for PUBLIC, holds a right
-- given by another role, if another public table still gives those roles or
-- PUBLIC a right, if postgres has global default rights for them, or if the
-- fourteen tables hold none (already applied). Row level security may be on
-- or off on these tables; it is recorded, not changed. The last check rolls
-- everything back if any table right of those roles remains anywhere in the
-- public schema, the default rights of postgres still name them, the row
-- level security count, the number of policies or the other roles' default
-- rights changed.
--
-- UNDO (owner decision only; puts back the rights found before):
--   GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, UPDATE ON TABLE
--     public.articles, public.book_publications, public.course_chapters,
--     public.course_lesson_articles, public.course_lessons, public.courses,
--     public.job_providers, public.jobs, public.provider_errors,
--     public.provider_runs, public.question_cases, public.question_sets,
--     public.questions, public.social_posts
--   TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT MAINTAIN, REFERENCES, TRIGGER ON TABLES TO anon, authenticated;

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE pv_scope (t text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO pv_scope (t) VALUES
  ('articles'), ('book_publications'), ('course_chapters'),
  ('course_lesson_articles'), ('course_lessons'), ('courses'),
  ('job_providers'), ('jobs'), ('provider_errors'), ('provider_runs'),
  ('question_cases'), ('question_sets'), ('questions'), ('social_posts');

CREATE TEMP TABLE pv_before (grants int, defacl int, rls_on int, policies int, other_defacl int) ON COMMIT DROP;

DO $guard$
DECLARE
  browser oid[] := ARRAY['anon'::regrole::oid, 'authenticated'::regrole::oid];
  missing int;
  not_owned int;
  col_rights int;
  odd_rights int;
  other_grantor int;
  rest_rights int;
  global_defacl int;
  n_grants int;
  n_defacl int;
  n_rls int;
  n_policies int;
  n_other_defacl int;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'pv_stop: expected to run as postgres - nothing was changed';
  END IF;

  SELECT count(*) INTO missing FROM pv_scope s
  WHERE to_regclass('public.' || quote_ident(s.t)) IS NULL;
  IF missing <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % of the 14 tables not found - nothing was changed', missing;
  END IF;

  SELECT count(*) INTO not_owned FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  WHERE pg_get_userbyid(c.relowner) <> 'postgres';
  IF not_owned <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % of the 14 tables not owned by postgres - nothing was changed', not_owned;
  END IF;

  SELECT count(*) INTO col_rights FROM pv_scope s
  JOIN pg_attribute a ON a.attrelid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(a.attacl) x
  WHERE a.attacl IS NOT NULL AND (x.grantee = ANY (browser) OR x.grantee = 0);
  IF col_rights <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % column rights found for anon, authenticated or PUBLIC - nothing was changed', col_rights;
  END IF;

  SELECT count(*) INTO odd_rights FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE (x.grantee = ANY (browser)
         AND x.privilege_type NOT IN ('DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'UPDATE'))
     OR x.grantee = 0;
  IF odd_rights <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % unexpected rights (other than the seven, or for PUBLIC) - nothing was changed', odd_rights;
  END IF;

  SELECT count(*) INTO other_grantor FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE x.grantee = ANY (browser) AND x.grantor <> 'postgres'::regrole::oid;
  IF other_grantor <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % rights were given by a role other than postgres - nothing was changed', other_grantor;
  END IF;

  SELECT count(*) INTO rest_rights FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE c.relkind IN ('r', 'p') AND c.relacl IS NOT NULL
    AND c.relname NOT IN (SELECT t FROM pv_scope)
    AND (x.grantee = ANY (browser) OR x.grantee = 0);
  IF rest_rights <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % rights for anon, authenticated or PUBLIC on other public tables - nothing was changed', rest_rights;
  END IF;

  SELECT count(*) INTO global_defacl FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE d.defaclrole = 'postgres'::regrole::oid AND d.defaclnamespace = 0
    AND d.defaclobjtype = 'r' AND (x.grantee = ANY (browser) OR x.grantee = 0);
  IF global_defacl <> 0 THEN
    RAISE EXCEPTION 'pv_stop: postgres has % global default table rights for anon, authenticated or PUBLIC - nothing was changed', global_defacl;
  END IF;

  SELECT count(*) INTO n_grants FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE x.grantee = ANY (browser);
  IF n_grants = 0 THEN
    RAISE EXCEPTION 'pv_stop: anon and authenticated hold no rights on the 14 tables (already applied?) - nothing was changed';
  END IF;

  SELECT count(*) INTO n_defacl FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE d.defaclrole = 'postgres'::regrole::oid AND d.defaclnamespace = 'public'::regnamespace::oid
    AND d.defaclobjtype = 'r' AND (x.grantee = ANY (browser) OR x.grantee = 0);

  SELECT count(*) INTO n_rls FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  WHERE c.relrowsecurity;

  SELECT count(*) INTO n_policies FROM pg_policies p JOIN pv_scope s ON s.t = p.tablename
  WHERE p.schemaname = 'public';

  SELECT count(*) INTO n_other_defacl FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE d.defaclrole <> 'postgres'::regrole::oid;

  INSERT INTO pv_before VALUES (n_grants, n_defacl, n_rls, n_policies, n_other_defacl);
END
$guard$;

REVOKE ALL ON TABLE
  public.articles, public.book_publications, public.course_chapters,
  public.course_lesson_articles, public.course_lessons, public.courses,
  public.job_providers, public.jobs, public.provider_errors,
  public.provider_runs, public.question_cases, public.question_sets,
  public.questions, public.social_posts
FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

DO $check$
DECLARE
  browser oid[] := ARRAY['anon'::regrole::oid, 'authenticated'::regrole::oid];
  left_rights int;
  left_effective int;
  left_defacl int;
  n_rls int;
  n_policies int;
  n_other_defacl int;
BEGIN
  SELECT count(*) INTO left_rights FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE c.relkind IN ('r', 'p') AND c.relacl IS NOT NULL
    AND (x.grantee = ANY (browser) OR x.grantee = 0);
  IF left_rights <> 0 THEN
    RAISE EXCEPTION 'pv_check_failed: % table rights remain for anon, authenticated or PUBLIC in the public schema - rolled back', left_rights;
  END IF;

  SELECT count(*) INTO left_effective FROM pv_scope s
  CROSS JOIN (VALUES ('anon'), ('authenticated')) r(role)
  CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
    || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) p(priv)
  WHERE has_table_privilege(r.role, 'public.' || quote_ident(s.t), p.priv);
  IF left_effective <> 0 THEN
    RAISE EXCEPTION 'pv_check_failed: % effective rights remain for anon or authenticated - rolled back', left_effective;
  END IF;

  SELECT count(*) INTO left_defacl FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE d.defaclrole = 'postgres'::regrole::oid
    AND (d.defaclnamespace = 'public'::regnamespace::oid OR d.defaclnamespace = 0)
    AND d.defaclobjtype = 'r' AND (x.grantee = ANY (browser) OR x.grantee = 0);
  IF left_defacl <> 0 THEN
    RAISE EXCEPTION 'pv_check_failed: % default table rights of postgres still name anon, authenticated or PUBLIC - rolled back', left_defacl;
  END IF;

  SELECT count(*) INTO n_rls FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  WHERE c.relrowsecurity;
  IF n_rls <> (SELECT rls_on FROM pv_before) THEN
    RAISE EXCEPTION 'pv_check_failed: the row level security count changed - rolled back';
  END IF;

  SELECT count(*) INTO n_policies FROM pg_policies p JOIN pv_scope s ON s.t = p.tablename
  WHERE p.schemaname = 'public';
  IF n_policies <> (SELECT policies FROM pv_before) THEN
    RAISE EXCEPTION 'pv_check_failed: the number of policies changed - rolled back';
  END IF;

  SELECT count(*) INTO n_other_defacl FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE d.defaclrole <> 'postgres'::regrole::oid;
  IF n_other_defacl <> (SELECT other_defacl FROM pv_before) THEN
    RAISE EXCEPTION 'pv_check_failed: the default rights of another role changed - rolled back';
  END IF;
END
$check$;

SELECT 'pv|revoked|tables|14|roles|2|grants_before|' || (SELECT grants FROM pv_before)
  || '|grants_after|0|effective_after|0|defacl_before|' || (SELECT defacl FROM pv_before)
  || '|defacl_after|0|rls_on|' || (SELECT rls_on FROM pv_before)
  || '|policies|' || (SELECT policies FROM pv_before)
  || '|public_schema_browser_table_rights|0';

COMMIT;
