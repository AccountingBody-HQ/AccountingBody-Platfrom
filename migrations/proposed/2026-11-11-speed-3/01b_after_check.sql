-- ============================================================================
-- RUN 11 Nov 2026 23:06 UTC: 17/17 equal_ok true — kept for later checks
-- (read-only). NOT A MIGRATION. Changes nothing.
-- Run as ONE query (first run: at once after 01_refresh_site_counts_v2.sql).
-- One row per check: check_name, result (jsonb) and equal_ok.
-- equal_ok must be true on every row.
--
-- It reads public.jobs ONCE: the MATERIALIZED part "live" below keeps the
-- active jobs that could still have been browsable when the counts were
-- written, and every live number is worked out from that copy.
--
-- key_rows      plain 2, ab_country at least 1, search 0, other 0.
-- key_ages      every row in site_counts shares one updated_at (one run).
-- plain <p>     stored total against a live count measured at the row's
--               updated_at (a job that expired since then still counts,
--               as it did when the row was written). live_now is for
--               reference only.
-- sum <p>       the platform's country rows added up, plus the live count
--               of its jobs with no country row (no country, empty, or
--               over 200 characters), equals its plain total.
-- country <p> <name>
--               every stored country row against a live exact count the
--               site's way: location_country = <name>, browsable at the
--               row's updated_at.
-- missing <p>   live countries (at the plain row's time) with no stored
--               row: must be none.
-- A job added, closed or edited since the count can still make a number
-- differ by a few. If so, run this again within a minute after the next
-- 10-minute refresh before deciding anything.
-- ============================================================================

with
stored as (
  select s.key, s.value, s.updated_at
  from public.site_counts s
),
plain as (
  select v.platform, st.value, st.updated_at
  from (values ('ab'::text), ('et'::text)) as v(platform)
  left join stored st on st.key = 'jobs_browsable:' || v.platform
),
country as (
  select
    v.platform,
    substr(st.key, length('jobs_browsable:' || v.platform || ':country:') + 1) as name,
    st.key,
    st.value,
    st.updated_at
  from (values ('ab'::text), ('et'::text)) as v(platform)
  join stored st on starts_with(st.key, 'jobs_browsable:' || v.platform || ':country:')
),
-- The one read of public.jobs.
live as materialized (
  select j.platform, j.location_country, j.expires_at
  from public.jobs j
  where j.status = 'active'
    and (j.expires_at is null
         or j.expires_at > (select min(st.updated_at) from stored st))
)
select checks.check_name, checks.result, checks.equal_ok
from (
  -- 1. Row counts by kind.
  select
    1 as ord,
    'key_rows'::text as check_name,
    jsonb_build_object(
      'plain', count(*) filter (where st.key in ('jobs_browsable:ab', 'jobs_browsable:et')),
      'ab_country', count(*) filter (where starts_with(st.key, 'jobs_browsable:ab:country:')),
      'et_country', count(*) filter (where starts_with(st.key, 'jobs_browsable:et:country:')),
      'search', count(*) filter (where strpos(st.key, ':search:') > 0),
      'other', count(*) filter (where st.key not in ('jobs_browsable:ab', 'jobs_browsable:et')
                                  and not starts_with(st.key, 'jobs_browsable:ab:country:')
                                  and not starts_with(st.key, 'jobs_browsable:et:country:')
                                  and strpos(st.key, ':search:') = 0)
    ) as result,
    (
      count(*) filter (where st.key in ('jobs_browsable:ab', 'jobs_browsable:et')) = 2
      and count(*) filter (where starts_with(st.key, 'jobs_browsable:ab:country:')) >= 1
      and count(*) filter (where strpos(st.key, ':search:') > 0) = 0
      and count(*) filter (where st.key not in ('jobs_browsable:ab', 'jobs_browsable:et')
                             and not starts_with(st.key, 'jobs_browsable:ab:country:')
                             and not starts_with(st.key, 'jobs_browsable:et:country:')
                             and strpos(st.key, ':search:') = 0) = 0
    ) as equal_ok
  from stored st

  union all

  -- 2. All rows come from one run.
  select
    2,
    'key_ages',
    jsonb_build_object(
      'distinct_update_times', count(distinct st.updated_at),
      'oldest_seconds', round(extract(epoch from (now() - min(st.updated_at)))),
      'newest_seconds', round(extract(epoch from (now() - max(st.updated_at))))
    ),
    count(distinct st.updated_at) = 1
  from stored st

  union all

  -- 3. Plain totals against a live count at the row's time.
  select
    3,
    'plain ' || pl.platform,
    jsonb_build_object(
      'stored', pl.value,
      'live_at_count_time', x.live_at,
      'live_now', x.live_now,
      'updated_at', pl.updated_at
    ),
    pl.value is not null and pl.value = x.live_at
  from plain pl
  cross join lateral (
    select
      count(*) filter (where l.expires_at is null or l.expires_at > pl.updated_at) as live_at,
      count(*) filter (where l.expires_at is null or l.expires_at > now()) as live_now
    from live l
    where l.platform @> array[pl.platform]
  ) x

  union all

  -- 4. Country rows plus jobs without a country row = plain total.
  select
    4,
    'sum ' || pl.platform,
    jsonb_build_object(
      'country_rows_sum', coalesce((select sum(c.value) from country c where c.platform = pl.platform), 0),
      'live_without_country_row', x.no_row,
      'plain_stored', pl.value
    ),
    pl.value is not null
      and coalesce((select sum(c.value) from country c where c.platform = pl.platform), 0) + x.no_row = pl.value
  from plain pl
  cross join lateral (
    select count(*) as no_row
    from live l
    where l.platform @> array[pl.platform]
      and (l.expires_at is null or l.expires_at > pl.updated_at)
      and (l.location_country is null
           or l.location_country = ''
           or length(l.location_country) > 200)
  ) x

  union all

  -- 5. Every stored country row against a live exact count.
  select
    5,
    'country ' || c.platform || ' ' || c.name,
    jsonb_build_object(
      'key', c.key,
      'stored', c.value,
      'live_at_count_time', x.live_at
    ),
    c.value = x.live_at
  from country c
  cross join lateral (
    select count(*) as live_at
    from live l
    where l.platform @> array[c.platform]
      and l.location_country = c.name
      and (l.expires_at is null or l.expires_at > c.updated_at)
  ) x

  union all

  -- 6. Live countries with no stored row (must be none).
  select
    6,
    'missing ' || pl.platform,
    jsonb_build_object(
      'countries_without_row', coalesce(
        jsonb_agg(m.location_country order by m.location_country) filter (where m.location_country is not null),
        '[]'::jsonb)
    ),
    count(m.location_country) = 0
  from plain pl
  left join lateral (
    select distinct l.location_country
    from live l
    where l.platform @> array[pl.platform]
      and (l.expires_at is null or l.expires_at > pl.updated_at)
      and l.location_country is not null
      and l.location_country <> ''
      and length(l.location_country) <= 200
      and not exists (
        select 1 from country c
        where c.platform = pl.platform and c.name = l.location_country
      )
  ) m on true
  group by pl.platform
) as checks
order by checks.ord, checks.check_name;
