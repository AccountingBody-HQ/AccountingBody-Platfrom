// lib/courses.ts
// Types, Sanity fetching, and placeholder data for the course system

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  _id: string
  question: string
  options: string[]
  correctAnswer: number   // 0-indexed
  explanation?: string
}

export interface LinkedArticle {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  examBody?: string
  category?: string
  readTime?: number
  videoUrl?: string       // if article body contains a YouTube/Vimeo URL
}

export interface Lesson {
  _id: string
  title: string
  slug: { current: string }
  lessonNumber: number
  estimatedTime: number   // minutes
  videoUrl?: string
  audioUrl?: string
  articles: LinkedArticle[]
  quizQuestions?: QuizQuestion[]
  externalQuizUrl?: string
}

export interface Course {
  _id: string
  title: string
  slug: { current: string }
  description: string
  longDescription?: string
  examBody: string
  level: 'Foundational' | 'Intermediate' | 'Advanced' | 'Professional'
  estimatedTime: number   // total minutes
  courseOrder: number
  lessons: Lesson[]
  tags?: string[]
}

// ── Sanity fetch ──────────────────────────────────────────────────────────────
// When Sanity is live, this will return real data.
// Falls back to placeholder data gracefully if not yet configured.

export async function getCourses(): Promise<Course[]> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
    if (!projectId) return placeholderCourses

    const query = encodeURIComponent(`
      *[_type == "course"] | order(courseOrder asc) {
        _id, title, slug, description, longDescription,
        examBody, level, estimatedTime, courseOrder, tags,
        "lessons": lessons[]-> {
          _id, title, slug, lessonNumber, estimatedTime,
          videoUrl, audioUrl, externalQuizUrl,
          "articles": articles[]-> {
            _id, title, slug, excerpt, examBody, category, readTime, videoUrl
          },
          "quizQuestions": quizQuestions[] {
            _id, question, options, correctAnswer, explanation
          }
        }
      }
    `)

    const res = await fetch(
      `https://${projectId}.apicdn.sanity.io/v2023-05-03/data/query/${dataset}?query=${query}`,
      { next: { revalidate: 3600 }, headers: process.env.SANITY_API_TOKEN ? { Authorization: `Bearer ${process.env.SANITY_API_TOKEN}` } : {} }
    )

    if (!res.ok) return placeholderCourses
    const data = await res.json()
    return data.result?.length ? data.result : placeholderCourses
  } catch {
    return placeholderCourses
  }
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const courses = await getCourses()
  return courses.find(c => c.slug.current === slug) ?? null
}

