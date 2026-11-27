-- 0030_revoke_unused_browser_privileges.sql
-- 27 Nov 2026 (PRIV-7; owner decisions D352, D353 (6), D359). PostgreSQL 17.
--
-- WHY: the site reads and writes the seven tables below only on the server,
-- with the secret key (lib/supabase-server.ts). No code uses the browser
-- (publishable) key. The table rights the roles anon and authenticated hold
-- on these tables are not needed, so they are removed: access to these
-- tables stays with the server only (UK GDPR Art. 32, security of
-- processing). Nothing changes for visitors.
--
-- WHAT: one REVOKE ALL of the table rights of anon and authenticated on
-- contact_submissions, email_subscribers, employer_briefs,
-- firms_applications, help_requests, job_applications and
-- job_seeker_registrations.
--
-- WHAT IT DOES NOT DO: no row, column, table, policy, function or row level
-- security change; service_role, postgres and every other table keep their
-- rights; default privileges for future tables are not changed.
--
-- RUN: once, as postgres, through stdin (docs/AGENT-RULES.md; never psql -f
-- on a migration file), after a fresh backup. One transaction: the first
-- guard stops it (nothing changed) if a table is missing, is not owned by
-- postgres, has row level security off, has column rights for those roles,
-- holds a right other than the seven expected ones for those roles, or holds
-- none (already applied); the last check rolls everything back if any
-- right of those roles remains, row level security is off, or the number
-- of policies changed.
--
-- UNDO (owner decision only; puts back the seven rights found before):
--   GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, UPDATE ON TABLE
--     public.contact_submissions, public.email_subscribers,
--     public.employer_briefs, public.firms_applications,
--     public.help_requests, public.job_applications,
--     public.job_seeker_registrations
--   TO anon, authenticated;

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE pv_scope (t text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO pv_scope (t) VALUES
  ('contact_submissions'), ('email_subscribers'), ('employer_briefs'),
  ('firms_applications'), ('help_requests'), ('job_applications'),
  ('job_seeker_registrations');

CREATE TEMP TABLE pv_before (grants int, policies int) ON COMMIT DROP;

DO $guard$
DECLARE
  missing int;
  not_owned int;
  rls_off int;
  col_rights int;
  odd_rights int;
  n_grants int;
  n_policies int;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'pv_stop: expected to run as postgres - nothing was changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'pv_stop: role anon or authenticated not found - nothing was changed';
  END IF;

  SELECT count(*) INTO missing FROM pv_scope s
  WHERE to_regclass('public.' || quote_ident(s.t)) IS NULL;
  IF missing <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % of the 7 tables not found - nothing was changed', missing;
  END IF;

  SELECT count(*) INTO not_owned FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  WHERE pg_get_userbyid(c.relowner) <> 'postgres';
  IF not_owned <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % of the 7 tables not owned by postgres - nothing was changed', not_owned;
  END IF;

  SELECT count(*) INTO rls_off FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  WHERE NOT c.relrowsecurity;
  IF rls_off <> 0 THEN
    RAISE EXCEPTION 'pv_stop: row level security is off on % of the 7 tables - nothing was changed', rls_off;
  END IF;

  SELECT count(*) INTO col_rights FROM pv_scope s
  JOIN pg_attribute a ON a.attrelid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(a.attacl) x
  WHERE a.attacl IS NOT NULL
    AND x.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid, 0);
  IF col_rights <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % column rights found for anon, authenticated or PUBLIC - nothing was changed', col_rights;
  END IF;

  SELECT count(*) INTO odd_rights FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE (x.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid)
         AND x.privilege_type NOT IN ('DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'UPDATE'))
     OR x.grantee = 0;
  IF odd_rights <> 0 THEN
    RAISE EXCEPTION 'pv_stop: % unexpected rights (other than the seven, or for PUBLIC) - nothing was changed', odd_rights;
  END IF;

  SELECT count(*) INTO n_grants FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE x.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid);
  IF n_grants = 0 THEN
    RAISE EXCEPTION 'pv_stop: anon and authenticated hold no rights on the 7 tables (already applied?) - nothing was changed';
  END IF;

  SELECT count(*) INTO n_policies FROM pg_policies p JOIN pv_scope s ON s.t = p.tablename
  WHERE p.schemaname = 'public';

  INSERT INTO pv_before VALUES (n_grants, n_policies);
END
$guard$;

REVOKE ALL ON TABLE
  public.contact_submissions, public.email_subscribers,
  public.employer_briefs, public.firms_applications,
  public.help_requests, public.job_applications,
  public.job_seeker_registrations
FROM anon, authenticated;

DO $check$
DECLARE
  left_rights int;
  left_effective int;
  rls_off int;
  n_policies int;
BEGIN
  SELECT count(*) INTO left_rights FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  CROSS JOIN LATERAL aclexplode(c.relacl) x
  WHERE x.grantee IN ('anon'::regrole::oid, 'authenticated'::regrole::oid, 0);
  IF left_rights <> 0 THEN
    RAISE EXCEPTION 'pv_check_failed: % rights remain for anon, authenticated or PUBLIC - rolled back', left_rights;
  END IF;

  SELECT count(*) INTO left_effective FROM pv_scope s
  CROSS JOIN (VALUES ('anon'), ('authenticated')) r(role)
  CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
    || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) p(priv)
  WHERE has_table_privilege(r.role, 'public.' || quote_ident(s.t), p.priv);
  IF left_effective <> 0 THEN
    RAISE EXCEPTION 'pv_check_failed: % effective rights remain for anon or authenticated - rolled back', left_effective;
  END IF;

  SELECT count(*) INTO rls_off FROM pv_scope s
  JOIN pg_class c ON c.oid = to_regclass('public.' || quote_ident(s.t))
  WHERE NOT c.relrowsecurity;
  IF rls_off <> 0 THEN
    RAISE EXCEPTION 'pv_check_failed: row level security is off on % tables - rolled back', rls_off;
  END IF;

  SELECT count(*) INTO n_policies FROM pg_policies p JOIN pv_scope s ON s.t = p.tablename
  WHERE p.schemaname = 'public';
  IF n_policies <> (SELECT policies FROM pv_before) THEN
    RAISE EXCEPTION 'pv_check_failed: the number of policies changed - rolled back';
  END IF;
END
$check$;

SELECT 'pv|revoked|tables|7|roles|2|grants_before|' || (SELECT grants FROM pv_before)
  || '|grants_after|0|effective_after|0|rls|on|policies|' || (SELECT policies FROM pv_before);

COMMIT;
