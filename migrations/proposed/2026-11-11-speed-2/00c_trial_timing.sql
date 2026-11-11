-- ============================================================================
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d. Needs 00 applied first.
--
-- Purpose: how long the trial copy (the new fast search) really takes.
-- EXPLAIN (ANALYZE, BUFFERS) really runs the query, which only reads data,
-- and reports the time. Look at the last line, "Execution Time: … ms".
-- Under about 1,000 ms is the aim; the live limit is 8,000 ms.
-- The plan shows one "Function Scan" line (the steps inside the function
-- are not listed); 04b shows those steps.
--
-- The SQL editor shows only the last result, so run each one on its own:
-- paste one statement, run it, note the Execution Time, then do the next.
-- ============================================================================


-- ── Timing 1: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'CFO'.
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'CFO');


-- ── Timing 2: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'tax manager'.
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'tax manager');


-- ── Timing 3: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, no search words (Most relevant chosen, page 1).
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab');
