-- ============================================================================
-- 0001_baseline.sql
-- AccountingBody Platform — baseline schema snapshot
--
-- Captured: 11 September 2026 (Session 6)
-- Source:   live Supabase project sydiwnburwxutuuvkcjt, schema `public`,
--           exported via information_schema.columns / pg_constraint / pg_indexes
--
-- WHY THIS FILE EXISTS
-- Until this file, the platform had NO migration files at all. Every schema
-- change across Sessions 2-6 was applied by hand in the Supabase SQL editor,
-- which meant the database's definition existed in exactly one place: inside
-- Supabase. It could not be rebuilt, diffed, reviewed, or reproduced in a
-- staging environment. This file ends that.
--
-- SCOPE — READ BEFORE RUNNING ANYTHING
-- The `public` schema is SHARED between AccountingBody, EthioTax, GPE and
-- HagerLand. It contains 50+ tables, most of which this platform does not own
-- (courses, articles, countries, exchange_rates, embeddings_index,
-- platform_memberships, ai_conversations, and others). Several carry CHECK
-- constraints enumerating 'gpe' / 'ab' / 'et' / 'hrlake' platform values,
-- so the coupling runs deeper than schema separation alone.
--
-- This baseline therefore covers ONLY the seven tables the AccountingBody
-- ingestion and applications system owns:
--     jobs, job_providers, provider_runs, job_applications,
--     employer_briefs, job_seeker_registrations, firms_applications
--
-- Rule 6 still stands: the HagerLand `hrlake` / `et.*` schemas are off-limits.
-- This file must never be extended to cover another product's tables.
--
-- HOW TO USE
-- This is a DOCUMENTATION AND REBUILD baseline, not something to run against
-- the live database. The live database already has all of this. Running it
-- there is unnecessary and, without IF NOT EXISTS guards on every statement,
-- potentially destructive. It exists so that:
--   1. the schema is reviewable in code review, in the repo, in git history;
--   2. a fresh environment (staging, local, disaster recovery) can be built;
--   3. future changes have somewhere to live as numbered migrations.
--
-- GOING FORWARD — THE RULE THIS FILE ESTABLISHES
-- No further schema change is applied by hand only. Every change gets a
-- numbered file in this directory (0002_, 0003_, ...) containing the exact
-- DDL that was run, committed in the same commit as the code that depends
-- on it. Applying it in the Supabase editor is still fine — but the file is
-- not optional.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- jobs  (73 columns)
--
-- The central table. Holds both provider-ingested listings and direct
-- employer posts, distinguished by `source`.
--
-- KNOWN QUIRK — employer_email / employer_name / employer_company are
-- NOT NULL with no default, but provider-ingested jobs have no employer
-- contact information (Adzuna, Jobicy and Remotive do not supply one). The
-- ingestion path therefore writes placeholder values into all three on every
-- ingested row. These columns do NOT contain real contact data for anything
-- where source <> 'employer'. Any future feature that reads them (alerts,
-- employer contact flows, exports) must filter on source first.
--
-- KNOWN QUIRK — `category` is populated on roughly 29% of rows despite
-- NormalisedJob having no such field and normalise() never setting it. The
-- working theory (unconfirmed as of Session 6) is that these are legacy rows
-- predating the current ingestion architecture. Open item.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id                          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  source                      text                     NOT NULL DEFAULT 'employer'::text,
  source_job_id               text,
  source_url                  text,
  platform                    text[]                   NOT NULL DEFAULT ARRAY['ab'::text],
  canonical_owner             text                     NOT NULL DEFAULT 'accountingbody'::text,
  title                       text                     NOT NULL,
  slug                        text                     NOT NULL,
  company_name                text                     NOT NULL,
  company_domain              text,
  description                 text                     NOT NULL,
  excerpt                     text,
  location_text               text                     NOT NULL,
  location_city               text,
  location_country            text,
  location_remote             boolean                  NOT NULL DEFAULT false,
  salary_text                 text,
  salary_min                  integer,
  salary_max                  integer,
  salary_currency             text                              DEFAULT 'GBP'::text,
  employment_type             text,
  seniority_level             text,
  category                    text,
  qualifications_required     text[]                            DEFAULT ARRAY[]::text[],
  skills_required             text[]                            DEFAULT ARRAY[]::text[],
  skills_nice_to_have         text[]                            DEFAULT ARRAY[]::text[],
  status                      text                     NOT NULL DEFAULT 'pending_approval'::text,
  published_at                timestamptz,
  expires_at                  timestamptz,
  closed_at                   timestamptz,
  rejection_reason            text,
  payment_status              text                     NOT NULL DEFAULT 'unpaid'::text,
  stripe_payment_intent_id    text,
  stripe_session_id           text,
  price_paid_pence            integer,
  employer_brief_id           uuid,
  employer_email              text                     NOT NULL,
  employer_name               text                     NOT NULL,
  employer_company            text                     NOT NULL,
  employer_phone              text,
  apply_method                text                     NOT NULL DEFAULT 'external'::text,
  application_url             text,
  application_email           text,
  source_score                numeric                  NOT NULL DEFAULT 1.0,
  quality_score               numeric                  NOT NULL DEFAULT 0.0,
  impression_count            integer                  NOT NULL DEFAULT 0,
  click_count                 integer                  NOT NULL DEFAULT 0,
  application_count           integer                  NOT NULL DEFAULT 0,
  ctr                         numeric                  NOT NULL DEFAULT 0.5,
  search_vector               tsvector,
  raw_source_data             jsonb,
  ai_excerpt                  text,
  ai_qualifications_extracted text[],
  ai_skills_extracted         text[],
  ai_seniority_extracted      text,
  ai_location_normalised      text,
  ai_salary_normalised        jsonb,
  ai_quality_score            numeric,
  ai_is_duplicate             boolean                           DEFAULT false,
  ai_duplicate_of             uuid,
  ai_enriched_at              timestamptz,
  dedup_hash                  text,
  admin_notes                 text,
  is_featured                 boolean                  NOT NULL DEFAULT false,
  created_at                  timestamptz              NOT NULL DEFAULT now(),
  updated_at                  timestamptz              NOT NULL DEFAULT now(),
  manage_token                text,
  provider_id                 uuid,
  ingestion_run_id            uuid,
  normalisation_version       integer                  NOT NULL DEFAULT 1,
  quality_flags               text[]                            DEFAULT '{}'::text[],
  data_completeness           numeric,
  salary_is_predicted         boolean,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_slug_key UNIQUE (slug),
  CONSTRAINT jobs_manage_token_key UNIQUE (manage_token)
);

