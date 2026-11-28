// "What to make next": the empty mock-exam subjects first, their study notes
// taken in turn, then every other study note without a practice set.
import { readPaged, getAbMockPoolSize } from '@/lib/mock-exam-pool'
import { MOCK_EXAM_OPEN_MIN, MOCK_EXAM_SUBJECTS } from '@/lib/mock-exam-subjects'
import { reportServerError } from '@/lib/report-error'
import { getServerSupabase } from '@/lib/supabase-server'

/** Every ETICPA module page (level 1, then level 2, by address) with its visible title, then CPA. */
export const ETICPA_ALL_MODULES: readonly { level: string; module: string; title: string }[] = [
  { level: 'level-1', module: 'business-skills', title: 'Business Skills' },
  { level: 'level-1', module: 'cost-accounting', title: 'Cost Accounting' },
  { level: 'level-1', module: 'ethiopian-business-law', title: 'Ethiopian Business Law' },
  { level: 'level-1', module: 'introduction-to-accounting', title: 'Introduction to Accounting' },
  { level: 'level-2', module: 'assurance-controls-ethics', title: 'Assurance, Controls & Ethics' },
  { level: 'level-2', module: 'ethiopian-public-sector-accounting', title: 'Ethiopian Public Sector Accounting' },
  { level: 'level-2', module: 'ethiopian-taxation', title: 'Ethiopian Taxation' },
  { level: 'level-2', module: 'financial-accounting', title: 'Financial Accounting' },
  { level: 'level-2', module: 'management-accounting', title: 'Management Accounting' },
  { level: 'level-3', module: '', title: 'CPA' },
]

export interface PlanRow { contentId: string; title: string; subjectTitle: string }
export interface PlanSubject { slug: string; title: string; poolSize: number; notesWithoutSet: number }
export interface Plan { subjects: PlanSubject[]; queue1: PlanRow[]; queue2: PlanRow[]; eticpaMissing: string[] }

interface NoteRow {
  content_id: string | null
  title: string | null
  category: string | null
  category_title: string | null
  eticpa_level: string | null
  eticpa_module: string | null
  created_at: string | null
  slug: string | null
}

const NOTE_COLUMNS = 'content_id, title, category, category_title, eticpa_level, eticpa_module, created_at, slug'

function rowOf(note: NoteRow): PlanRow {
  return { contentId: note.content_id ?? '', title: note.title ?? '', subjectTitle: note.category_title || note.category || '' }
}

/** The ETICPA module title of a level and module, if it is one. */
export function moduleTitleOf(level: string | null, moduleSlug: string | null): string | null {
  if (!level || !moduleSlug) return null
  return ETICPA_ALL_MODULES.find(m => m.level === level && m.module === moduleSlug)?.title ?? null
}

/** Pure: the plan from the rows read (exported for tests). */
export function planFrom(notes: NoteRow[], setSlugs: (string | null)[], poolSizes: (number | null)[]): Plan {
  const withSet = new Set(setSlugs.filter((s): s is string => typeof s === 'string' && s !== ''))
  const without = notes.filter(n => !(n.slug && withSet.has(n.slug)))

  const subjects: PlanSubject[] = []
  const lists: NoteRow[][] = []
  MOCK_EXAM_SUBJECTS.forEach((subject, i) => {
    const size = poolSizes[i]
    if (typeof size !== 'number' || size >= MOCK_EXAM_OPEN_MIN) return
    const list = without.filter(n => n.category === subject.category)
    subjects.push({ slug: subject.slug, title: subject.title, poolSize: size, notesWithoutSet: list.length })
    lists.push(list)
  })

  const queue1: PlanRow[] = []
  for (let round = 0; lists.some(l => l.length > round); round++) {
    for (const list of lists) if (round < list.length) queue1.push(rowOf(list[round]))
  }
  const emptyCategories = new Set(MOCK_EXAM_SUBJECTS.filter(s => subjects.some(e => e.slug === s.slug)).map(s => s.category))
  const queue2 = without.filter(n => !(n.category && emptyCategories.has(n.category))).map(rowOf)

  const eticpaMissing = ETICPA_ALL_MODULES.filter(m =>
    !notes.some(n => n.eticpa_level === m.level && (m.level === 'level-3' || n.eticpa_module === m.module)),
  ).map(m => m.title)

  return { subjects, queue1, queue2, eticpaMissing }
}

export async function buildPlan(): Promise<{ ok: true; plan: Plan } | { ok: false }> {
  try {
    const supabase = getServerSupabase('admin')
    const notes = await readPaged<NoteRow>('articles', () =>
      supabase.from('articles').select(NOTE_COLUMNS, { count: 'exact' }).eq('status', 'published')
        .order('created_at', { ascending: true }).order('content_id', { ascending: true }))
    const sets = await readPaged<{ article_slug: string | null }>('question_sets', () =>
      supabase.from('question_sets').select('article_slug', { count: 'exact' }).order('id', { ascending: true }))
    const sizes = await Promise.all(MOCK_EXAM_SUBJECTS.map(s => getAbMockPoolSize(s.category)))
    return { ok: true, plan: planFrom(notes, sets.map(s => s.article_slug), sizes) }
  } catch (error) {
    reportServerError('admin content studio plan read failed', error, { area: 'admin' })
    return { ok: false }
  }
}
