import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Firms & Freelancers | AccountingBody',
  description: 'Join our verified network of accounting firms and freelance professionals. We match you with clients who need your services.',
}

const benefits = [
  {
    title: 'Verified Network Only',
    desc:  'Every firm and freelancer is carefully reviewed before joining. Clients trust our network because we maintain high standards.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#ECFDF5"/>
        <circle cx="20" cy="20" r="9" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 20l3 3 7-7" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'We Handle Client Matching',
    desc:  'When a client submits a service request, we review it and forward it to the right professional in our network — no cold outreach needed.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
        <path d="M14 26c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="20" cy="16" r="3" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M28 22c1.5.8 2.5 2.3 2.5 4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="28" cy="18" r="2" stroke="#D4A017" strokeWidth="1.4"/>
        <path d="M12 22c-1.5.8-2.5 2.3-2.5 4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="12" cy="18" r="2" stroke="#D4A017" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    title: 'Managed Engagements',
    desc:  'We manage the process from initial request through to completion. You focus on delivering great work — we handle the coordination.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#FFF7ED"/>
        <rect x="11" y="10" width="18" height="20" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/>
        <path d="M15 17l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M15 23l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M23 18h2M23 24h2" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Steady Work Pipeline',
    desc:  'As our platform grows, so does the volume of client requests forwarded to our network. A reliable source of qualified leads.',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="10" fill="#EEF2FF"/>
        <path d="M11 29l6-7 4 4 8-10" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="29" cy="16" r="2" fill="#0C1A3D"/>
        <path d="M11 12v17h18" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
]

const howItWorks = [
  { step: '01', title: 'Apply to Join',       desc: 'Submit your application with your practice details, specialisms, and qualifications. All applications are reviewed manually.' },
  { step: '02', title: 'We Verify You',        desc: 'Our team reviews your credentials and vets your practice before adding you to our internal network database.' },
  { step: '03', title: 'Receive Matched Leads', desc: 'When a client submits a service request that matches your specialism, we forward it to you and request a quotation.' },
  { step: '04', title: 'We Handle the Rest',   desc: 'We manage pricing, client communication, and payment. You deliver the work and we pay you promptly on completion.' },
]

const forProfessionals = [
  'No cold outreach — we bring clients to you',
  'Work with pre-qualified, serious enquiries only',
  'We handle billing and client management',
  'Highlight your ACCA, CIMA, ICAEW or AAT credentials',
  'Flexible — take on as much or as little as you choose',
]

export default function FirmsFreelancersPage() {
  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Firms &amp; Freelancers</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Professional Network</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Join Our Verified<br />Professional Network
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl">
              We match qualified accounting firms and freelancers with clients who need their services. Apply to join our vetted network and receive a steady stream of matched client enquiries.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/firms-freelancers/join"
                className="h-12 px-7 flex items-center gap-2 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                Apply to Join
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/get-help"
                className="h-12 px-7 flex items-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all">
                Need Accounting Help?
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Why Join</span>
            <h2 className="section-title mb-4">A better way to grow your practice</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              No directories, no cold leads, no chasing. We do the matching — you do the work.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="mb-4">{b.icon}</div>
                <h3 className="font-display text-lg text-navy-950 mb-2">{b.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-navy relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-400 mb-4 block">How It Works</span>
            <h2 className="font-display text-4xl text-white mb-4 leading-tight">From application to paid work</h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">Four simple steps to start receiving matched client enquiries.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-lg mb-5 shadow-gold">
                  {item.step}
                </div>
                <h3 className="font-display text-white text-lg mb-3">{item.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR PROFESSIONALS / CTA */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <span className="eyebrow mb-3 block">For Accountants &amp; Firms</span>
              <h2 className="section-title mb-4">Ready to join our network?</h2>
              <ul className="space-y-3 mb-8">
                {forProfessionals.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/firms-freelancers/join"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors shadow-sm">
                Apply to Join Our Network
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
            <div className="bg-navy-950 rounded-xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
              <div className="relative z-10">
                <p className="font-display text-white text-xl mb-3 leading-snug">Need accounting help instead?</p>
                <p className="text-white/55 text-sm leading-relaxed mb-6">
                  Submit a service request and we will match you with the right professional from our verified network within one business day.
                </p>
                <Link href="/get-help"
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-gold-500 text-navy-950 text-sm font-semibold hover:bg-gold-400 transition-colors">
                  Get Help Now
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