-- jobs CHECK constraints
ALTER TABLE public.jobs ADD CONSTRAINT jobs_source_check
  CHECK (source = ANY (ARRAY['employer','careerjet','adzuna','scrape','manual',
                             'jobicy','reed','indeed','remotive','talent',
                             'generic','generic-rest']::text[]));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_employment_type_check
  CHECK (employment_type = ANY (ARRAY['permanent','contract','temporary',
                                      'part_time','internship']::text[]));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_seniority_check
  CHECK (seniority_level = ANY (ARRAY['junior','mid','senior','executive',
                                      'director']::text[]));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status = ANY (ARRAY['draft','pending_payment','pending_approval',
                             'active','expired','closed','rejected']::text[]));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_apply_method_check
  CHECK (apply_method = ANY (ARRAY['platform','external','email']::text[]));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_payment_status_check
  CHECK (payment_status = ANY (ARRAY['unpaid','paid','free','refunded']::text[]));

-- jobs indexes
-- NOTE: idx_jobs_dedup is a PARTIAL unique index. supabase-js upsert against
-- it fails with 42P10 — use plain insert() and treat 23505 as deduplication
-- (Rule 98). The partial predicate excluding rejected rows is deliberate: a
-- rejected job can be re-ingested later if the taxonomy improves (Rule 105).
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedup ON public.jobs
  USING btree (dedup_hash) WHERE (dedup_hash IS NOT NULL AND status <> 'rejected'::text);
