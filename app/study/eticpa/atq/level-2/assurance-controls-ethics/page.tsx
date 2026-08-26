import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getETICPAModuleArticles } from '@/lib/db'
import { getCourseBySlug } from '@/lib/coursesNew'

export const revalidate = 3600

const MODULE = {
  level: 'level-2',
  slug: 'assurance-controls-ethics',
  name: 'Assurance, Controls & Ethics',
  description: 'Understand the external audit process from acceptance to reporting. Evaluate internal control systems, apply professional ethics, and develop the audit judgement required for the ETICPA ATQ Level 2 qualification.',
  outcomes: [
    'Explain the purpose of external audit and the regulatory framework governing auditors',
    'Apply professional ethics and independence requirements in practice',
    'Identify and assess audit risk and plan an audit engagement',
    'Evaluate internal control systems and identify weaknesses',
    'Gather and evaluate audit evidence using tests of controls and substantive procedures',
    'Complete the audit and communicate findings through the auditor\'s report',
  ],
  prevModule: { name: 'Management Accounting', href: '/study/eticpa/atq/level-2/management-accounting' },
  nextModule: { name: 'Ethiopian Taxation', href: '/study/eticpa/atq/level-2/ethiopian-taxation' },
}

const COURSE_SLUG = 'eticpa-atq-level-2-assurance-controls-ethics'
const totalQuestions = 3000

export default async function AssuranceControlsEthicsPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/study')

  const [articles, course] = await Promise.all([
    getETICPAModuleArticles(MODULE.level, MODULE.slug),
    getCourseBySlug(COURSE_SLUG),
  ])

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
            <Link href="/study/eticpa" className="hover:text-white/70 transition-colors"><span translate="no">ETICPA</span></Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa/atq/level-2" className="hover:text-white/70 transition-colors"><span translate="no"><span translate="no">ATQ Level 2</span></span></Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Assurance, Controls & Ethics</span>
          </nav>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold px-3 py-1.5 rounded-md" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}><span translate="no">ATQ Level 2</span></span>
              <span className="text-xs font-semibold text-white/50">Advanced Technician</span>
            </div>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Assurance, Controls
              <br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                & Ethics
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
                Assurance, Controls & Ethics is the third module of <span translate="no">ATQ Level 2</span>. It introduces the external audit process, internal control evaluation, and the professional ethics framework that underpins all assurance work.
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
                  { label: 'Qualification', value: 'ATQ — Accounting Technician Qualification', noTranslate: true },
                  { label: 'Level', value: 'Level 2 — Advanced Technician' },
                  { label: 'Module', value: 'Assurance, Controls & Ethics' },
                  { label: 'Study Notes', value: `${articles.length} published` },
                  { label: 'Mock Exam', value: `${totalQuestions}+ questions` },
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

      {/* COURSE STRUCTURE */}
      {course && course.chapters && course.chapters.length > 0 && (
        <section className="section bg-slate-50 border-t border-slate-100">
          <div className="container-site">
            <div className="max-w-2xl mb-12">
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Course Structure</span>
              <h2 className="section-title mb-4">How the course is organised</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                The course is structured into {course.chapters.length} units covering the full Assurance, Controls & Ethics syllabus.
              </p>
            </div>
            <div className="space-y-4">
              {course.chapters.map(chapter => (
                <div key={chapter.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100" style={{ backgroundColor: '#f0f7f4' }}>
                    <h3 className="font-semibold text-sm" style={{ color: '#1A4731' }}>{chapter.title}</h3>
                  </div>
                  {chapter.lessons && chapter.lessons.length > 0 && (
                    <div className="divide-y divide-slate-100">
                      {chapter.lessons.map((lesson, lessonIndex) => (
                        <Link key={lesson.id} href={`/free-courses/${COURSE_SLUG}/learn/${lesson.slug}`}
                          className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors group">
                          <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ borderColor: '#1A4731', color: '#1A4731' }}>{lessonIndex + 1}</span>
                          <span className="text-sm text-slate-700 group-hover:text-[#1A4731] transition-colors">{lesson.title}</span>
                          <svg className="w-4 h-4 ml-auto text-slate-300 group-hover:text-[#1A4731] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href={`/free-courses/${COURSE_SLUG}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#1A4731', color: 'white', height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Start Course
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* MOCK EXAM */}
      <section id="mock-exam" className="section border-t border-slate-100" style={{ backgroundColor: '#1A4731' }}>
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center">
            <span className="eyebrow mb-3 block" style={{ color: '#C9982A' }}>Mock Exam</span>
            <h2 className="font-display text-white mb-4" style={{ fontSize: '2rem' }}>Test your knowledge</h2>
            <p className="text-white/70 text-lg leading-relaxed mb-10">
              Practice with real exam-style questions drawn from the full Assurance, Controls & Ethics question pool.
            </p>
            <div className="grid grid-cols-3 gap-6 mb-10">
              {[
                { value: `${totalQuestions}+`, label: 'Questions in pool' },
                { value: '50', label: 'Per exam attempt' },
                { value: '\u221e', label: 'Unlimited attempts' },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-3xl font-bold mb-1" style={{ color: '#C9982A' }}><span translate="no"><span translate="no">{stat.value}</span></span></p>
                  <p className="text-white/50 text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link href="/study/eticpa/atq/level-2/assurance-controls-ethics/mock-exam"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Start Mock Exam
            </Link>
            <p className="text-white/40 text-xs mt-4 text-center mx-auto">
              Questions are added automatically as new practice sets are published.
            </p>
          </div>
        </div>
      </section>

      {/* NAVIGATION */}
      <section className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href={MODULE.prevModule.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 transition-colors"
              style={{ borderColor: '#1A4731', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
              Management Accounting
            </Link>
            <Link href={MODULE.nextModule.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#1A4731', color: 'white', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Ethiopian Taxation
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
