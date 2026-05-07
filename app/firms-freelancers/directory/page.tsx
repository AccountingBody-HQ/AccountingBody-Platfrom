import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title:       'Accounting Firms & Freelancers Directory | AccountingBody',
  description: 'Find verified accounting firms and freelance professionals across the UK.',
}

interface FirmProfile {
  id:            string
  practice_name: string
  practice_type: string
  contact_name:  string
  location:      string
  specialisms:   string
  about:         string
  website:       string
  created_at:    string
}

async function getFirms(): Promise<FirmProfile[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabase
      .from('firms_applications')
      .select('id, practice_name, practice_type, contact_name, location, specialisms, about, website, created_at')
      .order('created_at', { ascending: false })
    if (error) { console.error('firms fetch error', error); return [] }
    return data ?? []
  } catch (e) {
    console.error('firms fetch failed', e)
    return []
  }
}

export default async function DirectoryPage() {
  const firms = await getFirms()

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
            <Link href="/firms-freelancers" className="hover:text-white/70 transition-colors">Firms &amp; Freelancers</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Directory</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Professional Directory</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">
            Accounting Firms &amp; Freelancers
          </h1>
          <p className="text-white/60 text-xl leading-relaxed">
            Verified accounting professionals across the UK, searchable by specialism and location.
          </p>
        </div>
      </section>

      {/* LISTINGS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <p className="text-sm text-slate-500">
              {firms.length} {firms.length === 1 ? 'practice' : 'practices'} listed
            </p>
            <Link
              href="/firms-freelancers/join"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
            >
              List Your Practice
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>

          {firms.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">No listings yet</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Be among the first to list your practice and get discovered by clients across the UK.
              </p>
              <Link
                href="/firms-freelancers/join"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                List Your Practice
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {firms.map(firm => (
                <Link
                  key={firm.id}
                  href={`/firms-freelancers/${firm.id}`}
                  className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-navy-300 hover:shadow-md transition-all duration-200 flex flex-col"
                >
                  {/* Initial avatar */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-center shrink-0">
                      <span className="font-display text-lg font-bold text-navy-700">
                        {firm.practice_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-navy-950 text-base leading-snug group-hover:text-navy-700 transition-colors">
                        {firm.practice_name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">{firm.practice_type}</p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {firm.location}
                  </div>

                  {/* About */}
                  {firm.about && (
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4 flex-1">{firm.about}</p>
                  )}

                  {/* Specialisms */}
                  {firm.specialisms && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-slate-100">
                      {firm.specialisms.split(', ').slice(0, 3).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-navy-50 text-navy-600 border border-navy-100">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* JOIN CTA */}
      <section className="bg-white border-t border-slate-200 py-10">
        <div className="container-site text-center">
          <p className="font-display text-xl text-navy-950 mb-2">Are you an accounting professional?</p>
          <p className="text-slate-500 text-sm mb-6">List your practice for free and get discovered by clients across the UK.</p>
          <Link
            href="/firms-freelancers/join"
            className="inline-flex items-center gap-2 h-10 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
          >
            Join the Directory
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>

    </main>
  )
}
