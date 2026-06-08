import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getETICPAModuleArticles } from '@/lib/sanity-queries'
import { getCourseBySlug } from '@/lib/coursesNew'

export const revalidate = 3600

const COURSE_SLUG = 'eticpa-atq-l1-introduction-to-accounting'

const MODULE = {
  level: 'level-1',
  slug: 'introduction-to-accounting',
  name: 'Introduction to Accounting',
  description: 'Master the core principles that underpin all of accounting. This module builds your understanding of the accounting equation, double-entry bookkeeping, and the preparation of basic financial statements — the essential foundation for every ETICPA qualification.',
  outcomes: [
    'Explain the accounting equation and its application to business transactions',
    'Record transactions using the double-entry bookkeeping system',
    'Prepare a trial balance from a set of ledger accounts',
    'Produce basic financial statements including the income statement and balance sheet',
    'Apply key accounting concepts and standards to practical scenarios',
  ],
  topics: [
    { name: 'The Accounting Equation', slug: 'the-accounting-equation' },
    { name: 'Double Entry Bookkeeping', slug: 'double-entry-bookkeeping' },
    { name: 'The Trial Balance', slug: 'the-trial-balance' },
    { name: 'Financial Statements', slug: 'financial-statements' },
    { name: 'Accounting Concepts & Standards', slug: 'accounting-concepts-and-standards' },
  ],
  nextModule: { name: 'Cost Accounting', href: '/study/eticpa/atq/level-1/cost-accounting' },
}

export default async function IntroductionToAccountingPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/study')

  const [articles, course] = await Promise.all([
    getETICPAModuleArticles(MODULE.level, MODULE.slug),
    getCourseBySlug(COURSE_SLUG),
  ])

  const totalArticles = articles.length
  const totalQuestions = 775

  return (
    <div>

      {/* HERO */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ backgroundColor: '#1A4731' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #C9982A 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa" className="hover:text-white/70 transition-colors">ETICPA</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa/atq/level-1" className="hover:text-white/70 transition-colors">ATQ Level 1</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Introduction to Accounting</span>
          </nav>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold px-3 py-1.5 rounded-md" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>ATQ Level 1</span>
              <span className="text-xs font-semibold text-white/50">Foundation Technician</span>
            </div>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Introduction to<br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Accounting
              </span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">{MODULE.description}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href={`/free-courses/${COURSE_SLUG}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Start Course
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="#mock-exam"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
                style={{ height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Take Mock Exam
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* OVERVIEW */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Module Overview</span>
              <h2 className="section-title mb-6">What this module covers</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Introduction to Accounting is the foundation module of ATQ Level 1. It establishes the core principles that every accounting professional must master before progressing to more advanced study.
              </p>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Learning Outcomes</p>
                {MODULE.outcomes.map((outcome, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                      <svg className="w-3 h-3" fill="none" stroke="#C9982A" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed">{outcome}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-8 border" style={{ backgroundColor: '#f0f7f4', borderColor: '#d1e8db' }}>
              <p className="font-display text-xl text-navy-950 mb-6">Module at a glance</p>
              <div className="space-y-4">
                {[
                  { label: 'Qualification', value: 'ATQ — Accounting Technician Qualification' },
                  { label: 'Level', value: 'Level 1 — Foundation Technician' },
                  { label: 'Module', value: 'Introduction to Accounting' },
                  { label: 'Topics', value: '5 core topics' },
                  { label: 'Study Notes', value: `${totalArticles} published` },
                  { label: 'Practice Questions', value: `${totalQuestions}+ questions` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-3 border-b border-white/60">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{item.label}</span>
                    <span className="text-sm font-semibold text-navy-950 text-right max-w-[60%]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOPICS */}
      <section id="topics" className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Syllabus</span>
            <h2 className="section-title mb-4">Core topics in this module</h2>
            <p className="text-slate-500 text-lg leading-relaxed">Five core topics make up Introduction to Accounting, progressing from foundational concepts to full financial statement preparation.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULE.topics.map((topic, i) => (
              <div key={topic.slug} className="flex items-center gap-4 p-5 rounded-xl bg-white border border-slate-200">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white" style={{ backgroundColor: '#1A4731' }}>{i + 1}</span>
                <p className="text-sm font-semibold text-navy-950">{topic.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSE STRUCTURE */}
      {course && (
        <section id="course-structure" className="section bg-white border-t border-slate-100">
          <div className="container-site">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Course Structure</span>
                <h2 className="section-title mb-4">Your learning path</h2>
                <p className="text-slate-500 text-lg leading-relaxed">
                  {course.chapterCount} units · {course.lessonCount} chapters · {totalArticles} study notes — structured as a progressive course from foundations to financial statements.
                </p>
              </div>
              <Link href={`/free-courses/${COURSE_SLUG}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold shrink-0 transition-colors"
                style={{ backgroundColor: '#1A4731', color: 'white', height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Start Course
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
            <div className="space-y-4 max-w-4xl">
              {course.chapters?.map((chapter, ci) => (
                <div key={chapter._key} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100" style={{ backgroundColor: '#f0f7f4' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ backgroundColor: '#1A4731' }}>{ci + 1}</div>
                    <div className="flex-1">
                      <h3 className="font-display text-navy-950 text-base">{chapter.chapterTitle}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{chapter.lessons?.length ?? 0} lessons</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 bg-white">
                    {chapter.lessons?.map((lesson, li) => (
                      <Link key={lesson._id}
                        href={`/free-courses/${COURSE_SLUG}/learn/${lesson.slug.current}`}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-xs text-slate-500 font-medium">{li + 1}</span>
                        </div>
                        <p className="text-sm font-medium text-navy-950 flex-1">{lesson.title}</p>
                        <span className="text-xs text-slate-400 shrink-0 group-hover:text-[#1A4731] transition-colors">Study →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MOCK EXAM */}
      <section id="mock-exam" className="section border-t border-slate-100" style={{ backgroundColor: '#1A4731' }}>
        <div className="container-site">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-md mb-6" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>Practice & Assessment</span>
            <h2 className="font-display text-white text-3xl md:text-4xl mb-6" style={{ letterSpacing: '-0.02em' }}>Test your knowledge</h2>
            <p className="text-white/70 text-lg leading-relaxed mb-10">
              Take a 50-question mock exam drawn randomly from our bank of {totalQuestions}+ practice questions — balanced across all topics. Every attempt gives you a fresh set of questions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {[
                { value: `${totalQuestions}+`, label: 'Questions in pool' },
                { value: '50', label: 'Questions per exam' },
                { value: '∞', label: 'Unique attempts' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <p className="font-display text-4xl mb-2" style={{ color: '#C9982A' }}>{stat.value}</p>
                  <p className="text-white/60 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link href="/study/eticpa/atq/level-1/introduction-to-accounting/mock-exam"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Start Mock Exam
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <p className="text-white/40 text-xs mt-4">More questions are added automatically as new practice sets are published.</p>
          </div>
        </div>
      </section>

      {/* NAVIGATION */}
      <section className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/study/eticpa/atq/level-1"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 transition-colors"
              style={{ borderColor: '#1A4731', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
              Back to Level 1
            </Link>
            <Link href={MODULE.nextModule.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#1A4731', color: 'white', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Next: {MODULE.nextModule.name}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