export async function getLessonBySlug(
  courseSlug: string,
  lessonSlug: string
): Promise<{ course: Course; lesson: Lesson; prevLesson: Lesson | null; nextLesson: Lesson | null } | null> {
  const course = await getCourseBySlug(courseSlug)
  if (!course) return null

  const sorted  = [...course.lessons].sort((a, b) => a.lessonNumber - b.lessonNumber)
  const idx     = sorted.findIndex(l => l.slug.current === lessonSlug)
  if (idx === -1) return null

  return {
    course,
    lesson:     sorted[idx],
    prevLesson: idx > 0 ? sorted[idx - 1] : null,
    nextLesson: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export function levelColour(level: Course['level']) {
  return {
    Foundational: { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
    Intermediate: { bg: 'bg-gold-50',   text: 'text-gold-600',   border: 'border-gold-200' },
    Advanced:     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    Professional: { bg: 'bg-navy-50',   text: 'text-navy-700',   border: 'border-navy-200' },
  }[level]
}

export function examBodyColour(body: string) {
  return {
    ACCA:  'bg-[#004B8D]',
    CIMA:  'bg-[#0081C6]',
    AAT:   'bg-[#00857A]',
    ICAEW: 'bg-[#C8102E]',
  }[body] ?? 'bg-navy-950'
}

// ── Placeholder data ──────────────────────────────────────────────────────────

export const placeholderCourses: Course[] = [
  {
    _id: 'c1',
    title: 'ACCA F3 — Financial Accounting',
    slug: { current: 'acca-f3-financial-accounting' },
    description: 'Master double entry, financial statements, and consolidation from scratch. The definitive ACCA F3 course.',
    longDescription: 'This course covers the entire ACCA F3 (now FA) syllabus in a structured, exam-focused way. Starting from the fundamentals of double entry bookkeeping, you will work through trial balances, year-end adjustments, financial statements for sole traders and companies, and an introduction to group accounts. Every lesson is mapped directly to the ACCA examining team\'s learning outcomes.',
    examBody: 'ACCA',
    level: 'Foundational',
    estimatedTime: 180,
    courseOrder: 1,
    tags: ['double entry', 'financial statements', 'trial balance', 'consolidation'],
    lessons: [
      {
        _id: 'l1',
        title: 'The Accounting Equation and Double Entry',
        slug: { current: 'accounting-equation-double-entry' },
        lessonNumber: 1,
        estimatedTime: 45,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        articles: [
          {
            _id: 'a1',
            title: 'What is the Accounting Equation? A Complete Guide',
            slug: { current: 'accounting-equation-guide' },
            excerpt: 'Assets = Liabilities + Equity. This simple equation underpins every transaction in accounting. Here\'s how it works in practice.',
            examBody: 'ACCA',
            category: 'Financial Accounting',
            readTime: 7,
          },
          {
            _id: 'a2',
            title: 'Double Entry Bookkeeping: Debits and Credits Explained',
            slug: { current: 'double-entry-debits-credits' },
            excerpt: 'Every transaction has two sides. Master debits and credits with step-by-step examples and memory tricks.',
            examBody: 'ACCA',
            category: 'Financial Accounting',
            readTime: 10,
          },
        ],
        quizQuestions: [
          {
            _id: 'q1',
            question: 'A business purchases equipment for £5,000 cash. Which of the following correctly records this transaction?',
            options: [
              'Dr Equipment £5,000 / Cr Cash £5,000',
              'Dr Cash £5,000 / Cr Equipment £5,000',
              'Dr Expense £5,000 / Cr Cash £5,000',
              'Dr Cash £5,000 / Cr Revenue £5,000',
            ],
            correctAnswer: 0,
            explanation: 'Equipment (an asset) increases — debit. Cash (an asset) decreases — credit. Both sides of the accounting equation remain balanced.',
          },
          {
            _id: 'q2',
            question: 'If total assets are £120,000 and total liabilities are £45,000, what is equity?',
            options: ['£165,000', '£75,000', '£45,000', '£120,000'],
            correctAnswer: 1,
            explanation: 'Equity = Assets − Liabilities = £120,000 − £45,000 = £75,000.',
          },
          {
            _id: 'q3',
            question: 'Which of the following is a debit entry?',
            options: [
              'Increase in a liability account',
              'Increase in an asset account',
              'Increase in equity',
              'Increase in revenue',
            ],
            correctAnswer: 1,
            explanation: 'DEAD CLIC: Debit = Expenses, Assets, Drawings. Increases in asset accounts are always debits.',
          },
        ],
      },
      {
        _id: 'l2',
        title: 'The Trial Balance and Year-End Adjustments',
        slug: { current: 'trial-balance-year-end-adjustments' },
        lessonNumber: 2,
        estimatedTime: 55,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        articles: [
          {
            _id: 'a3',
            title: 'How to Prepare a Trial Balance: Step-by-Step',
            slug: { current: 'prepare-trial-balance' },
            excerpt: 'A trial balance checks that debits equal credits after all journal entries. Learn to prepare and use one confidently.',
            examBody: 'ACCA',
            category: 'Financial Accounting',
            readTime: 8,
          },
          {
            _id: 'a4',
            title: 'Accruals and Prepayments: A Plain English Guide',
            slug: { current: 'accruals-prepayments-guide' },
            excerpt: 'The accruals concept is the most-tested topic in F3. This guide explains it with worked examples from past papers.',
            examBody: 'ACCA',
            category: 'Financial Accounting',
            readTime: 12,
          },
        ],
        quizQuestions: [
          {
            _id: 'q4',
            question: 'A company pays £12,000 for a one-year insurance policy on 1 October. Its year end is 31 December. What is the prepayment?',
            options: ['£3,000', '£9,000', '£12,000', '£1,000'],
            correctAnswer: 1,
            explanation: '£12,000 × 9/12 = £9,000 relates to the future period (Jan–Sep). This is the prepayment carried forward on the balance sheet.',
          },
        ],
        externalQuizUrl: 'https://accountingbody.com/practice-questions?topic=trial-balance',
      },
      {
        _id: 'l3',
        title: 'Preparing the Financial Statements',
        slug: { current: 'preparing-financial-statements' },
        lessonNumber: 3,
        estimatedTime: 60,
        articles: [
          {
            _id: 'a5',
            title: 'Income Statement vs Statement of Financial Position: Key Differences',
            slug: { current: 'income-statement-vs-balance-sheet' },
            excerpt: 'Two statements, two purposes. This guide shows exactly how they connect and what goes where.',
            examBody: 'ACCA',
            category: 'Financial Reporting',
            readTime: 9,
          },
        ],
        quizQuestions: [
          {
            _id: 'q5',
            question: 'Where does depreciation appear in the financial statements?',
            options: [
              'Only on the income statement',
              'Only on the statement of financial position',
              'On both the income statement (as an expense) and the SOFP (reducing the asset)',
              'It does not appear in the financial statements',
            ],
            correctAnswer: 2,
            explanation: 'Depreciation is an expense in the income statement (reducing profit) and is deducted from the asset\'s carrying amount on the statement of financial position.',
          },
        ],
      },
    ],
  },
  {
    _id: 'c2',
    title: 'ACCA PM (F5) — Performance Management',
    slug: { current: 'acca-pm-f5-performance-management' },
    description: 'Costing techniques, budgeting, variance analysis, and performance measurement. Everything for ACCA PM.',
    longDescription: 'ACCA PM builds on the management accounting concepts introduced at the foundation level. This course covers marginal and absorption costing, activity-based costing, budgeting and standard costing, variance analysis, and performance measurement frameworks including the Balanced Scorecard. It is structured around the ACCA examining team\'s learning outcomes.',
    examBody: 'ACCA',
    level: 'Intermediate',
    estimatedTime: 210,
    courseOrder: 2,
    tags: ['marginal costing', 'budgeting', 'variance analysis', 'balanced scorecard'],
    lessons: [
      {
        _id: 'l4',
        title: 'Marginal vs Absorption Costing',
        slug: { current: 'marginal-vs-absorption-costing' },
        lessonNumber: 1,
        estimatedTime: 50,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        articles: [
          {
            _id: 'a6',
            title: 'Marginal Costing vs Absorption Costing: Which Gives Higher Profit?',
            slug: { current: 'marginal-vs-absorption-costing-profit' },
            excerpt: 'The classic ACCA exam question. Learn exactly when each method gives higher profit — and why.',
            examBody: 'ACCA',
            category: 'Management Accounting',
            readTime: 11,
          },
        ],
        quizQuestions: [
          {
            _id: 'q6',
            question: 'Under absorption costing, fixed production overheads are treated as:',
            options: [
              'Period costs expensed immediately',
              'Product costs included in inventory valuation',
              'Excluded from the cost of production',
              'Variable costs matched to revenue',
            ],
            correctAnswer: 1,
            explanation: 'Absorption costing treats fixed production overheads as product costs — they are absorbed into inventory and only expensed when the inventory is sold.',
          },
        ],
      },
      {
        _id: 'l5',
        title: 'Standard Costing and Variance Analysis',
        slug: { current: 'standard-costing-variance-analysis' },
        lessonNumber: 2,
        estimatedTime: 65,
        articles: [
          {
            _id: 'a7',
            title: 'How to Calculate Material Variances: Complete Guide with Worked Examples',
            slug: { current: 'material-variances-guide' },
            excerpt: 'Price variance, usage variance, mix variance, yield variance — all explained with step-by-step exam solutions.',
            examBody: 'ACCA',
            category: 'Management Accounting',
            readTime: 15,
          },
        ],
        quizQuestions: [
          {
            _id: 'q7',
            question: 'The material price variance is calculated as:',
            options: [
              '(Standard quantity – Actual quantity) × Standard price',
              '(Standard price – Actual price) × Actual quantity purchased',
              '(Standard price – Actual price) × Standard quantity',
              'Actual cost – Budgeted cost',
            ],
            correctAnswer: 1,
            explanation: 'MPV = (SP − AP) × AQ purchased. A positive result = favourable (we paid less than standard).',
          },
        ],
        externalQuizUrl: 'https://accountingbody.com/practice-questions?topic=variance-analysis',
      },
      {
        _id: 'l6',
        title: 'Performance Measurement and the Balanced Scorecard',
        slug: { current: 'performance-measurement-balanced-scorecard' },
        lessonNumber: 3,
        estimatedTime: 55,
        articles: [
          {
            _id: 'a8',
            title: 'The Balanced Scorecard Explained: Four Perspectives with Examples',
            slug: { current: 'balanced-scorecard-explained' },
            excerpt: 'Kaplan and Norton\'s Balanced Scorecard is a staple of the ACCA PM exam. Here is how to apply it under exam conditions.',
            examBody: 'ACCA',
            category: 'Management Accounting',
            readTime: 10,
          },
        ],
        quizQuestions: [
          {
            _id: 'q8',
            question: 'Which perspective of the Balanced Scorecard asks: "How do customers see us?"',
            options: ['Financial', 'Internal business process', 'Customer', 'Learning and growth'],
            correctAnswer: 2,
            explanation: 'The Customer perspective focuses on how customers perceive the business — measures include satisfaction, retention, and market share.',
          },
        ],
      },
    ],
  },
  {
    _id: 'c3',
    title: 'CIMA BA1 — Fundamentals of Business Economics',
    slug: { current: 'cima-ba1-business-economics' },
    description: 'Macroeconomics, microeconomics, and the business environment — everything for the CIMA BA1 objective test.',
    longDescription: 'CIMA BA1 introduces the economic environment in which businesses operate. This course covers supply and demand, market structures, macroeconomic policy, the global economy, and information systems — all mapped to the CIMA BA1 objective test syllabus.',
    examBody: 'CIMA',
    level: 'Foundational',
    estimatedTime: 150,
    courseOrder: 3,
    tags: ['microeconomics', 'macroeconomics', 'market structures', 'business environment'],
    lessons: [
      {
        _id: 'l7',
        title: 'Supply, Demand, and Market Equilibrium',
        slug: { current: 'supply-demand-market-equilibrium' },
        lessonNumber: 1,
        estimatedTime: 50,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        articles: [
          {
            _id: 'a9',
            title: 'Supply and Demand: The Complete CIMA BA1 Guide',
            slug: { current: 'supply-demand-cima-ba1' },
            excerpt: 'Price elasticity, shifts in curves, market equilibrium — all the BA1 economics concepts you need with exam-ready diagrams.',
            examBody: 'CIMA',
            category: 'Business Economics',
            readTime: 9,
          },
        ],
        quizQuestions: [
          {
            _id: 'q9',
            question: 'If the price elasticity of demand for a product is −2.5, the demand is:',
            options: ['Inelastic', 'Elastic', 'Perfectly inelastic', 'Unit elastic'],
            correctAnswer: 1,
            explanation: 'When |PED| > 1, demand is elastic — a 1% price increase causes a greater than 1% fall in quantity demanded.',
          },
        ],
      },
      {
        _id: 'l8',
        title: 'Macroeconomic Policy and the Global Economy',
        slug: { current: 'macroeconomic-policy-global-economy' },
        lessonNumber: 2,
        estimatedTime: 55,
        articles: [
          {
            _id: 'a10',
            title: 'Fiscal Policy vs Monetary Policy: Key Differences for CIMA',
            slug: { current: 'fiscal-policy-vs-monetary-policy-cima' },
            excerpt: 'Governments and central banks both influence the economy — but through very different tools. Here is what CIMA tests.',
            examBody: 'CIMA',
            category: 'Business Economics',
            readTime: 8,
          },
        ],
        quizQuestions: [
          {
            _id: 'q10',
            question: 'Which of the following is an example of monetary policy?',
            options: [
              'Increasing government spending on infrastructure',
              'Raising the base interest rate',
              'Introducing a new income tax band',
              'Reducing corporation tax',
            ],
            correctAnswer: 1,
            explanation: 'Monetary policy is controlled by the central bank and involves interest rates and money supply. Fiscal policy involves government taxation and spending.',
          },
        ],
        externalQuizUrl: 'https://accountingbody.com/practice-questions?topic=macroeconomics',
      },
    ],
  },
  {
    _id: 'c4',
    title: 'AAT Level 3 — Financial Accounting: Preparing Financial Statements',
    slug: { current: 'aat-level-3-financial-accounting-preparing-financial-statements' },
    description: 'Prepare complete financial statements for sole traders and partnerships. The core AAT Level 3 accounting unit.',
    longDescription: 'This course covers the AAT Level 3 Financial Accounting unit (FAPS). You will learn to prepare financial statements for sole traders and partnerships from incomplete records, account for accruals, prepayments, depreciation, and irrecoverable debts, and complete final accounts adjustments to professional standard.',
    examBody: 'AAT',
    level: 'Intermediate',
    estimatedTime: 160,
    courseOrder: 4,
    tags: ['sole trader', 'partnership accounts', 'incomplete records', 'depreciation'],
    lessons: [
      {
        _id: 'l9',
        title: 'Incomplete Records and Reconstructing Accounts',
        slug: { current: 'incomplete-records-reconstructing-accounts' },
        lessonNumber: 1,
        estimatedTime: 55,
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        articles: [
          {
            _id: 'a11',
            title: 'Incomplete Records: How to Find Missing Figures',
            slug: { current: 'incomplete-records-missing-figures' },
            excerpt: 'When a sole trader has no complete accounting records, you need to reconstruct them. Here is the systematic approach.',
            examBody: 'AAT',
            category: 'Financial Accounting',
            readTime: 11,
          },
        ],
        quizQuestions: [
          {
            _id: 'q11',
            question: 'A business has opening capital of £20,000, drawings of £8,000, and profit for the year of £15,000. What is closing capital?',
            options: ['£27,000', '£43,000', '£13,000', '£35,000'],
            correctAnswer: 0,
            explanation: 'Closing capital = Opening capital + Profit − Drawings = £20,000 + £15,000 − £8,000 = £27,000.',
          },
        ],
      },
      {
        _id: 'l10',
        title: 'Partnership Accounts: Appropriation and Current Accounts',
        slug: { current: 'partnership-accounts-appropriation' },
        lessonNumber: 2,
        estimatedTime: 60,
        articles: [
          {
            _id: 'a12',
            title: 'Partnership Appropriation Account: Step-by-Step with Examples',
            slug: { current: 'partnership-appropriation-account' },
            excerpt: 'Salaries, interest on capital, and profit sharing — the partnership appropriation account brings them all together.',
            examBody: 'AAT',
            category: 'Financial Accounting',
            readTime: 13,
          },
        ],
        quizQuestions: [
          {
            _id: 'q12',
            question: 'In a partnership, interest on capital is:',
            options: [
              'An expense in the income statement',
              'An appropriation of profit in the appropriation account',
              'Charged to the partners\' capital accounts',
              'Added to revenue in the income statement',
            ],
            correctAnswer: 1,
            explanation: 'Interest on capital is NOT an expense — it is an appropriation of profit. It appears in the appropriation account, not the income statement.',
          },
        ],
        externalQuizUrl: 'https://accountingbody.com/practice-questions?topic=partnership-accounts',
      },
    ],
  },
]