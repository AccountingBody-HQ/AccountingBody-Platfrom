-- ============================================================================
-- NOT APPLIED. READ-ONLY. NOT A MIGRATION. Changes nothing.
-- Run at once after 01_refresh_site_counts_v2.sql, as ONE query.
-- One row per check: check_name, result (jsonb) and equal_ok.
--
-- key_rows: how many country and search rows each platform has (search
--   rows must be 6 per platform).
-- key_ages: age in seconds of every row in site_counts.
-- compare ...: for the top 2 countries on ab, United States on ab, and the
--   Popular searches 'cfo' and 'fp&a analyst' on ab and et, the stored
--   value against a live exact count written the way the site counts:
--     status = 'active', platform contains the platform, not expired,
--     and location_country = <name>, or
--     search_vector @@ websearch_to_tsquery(<words>) with NO language
--     given (the site's word count sends none, so this session's default
--     language is used, as for the site).
--   "Not expired" is measured at the moment the row was counted (its
--   updated_at), so a job expiring between the count and this check does
--   not show as a mismatch. live_now uses the current time, for reference.
--   equal_ok must be true on every compare row. A missing row is only
--   correct when the live count is 0 (key_present shows which).
--   A job added or closed since the count can still make one row differ
--   by a few. If so, run this again within a minute after the next
--   10-minute refresh before deciding anything.
-- If 'United States' shows key_present false and live 0, the country is
-- stored under another name: read 04a's top5_countries_ab and say so in
-- the report. It is not a fault of 01.
-- ============================================================================

select checks.check_name, checks.result, checks.equal_ok
from (
  -- 1. Row counts per platform and kind.
  select
    1 as ord,
    'key_rows'::text as check_name,
    jsonb_build_object(
      'plain', count(*) filter (where s.key in ('jobs_browsable:ab', 'jobs_browsable:et')),
      'ab_country', count(*) filter (where starts_with(s.key, 'jobs_browsable:ab:country:')),
      'et_country', count(*) filter (where starts_with(s.key, 'jobs_browsable:et:country:')),
      'ab_search', count(*) filter (where starts_with(s.key, 'jobs_browsable:ab:search:')),
      'et_search', count(*) filter (where starts_with(s.key, 'jobs_browsable:et:search:')),
      'other', count(*) filter (where s.key not in ('jobs_browsable:ab', 'jobs_browsable:et')
                                  and not starts_with(s.key, 'jobs_browsable:ab:country:')
                                  and not starts_with(s.key, 'jobs_browsable:et:country:')
                                  and not starts_with(s.key, 'jobs_browsable:ab:search:')
                                  and not starts_with(s.key, 'jobs_browsable:et:search:'))
    ) as result,
    (
      count(*) filter (where s.key in ('jobs_browsable:ab', 'jobs_browsable:et')) = 2
      and count(*) filter (where starts_with(s.key, 'jobs_browsable:ab:search:')) = 6
      and count(*) filter (where starts_with(s.key, 'jobs_browsable:et:search:')) = 6
      and count(*) filter (where starts_with(s.key, 'jobs_browsable:ab:country:')) > 0
    ) as equal_ok
  from public.site_counts s

  union all

  -- 2. Age of every row, in seconds. All rows of one run share one time.
  select
    2,
    'key_ages',
    jsonb_build_object(
      'distinct_update_times', count(distinct s.updated_at),
      'oldest_seconds', round(extract(epoch from (now() - min(s.updated_at)))),
      'newest_seconds', round(extract(epoch from (now() - max(s.updated_at)))),
      'rows', jsonb_agg(
        jsonb_build_object('key', s.key, 'value', s.value, 'age_seconds', round(extract(epoch from (now() - s.updated_at))))
        order by s.key
      )
    ),
    count(distinct s.updated_at) = 1
  from public.site_counts s

  union all

  -- 3. Stored value against a live count, for 3 countries and 2 searches.
  select
    3,
    'compare ' || t.kind || ' ' || t.platform || ' ' || t.name,
    jsonb_build_object(
      'key', t.key,
      'key_present', sc.key is not null,
      'stored', sc.value,
      'live_at_count_time', t.live_at_count_time,
      'live_now', t.live_now
    ),
    case
      when sc.key is null then t.live_at_count_time = 0
      else sc.value = t.live_at_count_time
    end
  from (
    select
      w.kind,
      w.platform,
      w.name,
      w.key,
      (
        select count(*)
        from public.jobs j
        where j.status = 'active'
          and j.platform @> array[w.platform]
          and (j.expires_at is null or j.expires_at > coalesce(
                (select s2.updated_at from public.site_counts s2 where s2.key = w.key),
                now()))
          and case
                when w.kind = 'country' then j.location_country = w.name
                else j.search_vector @@ websearch_to_tsquery(w.name)
              end
      ) as live_at_count_time,
      (
        select count(*)
        from public.jobs j
        where j.status = 'active'
          and j.platform @> array[w.platform]
          and (j.expires_at is null or j.expires_at > now())
          and case
                when w.kind = 'country' then j.location_country = w.name
                else j.search_vector @@ websearch_to_tsquery(w.name)
              end
      ) as live_now
    from (
      select
        v.kind,
        v.platform,
        v.name,
        'jobs_browsable:' || v.platform || ':' || v.kind || ':' || v.name as key
      from (
        -- The top 2 countries on ab by stored value, then United States.
        select 'country'::text as kind, 'ab'::text as platform, x.name
        from (
          select substr(s.key, length('jobs_browsable:ab:country:') + 1) as name
          from public.site_counts s
          where starts_with(s.key, 'jobs_browsable:ab:country:')
          order by s.value desc, s.key
          limit 2
        ) x
        union all
        select 'country', 'ab', 'United States'
        union all
        select 'search', p.platform, q.words
        from (values ('ab'::text), ('et'::text)) as p(platform)
        cross join (values ('cfo'::text), ('fp&a analyst'::text)) as q(words)
      ) v
    ) w
  ) t
  left join public.site_counts sc on sc.key = t.key
) as checks
order by checks.ord, checks.check_name;
