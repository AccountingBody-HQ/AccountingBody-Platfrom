// Pure decision logic for the /search jobs panel's query strategy — split
// out of app/api/search/route.ts so the tier-selection rule can be
// unit-tested without spinning up a route handler, same split as
// app/jobs/listings/countryOptions.ts / jobLocation.ts / components/
// pagination.ts.
//
// Why this exists: search_jobs_ranked parses its search term with
// websearch_to_tsquery. A bare multi-word term is ANDed (both words must
// appear somewhere in the row), which is too narrow for some terms
// ("ratio analysis" -> 2 jobs) but reasonable for most. OR-joining every
// token (the previous approach, buildSimilarQuery in lib/jobs.ts) fixes the
// "too few results" problem but overcorrects: "fund manager" OR-joined
// becomes "fund OR manager", which matches almost every job with "manager"
// anywhere in title/company/location/description — 7,482 jobs for a term
// that should return a few hundred at most, with irrelevant titles ranked
// above genuinely relevant ones.
//
// websearch_to_tsquery also supports quoted phrases (adjacency, via the
// <-> operator), which is measurably the most precise of the three for a
// multi-word job title fragment — see tmp-audit/session16-search-relevance.md
// Phase 1 for the live measurements this ordering is based on. So the
// tiers, tried in order, are:
//   1. phrase  — `"term"`, adjacency-constrained, most precise
//   2. and     — bare term, both words present anywhere, less precise
//   3. or      — every token OR-joined (buildSimilarQuery), a recall net
// Each tier is tried only if the previous one didn't return enough rows to
// be worth showing over the next, broader tier.

// Tied to the jobs panel's own display size (JOB_PANEL_LIMIT in
// app/api/search/route.ts): if a tier can't even fill the panel, showing it
// over a broader tier saves nothing and costs relevance. Measured basis:
// across 13 real search terms, every genuinely well-covered term cleared
// this by a wide margin (56 to 10,148); the one term that didn't
// ("ratio analysis": phrase 0, and 2) was also the one case a human
// reviewing the raw job titles agreed had too few precise matches to
// trust — a real gap in the data, not an arbitrary round number.
export const JOB_SEARCH_MIN_RESULTS = 5

export type JobSearchTier = 'phrase' | 'and' | 'or'

// websearch_to_tsquery treats a double-quoted span as a literal phrase —
// any operator characters inside the quotes (including a literal `"`,
// `-`, or the word `or`) lose their special meaning. Stripping stray `"`
// before re-wrapping means the caller's term can never break out of the
// phrase or inject an unintended operator. Returns null for an
// empty/whitespace-only term (nothing to search on) rather than a
// degenerate `""` that would mean "no filter" to the RPC.
export function buildPhraseQuery(term: string): string | null {
  const cleaned = term.replace(/"/g, '').trim()
  return cleaned ? `"${cleaned}"` : null
}

// The plain (AND) form: still strip stray `"` (would otherwise turn part
// of the term into an unintended phrase) and a leading `-` on any word
// (websearch_to_tsquery's negation operator) so the term can't accidentally
// exclude results the user typed in good faith.
export function buildAndQuery(term: string): string | null {
  const cleaned = term
    .replace(/"/g, '')
    .split(/\s+/)
    .map(w => w.replace(/^-+/, ''))
    .filter(Boolean)
    .join(' ')
    .trim()
  return cleaned ? cleaned : null
}

// Given the row counts already fetched for the phrase and and tiers (run in
// parallel by the caller — see route.ts), decides which tier's rows/count
// to actually use. Never mixes a count from one tier with rows from
// another — the caller must apply this decision to the query it names.
export function pickJobSearchTier(
  counts: { phraseTotal: number; andTotal: number },
  minResults: number = JOB_SEARCH_MIN_RESULTS,
): JobSearchTier {
  if (counts.phraseTotal >= minResults) return 'phrase'
  if (counts.andTotal >= minResults) return 'and'
  return 'or'
}
