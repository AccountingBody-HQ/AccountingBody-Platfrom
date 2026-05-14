// app/free-courses/page.tsx
// Accounting Body — Free Courses
// PRIMARY URL for all courses content. /study/courses, /courses, /course
// all 301 redirect here. This is the Google-indexed canonical page.

import Link from 'next/link'
import type { Metadata } from 'next'
import { client } from '@/lib/sanity'

export const metadata: Metadata = {
  title: 'Free Accounting Courses | Accounting Body',
  description: 'Free online accounting courses for ACCA, CIMA, ICAEW and AAT. Structured lessons, worked examples, and built-in practice questions. No signup required.',
}

// ── Sanity fetch ───────────────────────────────────────────────────────────────

interface SanityCourse {
  _id:          string
  title:        string
  slug:         { current: string }
  description?: string
  examBody?:    string
  level?:       string
  lessonCount?: number
  duration?:    string
  image?:       { asset: { url: string } }
}

async function getCourses(): Promise<SanityCourse[]> {
  try {
    return await client.fetch(
      `*[_type == "course"] | order(examBody asc, title asc) {
        _id, title, slug, description, examBody, level, lessonCount, duration,
        "image": image { asset -> { url } }
      }`,
      {},
      { next: { revalidate: 3600 } }
    )
  } catch {
    return []
  }
}

// ── Static course data (shown when Sanity has no courses yet) ──────────────────

const PLACEHOLDER_COURSES = [
  { _id: '1', title: 'ACCA BT — Business and Technology',        slug: { current: 'acca-bt' }, examBody: 'ACCA', level: 'Beginner',     lessonCount: 24, duration: '8 hrs',  description: 'The foundation of the ACCA qualification. Covers business structure, management, and technology.' },
  { _id: '2', title: 'ACCA MA — Management Accounting',          slug: { current: 'acca-ma' }, examBody: 'ACCA', level: 'Beginner',     lessonCount: 32, duration: '12 hrs', description: 'Costing, budgeting, and performance management at Applied Knowledge level.' },
  { _id: '3', title: 'ACCA FA — Financial Accounting',           slug: { current: 'acca-fa' }, examBody: 'ACCA', level: 'Beginner',     lessonCount: 36, duration: '14 hrs', description: 'Double entry, financial statements, and the conceptual framework.' },
  { _id: '4', title: 'CIMA E1 — Managing Finance in a Digital World', slug: { current: 'cima-e1' }, examBody: 'CIMA', level: 'Beginner', lessonCount: 28, duration: '10 hrs', description: 'The role of finance in organisations, data analytics, and digital transformation.' },
  { _id: '5', title: 'AAT Level 3 — Financial Accounting',       slug: { current: 'aat-l3-fa' }, examBody: 'AAT', level: 'Intermediate', lessonCount: 30, duration: '11 hrs', description: 'Financial statements for sole traders and partnerships at AAT Level 3.' },
  { _id: '6', title: 'AAT Level 3 — Management Accounting',      slug: { current: 'aat-l3-ma' }, examBody: 'AAT', level: 'Intermediate', lessonCount: 26, duration: '9 hrs',  description: 'Costing techniques, budgeting, and variance analysis for AAT Level 3.' },
]

const EXAM_BODY_ACCENT: Record<string, string> = {
  ACCA:  'bg-[#004B8D]',
  CIMA:  'bg-[#0081C6]',
  AAT:   'bg-[#00857A]',
  ICAEW: 'bg-[#8B0000]',
}

const EXAM_BODY_BADGE: Record<string, string> = {
  ACCA:  'bg-blue-50 text-[#004B8D]',
  CIMA:  'bg-sky-50 text-[#0081C6]',
  AAT:   'bg-teal-50 text-teal-700',
  ICAEW: 'bg-red-50 text-red-800',
}

const LEVEL_BADGE: Record<string, string> = {
  Beginner:     'bg-teal-50 text-teal-700 border-teal-200',
  Intermediate: 'bg-gold-50 text-gold-600 border-gold-200',
  Advanced:     'bg-navy-50 text-navy-700 border-navy-200',
  Professional: 'bg-navy-950 text-white border-navy-900',
}

