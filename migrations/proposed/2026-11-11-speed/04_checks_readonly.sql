-- ============================================================================
-- READ-ONLY. Changes nothing. Run each query on its own, BEFORE applying
-- 01-03 and again AFTER, and keep the results for the report.
-- Some queries name objects that exist only after 01-03; before then those
-- give an error or no rows, which is expected.
-- Plain EXPLAIN shows the plan only; it does not run the query.
-- ============================================================================

-- 1. Time limits per database role (anon, logged-in, server key, gateway).
select rolname, rolconfig
from pg_roles
where rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres');

-- 2. How big the jobs table is: estimated rows and total size on disk.
select c.reltuples::bigint as estimated_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
where c.oid = 'public.jobs'::regclass;

-- 3. Before 01: is the name site_counts free? Expect NULL before, 'site_counts' after.
select to_regclass('public.site_counts') as site_counts_table,
       to_regprocedure('public.refresh_site_counts()') as refresh_function;

-- 4. The boost tiers in the new default order: how many active jobs each
--    source has, and its source_score. Higher scores are listed first.
select source, source_score, count(*) as active_jobs
from public.jobs
where status = 'active'
group by source, source_score
order by source_score desc, source;

-- 5. After 02: the new index exists, is valid, and its size.
select i.indexrelid::regclass as index_name,
       i.indisvalid as is_valid,
       pg_size_pretty(pg_relation_size(i.indexrelid)) as size
from pg_index i
where i.indexrelid = to_regclass('public.idx_jobs_browsable_default_order');

-- 6. Plan of the browsable count (what refresh_site_counts runs).
--    After 02, expect "Index Only Scan using idx_jobs_browsable_default_order".
explain
select count(*)
from public.jobs j
where j.status = 'active'
  and j.platform @> array['ab']
  and (j.expires_at is null or j.expires_at > now());

-- 7. Plan of the default list, page 2 (what the site runs with no search words).
--    After 02, expect "Index Scan using idx_jobs_browsable_default_order"
--    under a Limit, and no Sort step.
explain
select id, slug, title
from public.jobs
where status = 'active'
  and platform @> array['ab']
  and (expires_at is null or expires_at > now())
order by source_score desc, published_at desc nulls last, created_at desc, id desc
limit 24 offset 24;

-- 8. After 03: the pre-counted totals and when they were last written
--    (updated_at should never be more than about 10 minutes ago).
select key, value, updated_at, now() - updated_at as age
from public.site_counts
order by key;

-- 9. After 03: the last five runs of the 10-minute job and whether they worked.
select d.status, d.start_time, d.end_time, d.return_message
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'refresh-site-counts'
order by d.start_time desc
limit 5;
