import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// SEO-1 S5 (owner decisions D347, D348 item 17, D350): learners need no
// account and no progress is tracked for practice questions, so the pages
// say exactly that. Each changed sentence is pinned; the old one is gone.

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('free courses card', () => {
  const src = read('app/free-courses/page.tsx')
  it('new body, same title', () => {
    expect(src).toContain("{ title: 'No registration required',          body: 'Start any course right now. Your progress is active. No account needed.' },")
    expect(src).not.toContain('Create a free account to save your progress.')
  })
})

describe('Terms section 3', () => {
  const src = read('app/terms/page.tsx')
  it('same id, new title and the two new sentences', () => {
    expect(src).toContain([
      "    id: 'accounts',",
      "    title: '3. Registration',",
      '    body: [',
      "      'You do not need an account to use our learning content. If you register as a job seeker, employer or firm, you are responsible for keeping your login details secure and for all activity under your registration.',",
      "      'You must provide accurate information when registering. We reserve the right to suspend or remove registrations that provide false information or that breach these Terms.',",
      '    ],',
    ].join('\n'))
    expect(src).not.toContain('3. Accounts and registration')
    expect(src).not.toContain('you must create a free account')
    expect(src).not.toContain('suspend or terminate accounts')
  })
})

describe('home page practice blocks (both brands)', () => {
  const src = read('app/page.tsx')
  it('the two intro sentences end "Walk into the exam room ready."', () => {
    expect(src).toContain('ETICPA, ACCA, CIMA and AAT question banks. Exam-standard MCQs with instant marking and detailed explanations. Walk into the exam room ready.')
    expect(src).toContain('MCQs, written tasks and full mock exams for ACCA, CIMA, AAT and ICAEW. Instant marking with detailed explanations. Walk into the exam room ready.')
    expect(src).not.toContain('Track your progress')
  })
  it('the progress cards become "Practise by topic"', () => {
    expect(src).toContain("              title: 'Practise by topic',\n              body: 'Choose any topic and practise as many questions as you like, as often as you like.',")
    expect(src).toContain("                    title: 'Practise by topic',\n                    body: 'Choose any topic and practise as often as you like.',")
    expect(src).not.toContain('See which topics you have mastered')
  })
  it('the "Free to start" cards become "Free forever"', () => {
    expect(src).toContain("              title: 'Free forever — no account needed',\n              body: 'Every question bank, study note and the full glossary is free. No account, no credit card.',")
    expect(src).toContain("                    title: 'Free forever',\n                    body: 'Every question bank is free. No account, no credit card.',")
    expect(src).not.toContain('Core question banks permanently free')
    expect(src).not.toContain("title: 'Free to start")
  })
})
