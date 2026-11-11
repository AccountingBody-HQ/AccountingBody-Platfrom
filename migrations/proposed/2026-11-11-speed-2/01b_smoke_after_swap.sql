-- ============================================================================
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d.
-- Run as one query in the Supabase SQL editor RIGHT AFTER 01.
--
-- Purpose: prove the new live public.search_jobs_ranked runs without an
-- error, using the same named inputs the app sends (search words
-- lowercased, 24 per page). One row per case: case_name, rows_returned
-- (normally 24) and live_language (expect 'plpgsql', which shows 01 took
-- effect).
--
-- IF THIS QUERY GIVES AN ERROR, OR ANY rows_returned IS 0: run
-- 99_rollback.sql AT ONCE, then send the error text.
-- ============================================================================

select checks.case_name, checks.rows_returned, lang.live_language
from (
  select
    1 as ord,
    'ab no words'::text as case_name,
    (
      select count(*)
      from public.search_jobs_ranked(
        p_platform => 'ab', p_search => null, p_location => null, p_location_country => null,
        p_employment_types => null, p_seniority_levels => null, p_remote_only => null,
        p_salary_min => null, p_salary_max => null, p_posted_within_days => null,
        p_qualifications => null, p_sources => null, p_sort_by => 'relevance',
        p_limit => 24, p_offset => 0
      )
    ) as rows_returned

  union all

  select
    2,
    'ab cfo',
    (
      select count(*)
      from public.search_jobs_ranked(
        p_platform => 'ab', p_search => 'cfo', p_location => null, p_location_country => null,
        p_employment_types => null, p_seniority_levels => null, p_remote_only => null,
        p_salary_min => null, p_salary_max => null, p_posted_within_days => null,
        p_qualifications => null, p_sources => null, p_sort_by => 'relevance',
        p_limit => 24, p_offset => 0
      )
    )

  union all

  select
    3,
    'et no words',
    (
      select count(*)
      from public.search_jobs_ranked(
        p_platform => 'et', p_search => null, p_location => null, p_location_country => null,
        p_employment_types => null, p_seniority_levels => null, p_remote_only => null,
        p_salary_min => null, p_salary_max => null, p_posted_within_days => null,
        p_qualifications => null, p_sources => null, p_sort_by => 'relevance',
        p_limit => 24, p_offset => 0
      )
    )
) as checks
cross join lateral (
  select string_agg(distinct l.lanname, ', ') as live_language
  from pg_proc p
  join pg_language l on l.oid = p.prolang
  where p.proname = 'search_jobs_ranked'
) as lang
order by checks.ord;
