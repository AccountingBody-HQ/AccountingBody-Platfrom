-- ============================================================================
-- APPLIED 11 Nov 2026 — kept for checks/rollback; source of truth is 0010.
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d.
-- Purpose: query plans for the new search_jobs_ranked (01), written out as
-- the database plans its inner query on each call (inputs known), for the
-- 'CFO' search on each site.
-- Plain EXPLAIN (no ANALYZE) only shows the plan; it does not run the query.
-- The Supabase SQL editor shows only the last result, so run each one on its
-- own: paste one statement, run it, read the plan, then do the next.
--
-- Expect in both: "Bitmap Index Scan on idx_jobs_search_vector" (the word
-- index finds the matching jobs first), then a small sort ("top-N") under
-- "Limit". Not expected: "Seq Scan on jobs".
-- ============================================================================


-- ── Plan 1: RUN THIS ONE ON ITS OWN ─────────────────────────────────────────
-- 'CFO' on accountingbody.com, default order (relevance), page 1.
explain
select j.id
from public.jobs j
where j.status = 'active'
  and j.platform @> array['ab']
  and (j.expires_at is null or j.expires_at > now())
  and j.search_vector @@ websearch_to_tsquery('english', 'CFO')
order by
  0.40 * ts_rank_cd(j.search_vector, websearch_to_tsquery('english', 'CFO'), 32)
  + 0.30 * case
             when coalesce(j.published_at, j.created_at) is null then 1.0
             else exp((-ln(2) * greatest(0, extract(epoch from (now() - coalesce(j.published_at, j.created_at))) / 86400.0)) / 21.0)
           end
  + 0.20 * j.source_score
  + 0.10 * j.quality_score desc nulls last,
  j.created_at desc
limit 24 offset 0;


-- ── Plan 2: RUN THIS ONE ON ITS OWN ─────────────────────────────────────────
-- 'CFO' on ethiotax.com, same query.
explain
select j.id
from public.jobs j
where j.status = 'active'
  and j.platform @> array['et']
  and (j.expires_at is null or j.expires_at > now())
  and j.search_vector @@ websearch_to_tsquery('english', 'CFO')
order by
  0.40 * ts_rank_cd(j.search_vector, websearch_to_tsquery('english', 'CFO'), 32)
  + 0.30 * case
             when coalesce(j.published_at, j.created_at) is null then 1.0
             else exp((-ln(2) * greatest(0, extract(epoch from (now() - coalesce(j.published_at, j.created_at))) / 86400.0)) / 21.0)
           end
  + 0.20 * j.source_score
  + 0.10 * j.quality_score desc nulls last,
  j.created_at desc
limit 24 offset 0;
