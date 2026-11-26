// lib/llms-txt.ts — the text of /llms.txt, a plain-English map of the site
// for AI tools (owner decisions D348 item 1 and D350 D), built from the
// llmstxt.org shape: an H1, a blockquote summary, then H2 sections of
// "- [Name](URL): note" links. Each brand gets its own file, naming only its
// own pages on its own domain. Pure: the route reads the counts.
import { AB_URL, ET_URL } from '@/lib/canonical'
import { MOCK_EXAM_SUBJECTS, type MockExamSubject } from '@/lib/mock-exam-subjects'

export interface LlmsCounts {
  articles:  number
  sets:      number
  questions: number
  courses:   number
  lessons:   number
}

type Link = readonly [name: string, path: string, note?: string]
type Section = readonly [heading: string, links: readonly Link[]]

const fmt = (n: number) => n.toLocaleString('en-GB')
// A count of 0 means the read failed (the readers return 0 then): the
// sentence is written without the number rather than with a wrong one.
const count = (n: number, words: string) => (n > 0 ? `${fmt(n)} ${words}` : words)

// The mock-exam subjects to list: the route passes the open ones
// (lib/mock-exam-subjects.ts); a subject still "Coming soon" is left out.
type MockExams = readonly Pick<MockExamSubject, 'title' | 'slug'>[]

function abSections(c: LlmsCounts, mockExams: MockExams): readonly Section[] {
  return [
    ['Study by qualification', [
      ['Study hub', '/study', 'every study topic, by qualification'],
      ['ACCA', '/study/acca', 'study notes for ACCA students'],
      ['CIMA', '/study/cima', 'study notes for CIMA students'],
      ['AAT', '/study/aat', 'study notes for AAT students'],
      ['ICAEW', '/study/icaew', 'study notes for ICAEW students'],
      ['All articles', '/articles', 'the full list of study articles'],
    ]],
    ['Practice questions', [
      ['Practice questions', '/practice-questions', `${count(c.sets, 'free question sets')} with instant marking and explanations`],
    ]],
    ['Mock exams', [
      ['Mock exams', '/mock-exams', 'timed exams drawn from the question bank'],
      ...mockExams.map(({ title, slug }): Link => [title, `/mock-exams/${slug}`, 'mock exam']),
    ]],
    ['Free courses', [
      ['Free courses', '/free-courses', `${count(c.courses, 'structured courses')}${c.lessons > 0 ? `, ${fmt(c.lessons)} lessons` : ''}, no registration`],
    ]],
    ['Dictionary and glossary', [
      ['Accounting dictionary', '/dictionary', 'accounting terms A to Z, each with a short definition and a full article'],
      ['Glossary', '/glossary', 'terms grouped by subject'],
    ]],
    ['Calculators', [
      ['Accounting calculators', '/calculators', 'free instant calculators for accounting students; results update as you type'],
    ]],
    ['Jobs', [
      ['Jobs', '/jobs', 'accounting and finance jobs and managed recruitment'],
      ['Job listings', '/jobs/listings', 'live accounting and finance vacancies'],
      ['Register as a candidate', '/jobs/find-work', 'be matched to roles by our team'],
      ['Hire talent', '/jobs/hire-talent', 'for employers'],
      ['Post a job', '/jobs/post-a-job', 'for employers'],
    ]],
    ['Firms and freelancers', [
      ['Firms and freelancers', '/firms-freelancers', 'a network of accounting firms and freelancers'],
      ['Apply to join', '/firms-freelancers/join', 'for firms and freelancers'],
      ['Freelancing pathways', '/freelancing-pathways', 'for accountants starting to freelance'],
    ]],
    ['Get help', [
      ['Get help', '/get-help', 'professional services for businesses'],
      ['Global payroll', '/global-payroll', 'payroll and entity set-up in other countries'],
    ]],
    ['About and contact', [
      ['About', '/about'],
      ['Contact', '/contact', 'info@accountingbody.com'],
    ]],
    ['Optional', [
      ['Site map', '/sitemap.xml', 'every address, machine-readable'],
      ['Terms', '/terms'],
      ['Privacy policy', '/privacy-policy'],
      ['Accessibility', '/accessibility'],
    ]],
  ]
}

const ET_SECTIONS: readonly Section[] = [
  ['Services', [
    ['Get help', '/get-help', 'accounting, tax and business services'],
    ['Tax filing and compliance', '/get-help/tax-filing-compliance'],
    ['Accounting and bookkeeping', '/get-help/accounting-bookkeeping'],
    ['Business consulting', '/get-help/business-consulting'],
    ['Payroll services', '/get-help/payroll-services'],
    ['Company formation', '/get-help/company-formation'],
    ['Audit and assurance', '/get-help/audit-assurance'],
    ['Financial planning and advisory', '/get-help/financial-planning-advisory'],
    ['How it works', '/how-it-works'],
  ]],
  ['ETICPA study', [
    ['ETICPA', '/study/eticpa', 'study notes for the Ethiopian professional accountancy exams'],
    ['ATQ Level 1', '/study/eticpa/atq/level-1', 'study notes by module'],
    ['ATQ Level 2', '/study/eticpa/atq/level-2', 'study notes by module'],
    ['CPA', '/study/eticpa/cpa'],
    ['Mock exams', '/study/mock-exams', 'ETICPA ATQ mock exams'],
  ]],
  ['Firms and freelancers', [
    ['Firms and freelancers', '/firms-freelancers', 'a network of accounting firms and freelancers'],
    ['Apply to join', '/firms-freelancers/join', 'for firms and freelancers'],
  ]],
  ['About', [
    ['About EthioTax', '/about-ethiotax'],
    ['FAQ', '/faq'],
  ]],
  ['Optional', [
    ['Terms', '/terms'],
  ]],
]

function sectionLines(base: string, sections: readonly Section[]): string[] {
  return sections.flatMap(([heading, links]) => [
    '',
    `## ${heading}`,
    '',
    ...links.map(([name, path, note]) => `- [${name}](${base}${path})${note ? `: ${note}` : ''}`),
  ])
}

export function buildLlmsTxt(isEthioTax: boolean, c: LlmsCounts, mockExams: MockExams = MOCK_EXAM_SUBJECTS): string {
  if (isEthioTax) {
    return [
      '# EthioTax',
      '',
      '> Accounting, tax and business consulting for the Ethiopian community in the UK and worldwide, plus free ETICPA study notes and mock exams. All learning is free and needs no account.',
      ...sectionLines(ET_URL, ET_SECTIONS),
      '',
    ].join('\n')
  }
  const questions = c.questions > 0 ? ` with ${fmt(c.questions)} exam-style questions` : ' with exam-style questions'
  const lessons = c.lessons > 0 ? ` with ${fmt(c.lessons)} lessons` : ''
  return [
    '# Accounting Body',
    '',
    '> Free study notes, practice questions, mock exams and courses for accounting students preparing for ACCA, CIMA, AAT and ICAEW exams, plus accounting and finance jobs, a network of firms and freelancers, and professional help for businesses. All learning is free and needs no account.',
    '',
    `Accounting Body publishes ${count(c.articles, 'study articles')} written or reviewed by qualified accountants, ${count(c.sets, 'practice question sets')}${questions} and worked explanations, timed mock exams, and ${count(c.courses, 'free courses')}${lessons}. Course progress is kept in the learner's own browser.`,
    ...sectionLines(AB_URL, abSections(c, mockExams)),
    '',
  ].join('\n')
}
