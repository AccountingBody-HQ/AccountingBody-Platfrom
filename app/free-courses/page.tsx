// app/free-courses/page.tsx
// Accounting Body — Free Courses
// PRIMARY URL for all courses content. /study/courses, /courses, /course
// all 301 redirect here. This is the Google-indexed canonical page.

import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Free Accounting Courses | Accounting Body',
  description: 'Free online accounting courses for accounting and finance students. Structured lessons, worked examples, and built-in practice questions. No signup required.',
}

// ── Sanity fetch ───────────────────────────────────────────────────────────────

interface SanityCourse {
  _id:           string
  title:         string
  slug:          { current: string }
  description?:  string
  level?:        string
  categoryTitle?: string
  chapterCount?: number
  lessonCount?:  number
  featuredImage?: { asset: { url: string } }
}

async function getCourses(): Promise<SanityCourse[]> {
  try {
    const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
    const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
    const query = encodeURIComponent(
      `*[_type == "course" && (status == "published" || !defined(status)) && "accountingbody" in showOnSites]
      | order(courseOrder asc) {
        _id, title, slug, description, level, courseOrder,
        "categoryTitle": category->title,
        "featuredImage": featuredImage { asset->{ url } },
        "chapterCount": count(chapters),
        "lessonCount":  count(chapters[].lessons[])
      }`
    )
    const res = await fetch(
      `https://${PROJECT_ID}.apicdn.sanity.io/v2023-05-03/data/query/${DATASET}?query=${query}`,
      { next: { revalidate: 60 }, headers: process.env.SANITY_API_TOKEN ? { Authorization: `Bearer ${process.env.SANITY_API_TOKEN}` } : {} }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

// ── Static course data (shown when Sanity has no courses yet) ──────────────────

const PLACEHOLDER_COURSES: SanityCourse[] = []

const EXAM_BODY_ACCENT: Record<string, string> = {
  ACCA:  'bg-[#004B8D]',
  CIMA:  'bg-[#0081C6]',
  AAT:   'bg-[#00857A]',
  ICAEW: 'bg-[#8B0000]',
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

export default async function FreeCoursesPage({ searchParams }: { searchParams: { level?: string } }) {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'
  const sanityCourses = await getCourses()
  const allCourses = sanityCourses.length > 0 ? sanityCourses : PLACEHOLDER_COURSES

  const activeLevel = searchParams.level
    ? searchParams.level.charAt(0).toUpperCase() + searchParams.level.slice(1)
    : null

  const courses = activeLevel
    ? allCourses.filter(c => c.level?.toLowerCase() === activeLevel.toLowerCase())
    : allCourses

  // Group by category
  const grouped = courses.reduce<Record<string, SanityCourse[]>>((acc, c) => {
    const key = c.categoryTitle ?? 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const examBodies = Object.keys(grouped).sort()
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Professional']

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
              Structured online courses for accounting and finance students.
              Written by qualified accountants. Built-in practice questions. Always free to start.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="/free-courses"
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${!activeLevel ? 'bg-gold-500 text-navy-950 border-gold-500' : 'bg-white/8 text-white/60 border-white/12 hover:bg-white/15 hover:text-white/90'}`}>
                All Courses
              </a>
              {LEVELS.map(level => (
                <a key={level} href={`/free-courses?level=${level.toLowerCase()}`}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${activeLevel === level ? 'bg-gold-500 text-navy-950 border-gold-500' : 'bg-white/8 text-white/60 border-white/12 hover:bg-white/15 hover:text-white/90'}`}>
                  {level}
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
                  <div className="h-1.5 bg-navy-950" />
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      {course.categoryTitle && (
                        <span className="text-2xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {course.categoryTitle}
                        </span>
                      )}
                      {course.level && (
                        <span className={['text-2xs font-semibold px-2 py-0.5 rounded-full border', LEVEL_BADGE[course.level] ?? 'bg-slate-100 text-slate-600 border-slate-200'].join(' ')}>
                          {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
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
                        {(course.chapterCount ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            {course.chapterCount} chapters
                          </span>
                        )}
                        {(course.lessonCount ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" /></svg>
                            {course.lessonCount} lessons
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

      {/* ── JOBS BANNER ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: '#C9982A' }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="container-site relative z-10 py-16 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7"
                style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: brand }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: brand }}>
                  {platformName} Recruitment
                </span>
              </div>
              <h2 className="font-display leading-[1.06] mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: brand }}>
                {isEthioTax ? (
                  <>Studying, at university,<br /><span style={{ opacity: 0.7 }}>or already qualified?</span><br />We place finance professionals.</>
                ) : (
                  <>Studying, at university,<br /><span style={{ opacity: 0.7 }}>or already qualified?</span><br />We place accounting & finance professionals.</>
                )}
              </h2>
              <p className="text-base leading-relaxed mb-8 max-w-lg"
                style={{ color: isEthioTax ? 'rgba(15,45,30,0.75)' : 'rgba(12,26,61,0.75)' }}>
                {isEthioTax
                  ? 'Register as a candidate at any stage — university student, mid-qualification or fully certified. We place Ethiopian finance professionals globally.'
                  : 'Register as a candidate at any stage of your journey — university student, mid-qualification or fully certified. We match you to the right role when the time is right.'}
              </p>
              <div className="flex flex-col gap-3 mb-10">
                {(isEthioTax ? [
                  'Ethiopian-origin finance professionals actively placed',
                  'ETICPA, ACCA, CIMA and CPA credentials recognised',
                  '90-day replacement guarantee on every placement',
                ] : [
                  'Accounting and finance professionals only',
                  'Every candidate personally reviewed before activation',
                  '90-day replacement guarantee on every permanent placement',
                ]).map(point => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: brand }}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium" style={{ color: isEthioTax ? 'rgba(15,45,30,0.85)' : 'rgba(12,26,61,0.85)' }}>
                      {point}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/jobs/find-work"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ background: brand }}>
                  Register as a Candidate
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link href="/jobs/how-it-works"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-all hover:opacity-80 border-2"
                  style={{ borderColor: brand, color: brand, background: 'transparent' }}>
                  How it works
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: brand, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div className="px-8 pt-7 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>
                      Your course-to-career path
                    </p>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(201,152,42,0.15)', color: '#C9982A', border: '1px solid rgba(201,152,42,0.3)' }}>
                      Not a job board
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2">
                  {[
                    { value: 'Learn', label: 'Build your skills', sub: 'ACCA · CIMA · AAT · ETICPA' },
                    { value: 'Register', label: 'One profile — we match', sub: 'No cold applying ever' },
                    { value: 'Managed', label: 'End-to-end placement', sub: 'We handle every step' },
                    { value: '90 Days', label: 'Replacement guarantee', sub: 'On every permanent role' },
                  ].map((stat, i) => (
                    <div key={stat.label} className="p-6"
                      style={{
                        borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      }}>
                      <span className="font-display text-2xl font-bold text-white block mb-1">{stat.value}</span>
                      <span className="text-xs font-semibold block mb-0.5" style={{ color: '#C9982A' }}>{stat.label}</span>
                      <span className="text-xs text-white/35">{stat.sub}</span>
                    </div>
                  ))}
                </div>
                <div className="px-8 py-5 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(201,152,42,0.06)' }}>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Your profile is never made public.{' '}
                    <span className="text-white/60 font-medium">We contact you only when a role matches.</span>
                  </p>
                  <Link href="/jobs" className="text-xs font-semibold whitespace-nowrap ml-4 hover:opacity-80 transition-opacity"
                    style={{ color: '#C9982A' }}>
                    Learn more →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
              className="inline-flex items-center justify-center gap-2 py-3 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold w-full sm:w-auto sm:min-w-[220px]">
              Practice questions
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/mock-exams"
              className="inline-flex items-center justify-center gap-2 py-3 px-7 rounded-lg text-base font-semibold text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all w-full sm:w-auto sm:min-w-[220px]">
              Mock exams
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}