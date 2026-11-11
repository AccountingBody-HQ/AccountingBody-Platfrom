-- ============================================================================
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- Purpose: the two query plans to check AFTER 02_jobs_list_index.sql.
-- Plain EXPLAIN (no ANALYZE) only shows the plan; it does not run the query.
-- The Supabase SQL editor shows only the last result, so run each one on its
-- own: paste one statement, run it, read the plan, then do the next.
-- ============================================================================


-- ── Plan 1: RUN THIS ONE ON ITS OWN ─────────────────────────────────────────
-- The browsable count (what refresh_site_counts runs).
-- Expect: "Index Only Scan using idx_jobs_browsable_default_order".
explain
select count(*)
from public.jobs j
where j.status = 'active'
  and j.platform @> array['ab']
  and (j.expires_at is null or j.expires_at > now());


-- ── Plan 2: RUN THIS ONE ON ITS OWN ─────────────────────────────────────────
-- The default jobs list, page 2 (what the site runs with no search words).
-- Expect: "Index Scan using idx_jobs_browsable_default_order" under "Limit",
-- and no "Sort" step.
explain
select id, slug, title
from public.jobs
where status = 'active'
  and platform @> array['ab']
  and (expires_at is null or expires_at > now())
order by source_score desc, published_at desc nulls last, created_at desc, id desc
limit 24 offset 24;
