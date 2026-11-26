// lib/mock-exam-subjects.ts — the ONE list of Accounting Body mock-exam
// subjects, used by the /mock-exams hub, each subject page, the pages sitemap
// and /llms.txt, and the five live ETICPA mock-exam modules counted on /study.
//
// A subject is open when its question pool (lib/mock-exam-pool.ts) holds at
// least MOCK_EXAM_OPEN_MIN questions; otherwise it is shown as "Coming soon"
// and left out of the sitemap and llms.txt. When the pool cannot be read,
// the subject is treated as open, as it was before this list existed, so a
// database problem never hides a working exam.
import { getAbMockPoolSize, getEticpaMockPoolSize } from '@/lib/mock-exam-pool'

export const MOCK_EXAM_OPEN_MIN = 50

export interface MockExamSubject {
  /** The address part: /mock-exams/<slug>. */
  slug: string
  title: string
  /** Key of the subject's icon on the hub. */
  icon: string
  /** The article category whose question sets make up the pool. */
  category: string
}

// In the hub's order.
export const MOCK_EXAM_SUBJECTS: readonly MockExamSubject[] = [
  { slug: 'financial-accounting',  title: 'Financial Accounting',  icon: 'ledger',       category: 'financial-accounting' },
  { slug: 'financial-management',  title: 'Financial Management',  icon: 'trend-up',     category: 'financial-management' },
  { slug: 'management-accounting', title: 'Management Accounting', icon: 'bar-chart',    category: 'management-accounting' },
  { slug: 'financial-market',      title: 'Financial Market',      icon: 'trend-down',   category: 'financial-market' },
  { slug: 'business-management',   title: 'Business Management',   icon: 'briefcase',    category: 'business-management' },
  { slug: 'audit-assurance',       title: 'Audit and Assurance',   icon: 'shield-check', category: 'audit-assurance' },
  { slug: 'taxation',              title: 'Tax',                   icon: 'cash',         category: 'taxation' },
  { slug: 'economics',             title: 'Economics',             icon: 'presentation', category: 'economics' },
]

export function findMockExamSubject(slug: string): MockExamSubject | undefined {
  return MOCK_EXAM_SUBJECTS.find(s => s.slug === slug)
}

/** Open unless the pool was read and holds fewer than 50 questions. */
export function isOpenPool(size: number | null): boolean {
  return size === null || size >= MOCK_EXAM_OPEN_MIN
}

export async function isMockExamSubjectOpen(subject: MockExamSubject): Promise<boolean> {
  return isOpenPool(await getAbMockPoolSize(subject.category))
}

/** Every subject with whether it is open, in the hub's order. */
export async function getMockExamSubjectStates(): Promise<{ subject: MockExamSubject; open: boolean }[]> {
  const sizes = await Promise.all(MOCK_EXAM_SUBJECTS.map(s => getAbMockPoolSize(s.category)))
  return MOCK_EXAM_SUBJECTS.map((subject, i) => ({ subject, open: isOpenPool(sizes[i]) }))
}

export async function getOpenMockExamSubjects(): Promise<MockExamSubject[]> {
  return (await getMockExamSubjectStates()).filter(s => s.open).map(s => s.subject)
}

// The live ETICPA mock-exam modules (app/study/mock-exams lists them with
// their pages); /study counts the open ones.
export const ETICPA_MOCK_MODULES: readonly { level: string; module: string }[] = [
  { level: 'level-1', module: 'introduction-to-accounting' },
  { level: 'level-1', module: 'cost-accounting' },
  { level: 'level-2', module: 'financial-accounting' },
  { level: 'level-2', module: 'management-accounting' },
  { level: 'level-2', module: 'assurance-controls-ethics' },
]

export async function getOpenEticpaModuleCount(): Promise<number> {
  const sizes = await Promise.all(ETICPA_MOCK_MODULES.map(m => getEticpaMockPoolSize(m.level, m.module)))
  return sizes.filter(isOpenPool).length
}
