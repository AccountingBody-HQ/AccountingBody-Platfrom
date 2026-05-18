// app/courses/page.tsx
// Accounting Body — Course Catalogue

import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedCourses, levelBadge, capitalize } from '@/lib/coursesNew'
import type { CourseListItem } from '@/lib/coursesNew'

export const metadata: Metadata = {
  title: 'Free Accounting Courses | Accounting Body',
  description: 'Structured free courses for accounting and finance students. Study notes, lessons, and practice questions assembled into professional learning paths.',
}

function CourseCard({ course }: { course: CourseListItem }) {
  const badge = levelBadge(course.level)
  return (
    <Link
      href={`/courses/${course.slug.current}`}
      className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
    >
      {/* Banner image or fallback */}
      <div className="relative h-40 bg-navy-950 overflow-hidden">
        {course.featuredImage?.asset?.url ? (
          <img
            src={course.featuredImage.asset.url}
            alt={course.featuredImage.alt ?? course.title}
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
                backgroundSize: '30px 30px',
              }}
            />
            <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="1.5"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
        {/* Gold top bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gold-500" />
        {/* Free badge */}
        <div className="absolute top-3 right-3 bg-teal-500 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Free
        </div>
      </div>

      <div className="flex flex-col flex-1 p-5">
        {/* Level + category */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {course.level && (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
              {capitalize(course.level)}
            </span>
          )}
          {course.categoryTitle && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {course.categoryTitle}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display text-navy-950 text-lg leading-snug mb-2 group-hover:text-navy-700 transition-colors">
          {course.title}
        </h3>

        {/* Description */}
        {course.description && (
          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4 flex-1">
            {course.description}
          </p>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {course.chapterCount ?? 0} chapters
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {course.lessonCount ?? 0} lessons
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-navy-700 group-hover:text-gold-500 group-hover:gap-2 transition-all">
            Start
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

export default async function CoursesPage() {
  const courses = await getPublishedCourses()

  return (
    <>
      {/* Hero */}
      <section className="bg-navy-950 py-16 md:py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[60%] opacity-25"
          style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
        />
        <div className="container-site relative z-10">
          <div className="max-w-2xl">
            <span className="eyebrow text-gold-400 mb-4 block">Free Courses</span>
            <h1 className="font-display text-white mb-4 leading-tight" style={{ letterSpacing: '-0.025em' }}>
              Structured courses for accounting and finance students
            </h1>
            <p className="text-white/65 text-lg leading-relaxed mb-8">
              Professional learning paths assembled from expert study notes and practice questions.
              Developed by the Accounting Body Editorial Team — completely free.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-white/50">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Always free
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                No sign-up required
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Written by qualified accountants
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Course grid */}
      <section className="section bg-slate-50 min-h-[60vh]">
        <div className="container-site">
          {courses.length === 0 ? (
            <div className="max-w-xl mx-auto text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-navy-50 border border-navy-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.5"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">Courses coming soon</h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                Our first structured courses are being assembled now. Browse our full study notes library in the meantime.
              </p>
              <Link
                href="/study"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                Browse study notes
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map(course => (
                <CourseCard key={course._id} course={course} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-white border-t border-slate-200 py-10">
        <div className="container-site text-center">
          <p className="font-display text-xl text-navy-950 mb-2">Looking for individual study notes?</p>
          <p className="text-slate-500 text-sm mb-6">
            Browse 3,000+ articles and study notes organised by topic.
          </p>
          <Link
            href="/study"
            className="inline-flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
          >
            Browse all study notes
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  )
}
