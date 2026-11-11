-- ============================================================================
-- NOT APPLIED. READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> (owner + reviewer decide) -> 01 -> 01b at once
--            -> 99 only if 01b shows a mismatch or an error.
-- Speed job part 3, "before" checks in ONE statement. Run as one query in
-- the Supabase SQL editor. One row per check: check_name and result (jsonb).
--
-- refresh_site_counts: matches_0009_lf (or matches_0009_crlf) must be true
--   before 01 is run. 01 refuses to run otherwise.
-- text_search_config: the site's word count uses the API session's default
--   language. 'api_role_settings' must show no default_text_search_config
--   other than english (an empty list means no override).
-- countries_per_platform, top5_countries_ab, location_country_shape: what
--   01 will write for the country rows.
-- popular_search_counts: the twelve numbers 01 will write, computed with
--   the same expression as the new function.
-- cron_recent_runs: how long the current refresh takes (baseline).
-- elapsed_ms: roughly how long this whole check took (the rows above are
--   normally worked out in order, so this is the last thing measured).
-- ============================================================================

select checks.check_name, checks.result
from (
  -- 1. The live function: body fingerprint and settings, compared with 0009.
  select
    1 as ord,
    'refresh_site_counts'::text as check_name,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'signature', p.oid::regprocedure::text,
            'owner', pg_get_userbyid(p.proowner),
            'security_definer', p.prosecdef,
            'settings', to_jsonb(p.proconfig),
            'acl', to_jsonb(p.proacl::text[]),
            'comment', obj_description(p.oid, 'pg_proc'),
            'body_length', length(p.prosrc),
            'body_md5', md5(p.prosrc),
            'matches_0009_lf', md5(p.prosrc) = '03dc514ee0589c531f40ef12f1ad66bf',
            'matches_0009_crlf', md5(p.prosrc) = 'ec9c609a0df3f9e685acc84a0144e4b8'
          )
          order by p.oid
        ),
        '[]'::jsonb
      )
      from pg_proc p
      where p.proname = 'refresh_site_counts'
    ) as result

  union all

  -- 2. Default word-search language here and on the API roles.
  select
    2,
    'text_search_config',
    jsonb_build_object(
      'this_session', current_setting('default_text_search_config'),
      'database_setting', (
        select coalesce(jsonb_agg(s.setconfig), '[]'::jsonb)
        from pg_db_role_setting s
        join pg_database d on d.oid = s.setdatabase
        where d.datname = current_database() and s.setrole = 0
      ),
      'api_role_settings', (
        select coalesce(jsonb_agg(jsonb_build_object('role', r.rolname, 'setting', c.setting)), '[]'::jsonb)
        from pg_roles r
        cross join lateral unnest(coalesce(r.rolconfig, '{}'::text[])) as c(setting)
        where r.rolname in ('authenticator', 'service_role', 'anon', 'authenticated')
          and c.setting like 'default_text_search_config=%'
      )
    )

  union all

  -- 3. Countries with at least one browsable job, per platform, counted
  --    exactly as 01 will (non-empty names of at most 200 characters).
  select
    3,
    'countries_per_platform',
    (
      select jsonb_object_agg(c.platform, c.countries)
      from (
        select p.platform, count(distinct j.location_country) as countries
        from public.jobs j
        join (values ('ab'::text), ('et'::text)) as p(platform)
          on j.platform @> array[p.platform]
        where j.status = 'active'
          and (j.expires_at is null or j.expires_at > now())
          and j.location_country is not null
          and j.location_country <> ''
          and length(j.location_country) <= 200
        group by p.platform
      ) c
    )

  union all

  -- 4. Top 5 countries by browsable jobs on ab.
  select
    4,
    'top5_countries_ab',
    (
      select jsonb_agg(jsonb_build_object('country', t.location_country, 'jobs', t.jobs) order by t.jobs desc, t.location_country)
      from (
        select j.location_country, count(*) as jobs
        from public.jobs j
        where j.status = 'active'
          and j.platform @> array['ab'::text]
          and (j.expires_at is null or j.expires_at > now())
          and j.location_country is not null
          and j.location_country <> ''
          and length(j.location_country) <= 200
        group by j.location_country
        order by count(*) desc, j.location_country
        limit 5
      ) t
    )

  union all

  -- 5. Browsable rows with no country, an empty one, or one over 200
  --    characters (these get no country row), and the longest name.
  select
    5,
    'location_country_shape',
    (
      select jsonb_build_object(
        'browsable_rows', count(*),
        'null_country', count(*) filter (where j.location_country is null),
        'empty_country', count(*) filter (where j.location_country = ''),
        'over_200_chars', count(*) filter (where length(j.location_country) > 200),
        'with_outer_spaces', count(*) filter (where j.location_country <> btrim(j.location_country)),
        'longest_name_chars', max(length(j.location_country))
      )
      from public.jobs j
      where j.status = 'active'
        and (j.expires_at is null or j.expires_at > now())
        and (j.platform @> array['ab'::text] or j.platform @> array['et'::text])
    )

  union all

  -- 6. The six Popular searches per platform, as the new function counts.
  select
    6,
    'popular_search_counts',
    (
      select jsonb_object_agg(m.platform || ' ' || m.words, m.jobs)
      from (
        select
          p.platform,
          w.words,
          (
            select count(*)
            from public.jobs j
            where j.status = 'active'
              and j.platform @> array[p.platform]
              and (j.expires_at is null or j.expires_at > now())
              and j.search_vector @@ websearch_to_tsquery('english', w.words)
          ) as jobs
        from (values ('ab'::text), ('et'::text)) as p(platform)
        cross join (values
          ('management accountant'::text),
          ('tax manager'::text),
          ('financial controller'::text),
          ('audit senior'::text),
          ('fp&a analyst'::text),
          ('cfo'::text)
        ) as w(words)
      ) m
    )

  union all

  -- 7. The rows in site_counts now.
  select
    7,
    'site_counts_rows',
    (
      select coalesce(
        jsonb_agg(jsonb_build_object('key', s.key, 'value', s.value, 'updated_at', s.updated_at) order by s.key),
        '[]'::jsonb
      )
      from public.site_counts s
    )

  union all

  -- 8. The schedule and its last five runs (duration of the current refresh).
  select
    8,
    'cron_recent_runs',
    jsonb_build_object(
      'job', (
        select jsonb_agg(jsonb_build_object('jobid', c.jobid, 'schedule', c.schedule, 'command', c.command, 'active', c.active))
        from cron.job c
        where c.jobname = 'refresh-site-counts'
      ),
      'runs', (
        select jsonb_agg(jsonb_build_object(
          'status', r.status,
          'start_time', r.start_time,
          'duration_ms', round(extract(epoch from (r.end_time - r.start_time)) * 1000)
        ) order by r.start_time desc)
        from (
          select d.status, d.start_time, d.end_time
          from cron.job_run_details d
          join cron.job c on c.jobid = d.jobid
          where c.jobname = 'refresh-site-counts'
          order by d.start_time desc
          limit 5
        ) r
      )
    )

  union all

  -- 9. Rough time taken by this whole check.
  select
    9,
    'elapsed_ms',
    to_jsonb(round(extract(epoch from (clock_timestamp() - statement_timestamp())) * 1000))
) as checks
order by checks.ord;
