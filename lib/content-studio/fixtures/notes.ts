// Invented study notes for the Content Studio's tests. The text is the
// engine's own invented fixture note; no real article is used.
import { SOURCE_HTML } from '@/lib/content-engine/fixtures/briefs'
import type { StudyNote } from '../note'

export const NOTE_ROW = {
  content_id: 'AB-ART-00042',
  title: 'Accruals at a small manufacturer',
  slug: 'invented-accruals-note',
  category: 'financial-accounting',
  category_title: 'Financial Accounting',
  eticpa_level: null,
  eticpa_module: null,
  content: SOURCE_HTML,
  status: 'published',
}

export const TAX_ROW = {
  ...NOTE_ROW,
  content_id: 'AB-ART-00043',
  title: 'Timing of invented tax deductions',
  slug: 'invented-tax-note',
  category: 'taxation',
  category_title: 'Taxation',
}

export const ETICPA_ROW = {
  ...NOTE_ROW,
  content_id: 'AB-ART-00044',
  title: 'Invented introduction to accruals',
  slug: 'invented-eticpa-note',
  eticpa_level: 'level-1',
  eticpa_module: 'introduction-to-accounting',
}

export function noteOf(row: typeof NOTE_ROW | typeof TAX_ROW | typeof ETICPA_ROW, setTitle: string | null = null): StudyNote {
  return {
    contentId: row.content_id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    categoryTitle: row.category_title,
    eticpaLevel: row.eticpa_level,
    eticpaModule: row.eticpa_module,
    html: row.content,
    setTitle,
  }
}
