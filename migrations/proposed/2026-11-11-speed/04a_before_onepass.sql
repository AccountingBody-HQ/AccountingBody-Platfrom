-- ============================================================================
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- Purpose: every "before" check from 04_checks_readonly.sql (except the two
-- query plans, which are in 04b_plans_after.sql) in ONE statement, because
-- the Supabase SQL editor shows only the last result of a multi-statement run.
-- Run as one query in the Supabase SQL editor. One row per check:
-- check_name (text) and result (jsonb).
--
-- Expected: the 'browsable_count' and 'boost_tiers' rows count every
-- browsable job exactly, so this query may take several seconds on the NANO
-- database. That is normal.
--
-- "Browsable" is exactly the filter in lib/jobs.ts: status 'active', platform
-- contains the site code ('ab' or 'et'), expires_at empty or in the future.
-- Boost tiers use the columns of the new default list order: source_score
-- (the boost) and published_at (empty values sort last).
-- A null in 'names_free' means that name is free.
-- ============================================================================

select checks.check_name, checks.result
from (
  -- 1. Time limits per database role.
  select
    1 as ord,
    'role_time_limits'::text as check_name,
    (
      select coalesce(
        jsonb_agg(jsonb_build_object('rolname', r.rolname, 'rolconfig', to_jsonb(r.rolconfig)) order by r.rolname),
        '[]'::jsonb
      )
      from pg_roles r
      where r.rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
    ) as result

  union all

  -- 2. Jobs table: estimated rows and total size on disk.
  select
    2,
    'jobs_table_size',
    (
      select jsonb_build_object(
        'estimated_rows', c.reltuples::bigint,
        'total_size', pg_size_pretty(pg_total_relation_size(c.oid))
      )
      from pg_class c
      where c.oid = 'public.jobs'::regclass
    )

  union all

  -- 3. Are the new names free? null = free.
  select
    3,
    'names_free',
    jsonb_build_object(
      'site_counts_table', to_regclass('public.site_counts')::text,
      'refresh_function', to_regprocedure('public.refresh_site_counts()')::text,
      'default_order_index', to_regclass('public.idx_jobs_browsable_default_order')::text
    )

  union all

  -- 4. Is pg_cron installed?
  select
    4,
    'pg_cron',
    coalesce(
      (
        select jsonb_build_object('extname', e.extname, 'extversion', e.extversion)
        from pg_extension e
        where e.extname = 'pg_cron'
      ),
      to_jsonb('not installed'::text)
    )

  union all

  -- 5. Boost tiers per platform: browsable jobs per source_score (highest
  --    first, as the new default order shows them), and how many in each
  --    tier have no published_at (those go to the end of their tier).
  select
    5,
    'boost_tiers',
    (
      select jsonb_object_agg(t.platform, t.tiers)
      from (
        select
          p.platform,
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'source_score', s.source_score,
                  'jobs', s.jobs,
                  'null_published_at', s.null_published_at
                )
                order by s.source_score desc
              ),
              '[]'::jsonb
            )
            from (
              select
                j.source_score,
                count(*) as jobs,
                count(*) filter (where j.published_at is null) as null_published_at
              from public.jobs j
              where j.status = 'active'
                and j.platform @> array[p.platform]
                and (j.expires_at is null or j.expires_at > now())
              group by j.source_score
            ) s
          ) as tiers
        from (values ('ab'::text), ('et'::text)) as p(platform)
      ) t
    )

  union all

  -- 6. Exact browsable count per platform, to compare with site_counts later.
  select
    6,
    'browsable_count',
    (
      select jsonb_object_agg(b.platform, b.jobs)
      from (
        select
          p.platform,
          (
            select count(*)
            from public.jobs j
            where j.status = 'active'
              and j.platform @> array[p.platform]
              and (j.expires_at is null or j.expires_at > now())
          ) as jobs
        from (values ('ab'::text), ('et'::text)) as p(platform)
      ) b
    )
) as checks
order by checks.ord;
