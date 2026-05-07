import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title:       'Accounting & Finance Jobs | AccountingBody',
  description: 'Browse specialist accounting and finance roles across the UK.',
}

interface JobListing {
  id:           string
  company_name: string
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

async function getJobListings(): Promise<JobListing[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabase
      .from('job_listings')
      .select('id, company_name, job_title, job_type, location, salary_range, description, requirements, created_at')
      .order('created_at', { ascending: false })
    if (error) { console.error('jobs fetch error', error); return [] }
    return data ?? []
  } catch (e) {
    console.error('jobs fetch failed', e)
    return []
  }
}

export default async function JobsPage() {
  const jobs = await getJobListings()

  return (
    <main className="min-h-screen bg-slate-50">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/hire-talent" className="hover:text-white/70 transition-colors">Hire Talent</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Jobs</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Careers</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">
            Accounting &amp; Finance Jobs
          </h1>
          <p className="text-white/60 text-xl leading-relaxed">
            Specialist roles across the UK for accounting and finance professionals.
          </p>
        </div>
      </section>

      {/* LISTINGS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <p className="text-sm text-slate-500">
              {jobs.length} {jobs.length === 1 ? 'role' : 'roles'} available
            </p>
            <Link
              href="/hire-talent/post-a-job"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
            >
              Post a Job
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">No roles listed yet</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Be the first employer to post a role and reach our growing community of qualified accounting professionals.
              </p>
              <Link
                href="/hire-talent/post-a-job"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                Post a Job
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => {
                const badgeClass = JOB_TYPE_BADGE[job.job_type] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                const posted = job.created_at
                  ? new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : null
                return (
                  <Link
                    key={job.id}
                    href={`/hire-talent/jobs/${job.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-xl border border-slate-200 p-6 hover:border-navy-300 hover:shadow-md transition-all duration-200"
                  >
                    {/* Company initial */}
                    <div className="w-12 h-12 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-center shrink-0">
                      <span className="font-display text-lg font-bold text-navy-700">
                        {job.company_name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="font-semibold text-navy-950 text-base group-hover:text-navy-700 transition-colors">
                          {job.job_title}
                        </h2>
                      </div>
                      <p className="text-sm text-slate-500 mb-2">{job.company_name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {job.location}
                        </span>
                        {job.salary_range && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {job.salary_range}
                          </span>
                        )}
                        {posted && <span>Posted {posted}</span>}
                      </div>
                    </div>

                    {/* Badge + arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${badgeClass}`}>
                        {job.job_type}
                      </span>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-navy-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* POST A JOB CTA */}
      <section className="bg-white border-t border-slate-200 py-10">
        <div className="container-site text-center">
          <p className="font-display text-xl text-navy-950 mb-2">Looking to hire?</p>
          <p className="text-slate-500 text-sm mb-6">Post a role and reach qualified accounting professionals across the UK.</p>
          <Link
            href="/hire-talent/post-a-job"
            className="inline-flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
          >
            Post a Job
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>

    </main>
  )
}
