-- ============================================================================
-- TRIAL helper — used and dropped 11 Nov 2026. Source of truth is 0010.
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d. Needs 00 applied first.
-- Run as one query in the Supabase SQL editor.
--
-- Purpose: compare the live public.search_jobs_ranked with the trial copy
-- public.search_jobs_ranked_trial (00, the same body as 01 v2) on real
-- data. The live one is 0004, or 01 v1 if v1 is already live (v1 was shown
-- identical to 0004 by this same comparison on 11 Nov). One row per case:
--   case_name                  what was searched
--   same_ids_same_order        true = identical page, identical order
--   same_id_set                true = the same jobs on the page, any order
--   old_count, trial_count     jobs returned by each (normally 24)
--   first_difference_position  first position (1-24) where they differ;
--                              empty when there is no difference
--   tie_only_difference        true = every position where they differ
--                              holds two jobs with exactly equal sort
--                              values (an exact tie)
-- Each call uses all 15 named inputs, exactly as the app sends them
-- (lib/jobs.ts getActiveDirectJobs): search words lowercased and trimmed,
-- unused filters null, 24 per page.
--
-- How to read it
--   Exact ties have no fixed order in either function, so the two may put
--   tied jobs in a different order, or (at the edge of a page) pick a
--   different one of several tied jobs. That is acceptable ONLY when
--   tie_only_difference is true. Any row with tie_only_difference = false
--   means a real difference: stop, do not run 01, send the result.
--   tie_only_difference recomputes the seven sort values of both functions
--   (same expressions, same moment in time) for the job at each differing
--   position and checks they are equal.
--
-- Expected time: the OLD function may take 10 seconds or more per word
-- search here (the SQL editor has no 8-second limit), so the whole query
-- may take a minute or two. That is expected.
-- ============================================================================

with cases as (
  select *
  from (
    values
      (1,  'ab no words, relevance, page 1',            'ab', null::text,              null::text, 'relevance',   0),
      (2,  'ab no words, relevance, page 2',            'ab', null,                    null,       'relevance',   24),
      (3,  'ab cfo',                                    'ab', 'cfo',                   null,       'relevance',   0),
      (4,  'ab tax manager',                            'ab', 'tax manager',           null,       'relevance',   0),
      (5,  'ab audit senior',                           'ab', 'audit senior',          null,       'relevance',   0),
      (6,  'ab management accountant',                  'ab', 'management accountant', null,       'relevance',   0),
      (7,  'et cfo',                                    'et', 'cfo',                   null,       'relevance',   0),
      (8,  'et no words, relevance',                    'et', null,                    null,       'relevance',   0),
      (9,  'ab sort recent',                            'ab', null,                    null,       'recent',      0),
      (10, 'ab sort salary_high',                       'ab', null,                    null,       'salary_high', 0),
      (11, 'ab sort salary_low',                        'ab', null,                    null,       'salary_low',  0),
      (
        12,
        'ab most common country',
        'ab',
        null,
        (
          select j.location_country
          from public.jobs j
          where j.status = 'active'
            and j.platform @> array['ab']
            and (j.expires_at is null or j.expires_at > now())
            and j.location_country is not null
          group by j.location_country
          order by count(*) desc, j.location_country
          limit 1
        ),
        'relevance',
        0
      ),
      (13, 'ab cfo, page 2',                            'ab', 'cfo',                   null,       'relevance',   24)
  ) as v(ord, case_name, platform, search, country, sort_by, page_offset)
),

-- MATERIALIZED: each function is called exactly once per case.
runs as materialized (
  select
    c.*,
    array(
      select o.id
      from public.search_jobs_ranked(
        p_platform           => c.platform,
        p_search             => c.search,
        p_location           => null,
        p_location_country   => c.country,
        p_employment_types   => null,
        p_seniority_levels   => null,
        p_remote_only        => null,
        p_salary_min         => null,
        p_salary_max         => null,
        p_posted_within_days => null,
        p_qualifications     => null,
        p_sources            => null,
        p_sort_by            => c.sort_by,
        p_limit              => 24,
        p_offset             => c.page_offset
      ) as o
    ) as old_ids,
    array(
      select t.id
      from public.search_jobs_ranked_trial(
        p_platform           => c.platform,
        p_search             => c.search,
        p_location           => null,
        p_location_country   => c.country,
        p_employment_types   => null,
        p_seniority_levels   => null,
        p_remote_only        => null,
        p_salary_min         => null,
        p_salary_max         => null,
        p_posted_within_days => null,
        p_qualifications     => null,
        p_sources            => null,
        p_sort_by            => c.sort_by,
        p_limit              => 24,
        p_offset             => c.page_offset
      ) as t
    ) as trial_ids
  from cases c
),

-- Every position where the two pages differ.
differences as materialized (
  select r.ord, g.i, r.old_ids[g.i] as old_id, r.trial_ids[g.i] as trial_id
  from runs r
  cross join lateral generate_series(1, greatest(cardinality(r.old_ids), cardinality(r.trial_ids))) as g(i)
  where r.old_ids[g.i] is distinct from r.trial_ids[g.i]
),

-- The seven sort values of 0004/01 for the job on each side of each
-- difference (same expressions as the functions, same now()).
difference_keys as (
  select
    d.ord,
    d.i,
    side.job_id,
    row(
      case when r.sort_by = 'recent'      then j.created_at end,
      case when r.sort_by = 'salary_high' then j.salary_max end,
      case when r.sort_by = 'salary_high' then j.salary_min end,
      case when r.sort_by = 'salary_low'  then j.salary_min end,
      case when r.sort_by = 'salary_low'  then j.salary_max end,
      case when r.sort_by not in ('recent', 'salary_high', 'salary_low')
        then 0.40 * (
               case
                 when r.search is not null and btrim(r.search) <> ''
                   then ts_rank_cd(j.search_vector, websearch_to_tsquery('english', r.search), 32)
                 else 0
               end
             )
           + 0.30 * (
               case
                 when coalesce(j.published_at, j.created_at) is null then 1.0
                 else exp(
                   (-ln(2) * greatest(0,
                     extract(epoch from (now() - coalesce(j.published_at, j.created_at))) / 86400.0
                   )) / 21.0
                 )
               end
             )
           + 0.20 * j.source_score
           + 0.10 * j.quality_score
      end,
      j.created_at
    ) as sort_key
  from differences d
  join runs r on r.ord = d.ord
  cross join lateral (values (d.old_id), (d.trial_id)) as side(job_id)
  left join public.jobs j on j.id = side.job_id
)

select
  r.case_name,
  r.old_ids = r.trial_ids as same_ids_same_order,
  (select array_agg(x order by x) from unnest(r.old_ids) as x)
    is not distinct from
  (select array_agg(y order by y) from unnest(r.trial_ids) as y) as same_id_set,
  cardinality(r.old_ids) as old_count,
  cardinality(r.trial_ids) as trial_count,
  (select min(d.i) from differences d where d.ord = r.ord) as first_difference_position,
  not exists (
    select 1
    from difference_keys k
    where k.ord = r.ord
    group by k.i
    having bool_or(k.job_id is null) or count(distinct k.sort_key) > 1
  ) as tie_only_difference
from runs r
order by r.ord;
