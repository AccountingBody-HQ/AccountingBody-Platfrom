// Jurisdiction packs: rules only, no facts (owner decision D335). Every rate,
// threshold or date must come from the source note or the brief.
import type { Jurisdiction } from '../types'

export const JURISDICTION_PACKS: Readonly<Record<Jurisdiction, string>> = {
  'uk-ifrs': `JURISDICTION — UK AND IFRS:
- Use IFRS as the default reporting framework.
- Use UK tax or UK law only when the brief says the content is about UK tax or UK law.
- Tie every tax figure to the "valid as at" date in the brief and say so in the text.
- Never invent a rate, threshold or date: use only figures from the source note or the brief, or write around them.`,
  ethiopia: `JURISDICTION — ETHIOPIA:
- Use IFRS as adopted in Ethiopia only where the source note says so.
- Use Ethiopian tax, commercial law and public-sector rules ONLY as the source note or the brief states them.
- NEVER invent a rate, threshold, proclamation number or date.
- Tie every tax figure to the "valid as at" date in the brief and say so in the text.
- Take the ETICPA level and module from the brief.`,
}

/** The ETICPA modules open today, in the site's order (a test checks the site's own list). */
export const ETICPA_MODULES: readonly { level: string; module: string }[] = [
  { level: 'level-1', module: 'introduction-to-accounting' },
  { level: 'level-1', module: 'cost-accounting' },
  { level: 'level-2', module: 'financial-accounting' },
  { level: 'level-2', module: 'management-accounting' },
  { level: 'level-2', module: 'assurance-controls-ethics' },
]

/** The ETICPA levels. level-3 has no open module today. */
export const ETICPA_LEVELS: readonly string[] = ['level-1', 'level-2', 'level-3']
