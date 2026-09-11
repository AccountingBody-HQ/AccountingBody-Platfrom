-- ============================================================================
-- 0002_rls_triggers_functions.sql
-- AccountingBody Platform — RLS, triggers, functions, foreign keys
--
-- Captured: 11 September 2026, from 9 read-only pg_catalog/information_schema
-- queries run directly against the live Supabase project's `public` schema,
-- scoped to exactly the 7 AccountingBody-owned tables (Rule 6). Results were
-- pasted back into this session, not queried directly (this Codespace has no
-- database credentials).
--
-- Depends on: 0001_baseline.sql already applied (this file only adds
-- constraints, policies, triggers and functions on top of tables 0001
-- creates).
--
-- LIKE 0001_baseline.sql: this is a documentation/rebuild artifact, not
-- something to run against the live database, which already has all of
-- this. None of CREATE POLICY, CREATE TRIGGER or ALTER TABLE ... ADD
-- CONSTRAINT support "IF NOT EXISTS" in Postgres, so re-running this file
-- against a database that already has these objects will error.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Row Level Security — enable on all 7 tables
-- Query 1 confirmed: rls_enabled = true, rls_forced = false on all 7.
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_providers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_briefs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_seeker_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms_applications        ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- RLS policies
-- Query 2 found exactly 3 policies, on exactly 2 of the 7 tables.
-- job_providers, provider_runs, job_applications, employer_briefs and
-- job_seeker_registrations have RLS enabled with ZERO policies — meaning
-- those 5 tables are reachable only via a role that bypasses RLS
-- (service_role's BYPASSRLS attribute), not via any grant or policy.
--
-- FLAGGED — the two firms_applications policies below are functionally
-- identical (same command, same role, same USING/WITH CHECK). This is very
-- likely accidental duplication from two separate sessions adding "the same"
-- policy under different names rather than a deliberate design. Reproduced
-- faithfully here because the live database genuinely has both — dropping
-- one is a real decision for a human to make in a future migration, not
-- something this file should silently do.
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow public insert on firms_applications"
  ON public.firms_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can insert firms applications"
  ON public.firms_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public read active jobs"
  ON public.jobs
  FOR SELECT
  TO public
  USING (status = 'active');


-- ----------------------------------------------------------------------------
-- Trigger functions
-- Query 3 & 4 found exactly 3 triggers, backed by 3 functions (2 of which
-- do the identical thing under different names — see flag below).
-- ----------------------------------------------------------------------------

-- Sets updated_at on every UPDATE. Attached only to firms_applications.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FLAGGED — functionally identical to handle_updated_at() above, just under
-- a different name, attached only to job_providers. Two functions doing the
-- same one-line job is redundant; worth consolidating to one in a future
-- migration once whoever owns this decides it's safe to repoint the trigger.
-- Not consolidated here — this file documents what exists, not what should.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Sourced verbatim from the live pg_get_functiondef() output for
-- public.jobs_search_vector_trigger — not reconstructed or paraphrased.
CREATE OR REPLACE FUNCTION public.jobs_search_vector_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.company_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.qualifications_required, ' '), '')), 'A');
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
-- NOTE: the trailing ";" above is added — the pasted pg_get_functiondef()
-- output ends at the closing $function$ tag with no statement terminator.
-- Every other CREATE FUNCTION in this file ends with ";"; without one here
-- a SQL parser keeps consuming tokens past this statement (through the
-- comments below) until the next ";", which would silently fold the
-- following CREATE TRIGGER statement into this one. The function body
-- itself (everything between BEGIN and END;) is untouched, word for word.


-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.firms_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_job_providers_updated_at
  BEFORE UPDATE ON public.job_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER jobs_search_vector_update
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_search_vector_trigger();


