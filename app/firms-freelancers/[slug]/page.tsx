import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface FirmProfile {
  id:            string
  practice_name: string
  practice_type: string
  contact_name:  string
  email:         string
  phone:         string
  location:      string
  specialisms:   string
  about:         string
  website:       string
  created_at:    string
}

async function getFirm(id: string): Promise<FirmProfile | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabase
      .from('firms_applications')
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
  const firm = await getFirm(slug)
  if (!firm) return {}
  return {
    title: firm.practice_name + ' | AccountingBody Directory',
    description: firm.about ? firm.about.slice(0, 160) : firm.practice_name + ' - ' + firm.practice_type + ' based in ' + firm.location,
  }
}

export default async function FirmProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const firm = await getFirm(slug)
  if (!firm) notFound()
  if (!firm) return null

  const specialisms = firm.specialisms ? firm.specialisms.split(', ').filter(Boolean) : []

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-navy-950 py-14 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/firms-freelancers" className="hover:text-white/70 transition-colors">Firms &amp; Freelancers</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/firms-freelancers/directory" className="hover:text-white/70 transition-colors">Directory</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70 line-clamp-1">{firm.practice_name}</span>
          </nav>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <span className="font-display text-2xl font-bold text-white">
                {firm.practice_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white/50 text-sm mb-1">{firm.practice_type}</p>
              <h1 className="font-display text-white text-3xl md:text-4xl leading-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
                {firm.practice_name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {firm.location}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">
            <div className="space-y-6">
              {firm.about && (
                <div className="bg-white rounded-xl border border-slate-200 p-8">
                  <h2 className="font-display text-xl text-navy-950 mb-4">About</h2>
                  <p className="text-slate-600 text-base leading-relaxed whitespace-pre-line">{firm.about}</p>
                </div>
              )}
              {specialisms.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-8">
                  <h2 className="font-display text-xl text-navy-950 mb-4">Specialisms</h2>
                  <div className="flex flex-wrap gap-2">
                    {specialisms.map(s => (
                      <span key={s} className="text-sm px-3 py-1.5 rounded-lg bg-navy-50 text-navy-700 border border-navy-100 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <aside className="lg:sticky lg:top-24 space-y-5">
              <div className="bg-navy-950 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                <div className="relative z-10">
                  <p className="font-display text-white text-base mb-2">Get in touch</p>
                  <p className="text-white/55 text-xs leading-relaxed mb-4">
                    Contact {firm.practice_name} directly to discuss your requirements.
                  </p>
                  
                    href={'mailto:' + firm.email + '?subject=Enquiry from AccountingBody'}
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors"
                  >
                    Send Enquiry
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Practice Details</p>
                <dl className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Type</dt>
                    <dd className="text-navy-950 font-medium">{firm.practice_type}</dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-slate-500">Location</dt>
                    <dd className="text-navy-950 font-medium">{firm.location}</dd>
                  </div>
                  {firm.phone && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Phone</dt>
                      <dd className="text-navy-950 font-medium">{firm.phone}</dd>
                    </div>
                  )}
                  {firm.website && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Website</dt>
                      <dd>
                        <a href={firm.website} target="_blank" rel="noopener noreferrer"
                          className="text-navy-700 hover:text-gold-600 transition-colors font-medium text-sm underline underline-offset-2">
                          Visit site
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <Link href="/firms-freelancers/directory" className="flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Back to directory
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
