-- ============================================================================
-- READ-ONLY. NOT A MIGRATION. Changes nothing.
-- RUN ORDER: 04a -> 00 -> 00b -> 00c -> (owner + reviewer decide) -> 01
--            -> 01b at once -> 02 -> 04b -> 00d. Needs 00 (v2) applied first.
--
-- Purpose: how long the trial copy (the new fast search, v2) really takes,
-- for six searches. EXPLAIN (ANALYZE, BUFFERS) really runs the query,
-- which only reads data, and reports the time. Look at the last line,
-- "Execution Time: … ms", and note "shared hit/read" buffers.
-- For comparison (live, 11 Nov ~20:25): 'treasury' written out by hand took
-- 2,996 ms; inside v1 it took 16,867 ms. The live limit is 8,000 ms.
-- The plan shows one "Function Scan" line (the steps inside the function
-- are not listed); 04b shows those steps.
--
-- The SQL editor shows only the last result, so run each one on its own:
-- paste one statement, run it, note the Execution Time, then do the next.
-- Words are lowercased, as the app sends them.
-- ============================================================================


-- ── Timing 1: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'treasury' (the word v1 planned badly).
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'treasury');


-- ── Timing 2: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'cfo'.
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'cfo');


-- ── Timing 3: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'tax manager'.
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'tax manager');


-- ── Timing 4: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'audit senior'.
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'audit senior');


-- ── Timing 5: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, search 'management accountant'.
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab', p_search => 'management accountant');


-- ── Timing 6: RUN THIS ONE ON ITS OWN ───────────────────────────────────────
-- accountingbody.com, no search words (Most relevant chosen, page 1).
explain (analyze, buffers)
select * from public.search_jobs_ranked_trial(p_platform => 'ab');