-- ----------------------------------------------------------------------------
-- CONFIRMED GAP — job_applications.updated_at is unmaintained
--
-- job_applications HAS an updated_at column (0001_baseline.sql, NOT NULL
-- DEFAULT now()) but Query 3/4 found no trigger anywhere targeting
-- job_applications. A Postgres column DEFAULT only fires on INSERT, never
-- UPDATE — so every job_applications row's updated_at is frozen at its
-- creation time forever, despite app code (app/api/roodber8/actions/route.ts
-- and others) updating job_applications.status over a row's lifetime.
-- This is a genuine, confirmed gap in the live schema, not a documentation
-- gap — no DDL is added here to fix it, since that's a live-schema change
-- requiring a deliberate decision (add the same handle_updated_at()-style
-- trigger, or decide the column is vestigial and drop it), not something to
-- silently do inside a migration whose job is to capture what exists.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- Sequences
-- Query 5 returned zero rows. No column in any of the 7 tables is backed by
-- a sequence — every id column is uuid DEFAULT gen_random_uuid(), consistent
-- with 0001_baseline.sql. Nothing to add here.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- Foreign keys
-- Query 7 found 7 FKs total. TWO of them already exist in 0001_baseline.sql
-- verbatim (job_applications_job_id_fkey, employer_briefs_converted_job_id_fkey)
-- and are deliberately NOT repeated here — re-adding a constraint that
-- already exists errors. Only the 5 genuinely new ones are added below.
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs ADD CONSTRAINT jobs_ingestion_run_id_fkey
  FOREIGN KEY (ingestion_run_id) REFERENCES public.provider_runs(id) ON DELETE SET NULL;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_employer_brief_id_fkey
  FOREIGN KEY (employer_brief_id) REFERENCES public.employer_briefs(id) ON DELETE SET NULL;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_ai_duplicate_of_fkey
  FOREIGN KEY (ai_duplicate_of) REFERENCES public.jobs(id) ON DELETE SET NULL;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.job_providers(id) ON DELETE SET NULL;

-- This settles the open question raised in tmp-audit/backup-restore-scope.md:
-- the FK genuinely exists live. 0001_baseline.sql simply didn't capture it —
-- the live schema was never missing it.
ALTER TABLE public.provider_runs ADD CONSTRAINT provider_runs_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES public.job_providers(id) ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- Grants
-- Query 6: anon, authenticated and service_role all show NO across every
-- privilege type, on all 7 tables — only the table owner (postgres) has
-- grants. Confirmed against the codebase, not assumed: every Supabase client
-- construction in this repo (100+ call sites, grepped exhaustively) uses
-- SUPABASE_SECRET_KEY — the service-role key — and none uses an anon/
-- publishable key. service_role bypasses RLS via a Postgres role attribute
-- (BYPASSRLS), not via grants, so it needing no explicit table grants is
-- expected. Since nothing in this app ever authenticates as anon or
-- authenticated against Supabase directly, anon/authenticated having no
-- table grants here is consistent with how this app actually works — not a
-- red flag for THIS app. Nothing to GRANT here as a result.
--
-- OPEN QUESTION, not resolved by the 9 queries run: whether this "zero
-- grants" state is the schema's actual configuration, or whether Supabase's
-- project-level default privileges (ALTER DEFAULT PRIVILEGES, set once at
-- project creation, typically granting broad table access to anon/
-- authenticated/service_role on every new table) would auto-grant something
-- to a freshly CREATE TABLE'd version of these 7 tables in a different
-- project — which would mean matching today's "zero grants" state on a
-- rebuild might require explicit REVOKE statements this file doesn't have.
-- Needs a follow-up query against pg_default_acl for schema `public` before
-- this can be answered either way — deliberately not guessed here.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- Extensions — informational only, NOT reproduced as CREATE EXTENSION here
--
-- Query 8, for context (installed in the shared database, not scoped to our
-- 7 tables — extensions are database-wide, and none of the 7 tables use a
-- non-core type, so none of these are actually required by our schema):
--   pg_cron 1.6.4, pg_stat_statements 1.11, pg_trgm 1.6, pgcrypto 1.3,
--   plpgsql 1.0, supabase_vault 0.3.1, unaccent 1.1, uuid-ossp 1.1,
--   vector 0.8.0
--
-- Deliberately not turned into CREATE EXTENSION statements: enabling/
-- disabling extensions affects the entire shared database, not just these 7
-- tables, and is out of this migration's authority per Rule 6. gen_random_uuid()
-- (used by every id column's DEFAULT) is core Postgres since v13 and needs
-- no extension regardless.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- Comments
-- Query 9 returned zero rows — no COMMENT ON TABLE/COLUMN exists in the live
-- database for any of the 7 tables. Nothing to add here.
-- ----------------------------------------------------------------------------