CREATE INDEX IF NOT EXISTS idx_jobs_active_platform ON public.jobs
  USING btree (status, published_at DESC) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON public.jobs
  USING btree (expires_at) WHERE (status = 'active'::text AND expires_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON public.jobs
  USING btree (location_country, location_city) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_jobs_payment ON public.jobs
  USING btree (payment_status, status);
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON public.jobs USING gin (platform);
CREATE INDEX IF NOT EXISTS idx_jobs_provider_id ON public.jobs USING btree (provider_id);
CREATE INDEX IF NOT EXISTS idx_jobs_search_vector ON public.jobs USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON public.jobs USING btree (source, status);
CREATE INDEX IF NOT EXISTS idx_jobs_employer_email ON public.jobs USING btree (employer_email);
CREATE INDEX IF NOT EXISTS idx_jobs_stripe_session ON public.jobs
  USING btree (stripe_session_id) WHERE (stripe_session_id IS NOT NULL);


-- ----------------------------------------------------------------------------
-- job_providers  (55 columns)
--
-- Provider registry. Rule 82: provider knowledge lives HERE, never hardcoded
-- in TypeScript. Phase B's onboarding UI depends on this holding completely.
--
-- field_mapping is NOT NULL DEFAULT '{}'::jsonb. The default is sane — but a
-- caller that explicitly passes null overrides it and violates the constraint.
-- That was a live bug in the create route, fixed in commit 81bb930.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_providers (
  id                          uuid          NOT NULL DEFAULT gen_random_uuid(),
  slug                        text          NOT NULL,
  name                        text          NOT NULL,
  provider_type               text          NOT NULL DEFAULT 'api_rest'::text,
  adapter_key                 text          NOT NULL DEFAULT 'generic-rest'::text,
  status                      text          NOT NULL DEFAULT 'paused'::text,
  priority                    integer       NOT NULL DEFAULT 50,
  is_affiliate                boolean       NOT NULL DEFAULT false,
  data_ownership              text                   DEFAULT 'full'::text,
  country_codes               text[]                 DEFAULT '{}'::text[],
  regions                     text[]                 DEFAULT '{}'::text[],
  platform_tags               text[]                 DEFAULT '{ab}'::text[],
  source_score                numeric       NOT NULL DEFAULT 0.50,
  keywords                    text[]                 DEFAULT '{}'::text[],
  category_filter             text,
  base_url                    text,
  request_config              jsonb                  DEFAULT '{}'::jsonb,
  auth_type                   text          NOT NULL DEFAULT 'none'::text,
  auth_config                 jsonb                  DEFAULT '{}'::jsonb,
  field_mapping               jsonb         NOT NULL DEFAULT '{}'::jsonb,
  response_path               text,
  pagination_style            text                   DEFAULT 'page_number'::text,
  max_pages_per_run           integer       NOT NULL DEFAULT 1,
  fetch_interval_minutes      integer       NOT NULL DEFAULT 1440,
  fetch_offset_minutes        integer       NOT NULL DEFAULT 0,
  last_fetched_at             timestamptz,
  next_fetch_at               timestamptz,
  rate_limit_rpm              integer,
  rate_limit_daily            integer,
  requests_today              integer       NOT NULL DEFAULT 0,
  retry_after_seconds         integer,
  health_status               text          NOT NULL DEFAULT 'unknown'::text,
  consecutive_failures        integer       NOT NULL DEFAULT 0,
  last_success_at             timestamptz,
  last_error_at               timestamptz,
  last_error_message          text,
  last_error_code             text,
  avg_response_ms             integer,
  total_jobs_ingested         bigint        NOT NULL DEFAULT 0,
  jobs_last_run               integer       NOT NULL DEFAULT 0,
  jobs_today                  integer       NOT NULL DEFAULT 0,
  dedup_rate_last_run         numeric,
  notes                       text,
  commercial_terms            text                   DEFAULT 'free'::text,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  source_name                 text,
  keyword_cursor              integer                DEFAULT 0,
  enforce_relevance           boolean                DEFAULT false,
  data_quality_status         text                   DEFAULT 'unknown'::text,
  last_relevance_rate         numeric,
  last_avg_description_length integer,
  data_quality_checked_at     timestamptz,
  last_alert_state            text,
  last_alert_sent_at          timestamptz,
  CONSTRAINT job_providers_pkey PRIMARY KEY (id),
  CONSTRAINT job_providers_slug_key UNIQUE (slug)
);

ALTER TABLE public.job_providers ADD CONSTRAINT job_providers_data_quality_status_check
  CHECK (data_quality_status = ANY (ARRAY['good','warning','poor','unknown']::text[]));


-- ----------------------------------------------------------------------------
-- provider_runs  (20 columns)
--
-- One row per ingestion attempt. `trigger` defaults to 'cron'; the manual
-- admin trigger passes ?trigger=manual (Session 5, commit 98f8b4c).
-- Runs left in status='running' longer than 10 minutes are reaped by
-- reapStaleRuns() — otherwise they permanently block the provider.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_runs (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid(),
  provider_id            uuid        NOT NULL,
  provider_slug          text        NOT NULL,
  started_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,
  duration_ms            integer,
  status                 text        NOT NULL DEFAULT 'running'::text,
  trigger                text                 DEFAULT 'cron'::text,
  jobs_fetched           integer     NOT NULL DEFAULT 0,
  jobs_inserted          integer     NOT NULL DEFAULT 0,
  jobs_deduplicated      integer     NOT NULL DEFAULT 0,
  jobs_rejected          integer     NOT NULL DEFAULT 0,
  pages_fetched          integer     NOT NULL DEFAULT 0,
  response_ms_avg        integer,
  error_message          text,
  error_code             text,
  raw_response_sample    jsonb,
  relevance_rate         numeric,
  avg_description_length integer,
  field_coverage         jsonb,
  CONSTRAINT provider_runs_pkey PRIMARY KEY (id)
);


-- ----------------------------------------------------------------------------
-- job_applications  (12 columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_applications (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  job_id          uuid        NOT NULL,
  applicant_email text        NOT NULL,
  applicant_name  text        NOT NULL,
  applicant_phone text,
  cover_letter    text,
  cv_url          text,
  status          text        NOT NULL DEFAULT 'submitted'::text,
  platform        text        NOT NULL DEFAULT 'ab'::text,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_applications_pkey PRIMARY KEY (id),
  CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id)
    REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT job_applications_status_check
    CHECK (status = ANY (ARRAY['submitted','reviewing','shortlisted',
                               'rejected','hired']::text[]))
);

CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications
  USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON public.job_applications
  USING btree (applicant_email);


-- ----------------------------------------------------------------------------
-- employer_briefs  (23 columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employer_briefs (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at         timestamptz          DEFAULT now(),
  platform           text        NOT NULL DEFAULT 'ab'::text,
  company_name       text        NOT NULL,
  contact_name       text        NOT NULL,
  contact_email      text        NOT NULL,
  contact_phone      text,
  role_title         text        NOT NULL,
  contract_type      text        NOT NULL,
  location           text        NOT NULL,
  salary_budget      text,
  start_date         text,
  jurisdiction       text,
  role_description   text        NOT NULL,
  must_haves         text,
  nice_to_haves      text,
  status             text        NOT NULL DEFAULT 'pending'::text,
  admin_notes        text,
  reviewed_at        timestamptz,
  confirmation_token text,
  reference_number   text,
  update_token       text,
  converted_job_id   uuid,
  CONSTRAINT employer_briefs_pkey PRIMARY KEY (id),
  CONSTRAINT employer_briefs_converted_job_id_fkey FOREIGN KEY (converted_job_id)
    REFERENCES public.jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employer_briefs_platform ON public.employer_briefs
  USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_employer_briefs_status ON public.employer_briefs
  USING btree (status);


-- ----------------------------------------------------------------------------
-- job_seeker_registrations  (29 columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_seeker_registrations (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_at         timestamptz          DEFAULT now(),
  platform           text        NOT NULL DEFAULT 'ab'::text,
  full_name          text        NOT NULL,
  email              text        NOT NULL,
  phone              text,
  location_city      text        NOT NULL,
  location_country   text,
  linkedin_url       text,
  professional_role  text        NOT NULL,
  qualification      text        NOT NULL,
  years_experience   text        NOT NULL,
  employment_status  text        NOT NULL,
  salary_expectation text,
  role_types         text,
  jurisdictions      text,
  languages          text,
  biography          text        NOT NULL,
  terms_agreed       boolean              DEFAULT false,
  data_consent       boolean              DEFAULT false,
  status             text        NOT NULL DEFAULT 'pending_verification'::text,
  verification_token text,
  verified_at        timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        text,
  admin_notes        text,
  reference_number   text,
  update_token       text,
  pathway            text                 DEFAULT 'direct'::text,
  CONSTRAINT job_seeker_registrations_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_job_seeker_platform ON public.job_seeker_registrations
  USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_job_seeker_status ON public.job_seeker_registrations
  USING btree (status);
CREATE INDEX IF NOT EXISTS idx_job_seeker_token ON public.job_seeker_registrations
  USING btree (verification_token);


-- ----------------------------------------------------------------------------
-- firms_applications  (18 columns)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firms_applications (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  platform            text        NOT NULL,
  firm_name           text        NOT NULL,
  contact_name        text        NOT NULL,
  contact_email       text        NOT NULL,
  contact_phone       text,
  firm_type           text,
  countries_operating text[]               DEFAULT '{}'::text[],
  employees_count     integer,
  website             text,
  message             text,
  status              text                 DEFAULT 'pending'::text,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  notes               text,
  years_of_experience text,
  languages           text,
  CONSTRAINT firms_applications_pkey PRIMARY KEY (id),
  CONSTRAINT firms_applications_platform_check
    CHECK (platform = ANY (ARRAY['gpe','ab','et','ab_et','all']::text[])),
  CONSTRAINT firms_applications_status_check
    CHECK (status = ANY (ARRAY['pending','approved','rejected','under_review']::text[]))
);


-- ============================================================================
-- NOT CAPTURED HERE — deliberate omissions
--
-- * Row Level Security policies. Not exported in this pass. The anon key is
--   subject to RLS; the service-role key bypasses it. Worth capturing in a
--   follow-up migration once the policies are reviewed — until then, treat
--   RLS as undocumented, not as absent.
-- * Triggers and functions (e.g. whatever maintains search_vector and
--   updated_at). Not exported. Same caveat.
-- * Tables owned by GPE / EthioTax / HagerLand. Out of scope, permanently.
-- * Sequences, extensions (pgvector is clearly in use via embeddings_index).
--
-- These gaps mean this baseline is NOT yet sufficient for a true
-- from-scratch rebuild. It IS sufficient to review, diff and reason about
-- the AccountingBody schema in code — which is the immediate problem it was
-- written to solve. Closing the remaining gaps is a follow-up task.
-- ============================================================================
