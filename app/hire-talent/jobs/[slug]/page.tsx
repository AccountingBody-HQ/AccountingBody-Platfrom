import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface JobListing {
  id:           string
  company_name: string
  contact_email: string
  job_title:    string
  job_type:     string
  location:     string
  salary_range: string
  description:  string
  requirements: string
  created_at:   string
}

const JOB_TYPE_BADGE: Record<string, string> = {
  'Full-time':  'bg-blue-50 text-blue-700 border-blue-200',
  'Part-time':  'bg-purple-50 text-purple-700 border-purple-200',
  'Contract':   'bg-amber-50 text-amber-700 border-amber-200',
  'Freelance':  'bg-teal-50 text-teal-700 border-teal-200',
  'Temporary':  'bg-orange-50 text-orange-700 border-orange-200',
  'Internship': 'bg-pink-50 text-pink-700 border-pink-200',
}

async function getJob(id: string): Promise<JobListing | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const job = await getJob(slug)
  if (!job) return {}
  return {
    title:       `${job.job_title} at ${job.company_name} | AccountingBody Jobs`,
    description: job.description?.slice(0, 160),
  }
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const job = await getJob(slug)
  if (!job) notFound()
  if (!job) return null

  const badgeClass = JOB_TYPE_BADGE[job.job_type] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const posted = job.created_at
    ? new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <main className="min-h-screen bg-slate-50">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-14 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/hire-talent" className="hover:text-white/70 transition-colors">Hire Talent</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/hire-talent/jobs" className="hover:text-white/70 transition-colors">Jobs</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70 line-clamp-1">{job.job_title}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${badgeClass}`}>
              {job.job_type}
            </span>
          </div>

          <h1 className="font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-3 max-w-4xl" style={{ letterSpacing: '-0.02em' }}>
            {job.job_title}
          </h1>
          <p className="text-white/60 text-xl mb-6">{job.company_name}</p>

          <div className="flex flex-wrap items-center gap-5 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
            {job.salary_range && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {job.salary_range}
              </span>
            )}
            {posted && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Posted {posted}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">

            {/* Main */}
            <div className="space-y-8">
              <div className="bg-white rounded-xl border border-slate-200 p-8">
                <h2 className="font-display text-xl text-navy-950 mb-4">Job Description</h2>
                <p className="text-slate-600 text-base leading-relaxed whitespace-pre-line">{job.description}</p>
              </div>

              {job.requirements && (
                <div className="bg-white rounded-xl border border-slate-200 p-8">
                  <h2 className="font-display text-xl text-navy-950 mb-4">Requirements &amp; Qualifications</h2>
                  <p className="text-slate-600 text-base leading-relaxed whitespace-pre-line">{job.requirements}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 space-y-5">

              {/* Apply CTA */}
              <div className="bg-navy-950 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                <div className="relative z-10">
                  <p className="font-display text-white text-base mb-2">Interested in this role?</p>
                  <p className="text-white/55 text-xs leading-relaxed mb-4">
                    Contact the employer directly to apply.
                  </p>
                  <a
                    href={`mailto:${job.contact_email}?subject=Application for ${encodeURIComponent(job.job_title)}`}
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors"
                  >
                    Apply Now
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Job details */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Job Details</p>
                <dl className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Company</dt>
                    <dd className="text-navy-950 font-medium">{job.company_name}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Job Type</dt>
                    <dd><span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${badgeClass}`}>{job.job_type}</span></dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Location</dt>
                    <dd className="text-navy-950 font-medium">{job.location}</dd>
                  </div>
                  {job.salary_range && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Salary</dt>
                      <dd className="text-navy-950 font-medium">{job.salary_range}</dd>
                    </div>
                  )}
                  {posted && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Posted</dt>
                      <dd className="text-navy-950 font-medium">{posted}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <Link href="/hire-talent/jobs" className="flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                All jobs
              </Link>
            </aside>

          </div>
        </div>
      </section>

    </main>
  )
}
