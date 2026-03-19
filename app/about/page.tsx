// app/about/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About AccountingBody — Our Mission, Story & Values',
  description:
    'AccountingBody was built to give every accounting student access to world-class study resources. Learn about our mission, values, and the story behind the platform.',
}

const values = [
  {
    title: 'Accuracy First',
    description:
      'Every piece of content is written or reviewed by a qualified accountant. We would rather publish nothing than publish something wrong.',
    iconBg: 'bg-teal-600',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Always Accessible',
    description:
      'Core study notes, the full glossary, and practice questions are permanently free. Quality education should not be locked behind a paywall.',
    iconBg: 'bg-navy-950',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Exam Standard',
    description:
      'We track every examiner report and syllabus change. Our question banks are updated every exam sitting — not once a year.',
    iconBg: 'bg-gold-500',
    icon: (
      <svg className="w-5 h-5 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: 'Student First',
    description:
      'Every product decision starts with one question: does this actually help a student pass their exam? If the answer is no, we do not build it.',
    iconBg: 'bg-slate-700',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
  },
]

const milestones = [
  { year: '2010', event: 'AccountingBody founded as a blog covering ACCA F3 topics.' },
  { year: '2013', event: 'First 100 articles published. Google begins indexing the site.' },
  { year: '2016', event: 'Practice question bank launched — 5,000 MCQs across ACCA Applied Skills.' },
  { year: '2018', event: '100,000 students reached. CIMA and AAT content added to the platform.' },
  { year: '2020', event: 'Full glossary of 1,200+ accounting and finance terms published.' },
  { year: '2022', event: '250,000+ students across 80+ countries. 50,000+ practice questions live.' },
  { year: '2025', event: 'Full platform rebuild on Next.js, Sanity CMS, and modern infrastructure.' },
]

const qualifications = [
  { name: 'ACCA',  detail: '13 papers covered',  accent: 'border-[#004B8D] text-[#004B8D]', bg: 'bg-[#004B8D]/5' },
  { name: 'CIMA',  detail: 'Full pathway',        accent: 'border-[#0081C6] text-[#0081C6]', bg: 'bg-[#0081C6]/5' },
  { name: 'AAT',   detail: 'Levels 2–4',          accent: 'border-[#00857A] text-[#00857A]', bg: 'bg-[#00857A]/5' },
  { name: 'ICAEW', detail: 'ACA pathway',         accent: 'border-navy-600  text-navy-700',  bg: 'bg-navy-50' },
  { name: 'ATT',   detail: 'Tax qualification',   accent: 'border-slate-500  text-slate-700', bg: 'bg-slate-50' },
  { name: 'CPA',   detail: 'Core subjects',       accent: 'border-teal-500   text-teal-700',  bg: 'bg-teal-50' },
  { name: 'CIPFA', detail: 'Public finance',      accent: 'border-gold-500   text-gold-600',  bg: 'bg-gold-50' },
  { name: 'CTA',   detail: 'Tax advisory',        accent: 'border-slate-400  text-slate-600', bg: 'bg-slate-50' },
]

export default function AboutPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-24 md:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-25"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }} />
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{ background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <span className="eyebrow text-gold-400 mb-5 block">About AccountingBody</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.02em' }}>
              Built for the student who{' '}
              <span style={{
                background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                cannot afford to fail
              </span>
            </h1>
            <p className="text-white/65 text-xl leading-relaxed max-w-2xl">
              We built AccountingBody because professional accounting qualifications are hard enough
              without having to hunt across the internet for reliable study materials. Everything you
              need is here — free to start, exam-accurate, written by people who have been where you are.
            </p>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="eyebrow mb-3 block">Our Mission</span>
              <h2 className="section-title mb-6">Make world-class accounting education accessible to everyone</h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-5">
                The internet is full of accounting content written by people who have never sat a
                professional exam. Search for &ldquo;how to pass ACCA P7&rdquo; and you will find
                generic listicles, affiliate marketing dressed up as advice, and outdated material
                from three syllabus changes ago.
              </p>
              <p className="text-slate-500 text-lg leading-relaxed mb-5">
                AccountingBody was built to fix that. Every article, study note, and practice
                question is written or reviewed by a qualified accountant who has actually sat
                the exam you are preparing for.
              </p>
              <p className="text-slate-500 text-lg leading-relaxed">
                And because we believe cost should never be a barrier to a professional
                qualification, the core of everything we build is permanently free.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '3,000+',   label: 'Articles & Study Notes',  sub: 'Updated for 2025 exams' },
                { value: '50,000+',  label: 'Practice Questions',       sub: 'MCQ, written & scenario' },
                { value: '250,000+', label: 'Students Helped',          sub: 'Across 80+ countries' },
                { value: '15+',      label: 'Years of Trust',           sub: 'Founded 2010' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                  <span className="stat-number block mb-1">{stat.value}</span>
                  <span className="text-sm font-semibold text-navy-950 block">{stat.label}</span>
                  <span className="text-xs text-slate-400">{stat.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Our Values</span>
            <h2 className="section-title mb-4">What we stand for</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Four principles that guide every decision we make — from the content we publish to the features we build.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {values.map(value => (
              <div key={value.title}
                className="bg-white rounded-xl border border-slate-200 p-7 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl ${value.iconBg} flex items-center justify-center mb-5`}>
                  {value.icon}
                </div>
                <h3 className="font-display text-xl text-navy-950 mb-3">{value.title}</h3>
                <p className="text-slate-500 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUALIFICATIONS */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Coverage</span>
            <h2 className="section-title mb-4">Every major qualification, covered</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              We cover all major UK and international professional accounting qualifications with
              dedicated study notes, question banks, and exam guides for each one.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {qualifications.map(q => (
              <div key={q.name}
                className={`rounded-xl border-2 p-5 ${q.accent} ${q.bg} hover:shadow-md transition-shadow`}>
                <span className="font-display text-2xl font-bold block mb-1">{q.name}</span>
                <span className="text-xs opacity-70">{q.detail}</span>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/study"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm">
              Browse all study materials
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <span className="eyebrow mb-3 block">Our Story</span>
              <h2 className="section-title mb-6">Fifteen years in the making</h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-4">
                AccountingBody started with a single blog post about ACCA F3. No grand plan.
                No investors. Just a qualified accountant who wanted to explain double-entry
                bookkeeping in a way that actually made sense.
              </p>
              <p className="text-slate-500 text-lg leading-relaxed">
                Fifteen years later, that post has become 3,000+ articles, 50,000+ practice
                questions, and a platform trusted by over a quarter of a million students in 80+ countries.
              </p>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-7">
                {milestones.map(m => (
                  <div key={m.year} className="relative flex gap-5 pl-12">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-navy-950 border-4 border-white flex items-center justify-center shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-gold-400" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gold-600 uppercase tracking-widest block mb-0.5">{m.year}</span>
                      <p className="text-navy-950 font-medium text-sm leading-relaxed">{m.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-navy section relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Get Started</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">Ready to start studying?</h2>
          <p className="text-white/65 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            Join 250,000+ students who use AccountingBody to prepare for their professional
            accounting exams. Free to start. No credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/study"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
              Start studying free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link href="/contact"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 transition-all">
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
