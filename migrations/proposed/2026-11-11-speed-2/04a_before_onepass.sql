-- ============================================================================
-- APPLIED 11 Nov 2026 — kept for checks/rollback; source of truth is 0010.
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d.
-- Purpose: the "before" checks for speed job part 2 in ONE statement.
-- Run as one query in the Supabase SQL editor. One row per check:
-- check_name (text) and result (jsonb).
--
-- The word-match counts use the word index (GIN on search_vector) with fixed
-- words, so they should take well under a few seconds on the NANO database.
-- The coverage check reads every active job once (a few seconds is normal).
--
-- 'search_jobs_ranked' -> 'matches_0004' is true when the live function body
-- is byte for byte the body in migrations/0004 (length 3389, fingerprint
-- aad246bd049e61611aed2c5391fdabb3). False can also mean only spacing
-- differs; the length and settings shown help tell.
-- ============================================================================

select checks.check_name, checks.result
from (
  -- 1. Database version (01 needs Postgres 12 or later for plan_cache_mode).
  select
    1 as ord,
    'postgres_version'::text as check_name,
    to_jsonb(version()) as result

  union all

  -- 2. Default word-search language used by the API's word count
  --    (PostgREST textSearch with no language). The ranked search always
  --    uses 'english'; if this is not english the two can differ.
  select 2, 'default_text_search_config', to_jsonb(current_setting('default_text_search_config'))

  union all

  -- 3. Does get_active_job_countries exist, with which arguments, and is
  --    its comment ours? An empty list means it does not exist (02 creates it).
  select
    3,
    'get_active_job_countries',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'signature', p.oid::regprocedure::text,
            'arguments', pg_get_function_arguments(p.oid),
            'returns', pg_get_function_result(p.oid),
            'comment', obj_description(p.oid, 'pg_proc')
          )
          order by p.oid
        ),
        '[]'::jsonb
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'get_active_job_countries'
    )

  union all

  -- 4. The live search_jobs_ranked: language, settings, body length and
  --    fingerprint, compared with migrations/0004.
  select
    4,
    'search_jobs_ranked',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', n.nspname,
            'signature', p.oid::regprocedure::text,
            'language', l.lanname,
            'settings', to_jsonb(p.proconfig),
            'body_length', length(p.prosrc),
            'body_md5', md5(p.prosrc),
            'matches_0004', md5(p.prosrc) = 'aad246bd049e61611aed2c5391fdabb3'
          )
          order by p.oid
        ),
        '[]'::jsonb
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where p.proname = 'search_jobs_ranked'
    )

  union all

  -- 5. Browsable jobs matching each Popular-style search, per platform,
  --    using the word index exactly as the ranked search does.
  select
    5,
    'search_matches',
    (
      select jsonb_object_agg(m.platform || ' ' || m.term, m.jobs)
      from (
        select
          p.platform,
          w.term,
          (
            select count(*)
            from public.jobs j
            where j.status = 'active'
              and j.platform @> array[p.platform]
              and (j.expires_at is null or j.expires_at > now())
              and j.search_vector @@ websearch_to_tsquery('english', w.term)
          ) as jobs
        from (values ('ab'::text), ('et'::text)) as p(platform)
        cross join (values ('CFO'::text), ('tax manager'::text), ('audit senior'::text)) as w(term)
      ) m
    )

  union all

  -- 6. Is search_vector filled in for every active job?
  select
    6,
    'search_vector_coverage',
    (
      select jsonb_build_object(
        'active_jobs', count(*),
        'missing_search_vector', count(*) filter (where j.search_vector is null)
      )
      from public.jobs j
      where j.status = 'active'
    )
) as checks
order by checks.ord;