const WHY_FREE = [
  { title: 'Written by qualified accountants', body: 'Every lesson is written or reviewed by ACCA, CIMA, or ICAEW members — not generic content writers.' },
  { title: 'Built-in practice questions',       body: 'Each lesson ends with MCQs so you test your understanding immediately, not hours later.' },
  { title: 'No registration required',          body: 'Start any course right now. Create a free account to save your progress.' },
  { title: 'Updated every exam sitting',        body: 'Syllabus changes, examiner reports, and new question formats are reflected within days.' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function FreeCoursesPage() {
  const sanityCourses = await getCourses()
  const courses = sanityCourses.length > 0 ? sanityCourses : PLACEHOLDER_COURSES

  // Group by exam body
  const grouped = courses.reduce<Record<string, SanityCourse[]>>((acc, c) => {
    const key = c.examBody ?? 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const examBodies = Object.keys(grouped).sort()

  return (
    <div>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-25"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{ background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-4xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <Link href="/study-hub" className="hover:text-white/70 transition-colors">Study Hub</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Free Courses</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Free Courses</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Free accounting courses.
              <br />
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                No signup. No paywall.
              </span>
            </h1>
            <p className="text-white/65 text-xl leading-relaxed mb-10 max-w-2xl">
              Structured online courses for ACCA, CIMA, ICAEW and AAT.
              Written by qualified accountants. Built-in practice questions. Always free to start.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {examBodies.map(body => (
                <a key={body} href={`#${body.toLowerCase()}`}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/8 text-white/60 border border-white/12 hover:bg-white/15 hover:text-white/90 transition-all">
                  {body}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY FREE ─────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200">
        <div className="container-site py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {WHY_FREE.map((w, i, arr) => (
              <div key={w.title} className={['', i < arr.length - 1 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''].join(' ')}>
                <div className="w-2 h-2 rounded-full bg-gold-500 mb-3" />
                <h3 className="font-semibold text-navy-950 text-sm mb-1">{w.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES BY EXAM BODY ──────────────────────────────────────── */}
      {examBodies.map(body => (
        <section key={body} id={body.toLowerCase()} className="section bg-slate-50 border-t border-slate-200">
          <div className="container-site">
            <div className="flex items-center gap-3 mb-8">
              <div className={['w-1.5 h-8 rounded-full', EXAM_BODY_ACCENT[body] ?? 'bg-navy-600'].join(' ')} />
              <div>
                <span className="eyebrow block">{body}</span>
                <h2 className="font-display text-2xl text-navy-950">{body} Free Courses</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {grouped[body].map(course => (
                <Link key={course._id} href={`/free-courses/${course.slug.current}`}
                  className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                  <div className={['h-1.5', EXAM_BODY_ACCENT[course.examBody ?? ''] ?? 'bg-navy-600'].join(' ')} />
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      {course.examBody && (
                        <span className={['text-2xs font-bold px-2 py-0.5 rounded', EXAM_BODY_BADGE[course.examBody] ?? 'bg-slate-100 text-slate-700'].join(' ')}>
                          {course.examBody}
                        </span>
                      )}
                      {course.level && (
                        <span className={['text-2xs font-semibold px-2 py-0.5 rounded-full border', LEVEL_BADGE[course.level] ?? 'bg-slate-100 text-slate-600 border-slate-200'].join(' ')}>
                          {course.level}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-base text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors flex-1">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">
                        {course.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {course.lessonCount && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" /></svg>
                            {course.lessonCount} lessons
                          </span>
                        )}
                        {course.duration && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" stroke="currentColor" fill="none" /><path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" /></svg>
                            {course.duration}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-navy-600 group-hover:gap-2 transition-all">
                        Start
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="section-navy section relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Also worth exploring</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">
            Test what you have learned.
          </h2>
          <p className="text-white/65 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            50,000+ practice questions and full mock exams — all exam standard, all free to start.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/practice-questions"
              className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
              Practice questions
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/mock-exams"
              className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all">
              Mock exams
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}