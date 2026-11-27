// lib/practice-list.ts — small rules for the public /practice-questions list
// page (app/practice-questions/page.tsx), kept framework-free for tests.

// The page number from the address: a whole number of 1 or more, written in
// digits only. Anything else (letters, decimals, signs, empty, a list, a
// number too large to count exactly) is page 1.
export function parseListPage(raw: unknown): number {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

// The levels the filter offers: only those with at least one live set, in
// the given order. Without counts (a failed read) every level is offered.
export function visibleDifficulties(
  levels: readonly string[],
  counts: Record<string, number> | null,
): string[] {
  if (!counts) return [...levels]
  return levels.filter((level) => (counts[level] ?? 0) > 0)
}

// The subject from the address: one of the given subjects, by exact slug.
// Anything else (unknown, empty, other case, a list) is no subject.
export function pickSubject<S extends { slug: string }>(subjects: readonly S[], raw: unknown): S | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined
  return subjects.find((s) => s.slug === raw)
}

// The subjects the filter offers: only those with at least one live set, in
// the given order.
export function visibleSubjects<S extends { slug: string; title: string; category: string }>(
  subjects: readonly S[],
  setIds: Record<string, string[]>,
): { slug: string; title: string }[] {
  return subjects
    .filter((s) => (setIds[s.category]?.length ?? 0) > 0)
    .map((s) => ({ slug: s.slug, title: s.title }))
}
