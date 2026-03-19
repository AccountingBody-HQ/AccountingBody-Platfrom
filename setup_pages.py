#!/usr/bin/env python3
"""
AccountingBody — Static Pages Setup Script
Run from the ROOT of your accountingbody-website project:

  python3 setup_pages.py

Creates all folders and files automatically.
No EthioTax. No Resend. Contact form saves to Supabase only.
"""

import os

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    print(f"  created  {path}")

# ─────────────────────────────────────────────────────────────────────────────
# 1. app/about/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
write("app/about/page.tsx", '''\
// app/about/page.tsx
import type { Metadata } from \'next\'
import Link from \'next/link\'

export const metadata: Metadata = {
  title: \'About AccountingBody — Our Mission, Story & Values\',
  description:
    \'AccountingBody was built to give every accounting student access to world-class study resources. Learn about our mission, values, and the story behind the platform.\',
}

const values = [
  {
    title: \'Accuracy First\',
    description:
      \'Every piece of content is written or reviewed by a qualified accountant. We would rather publish nothing than publish something wrong.\',
    iconBg: \'bg-teal-600\',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: \'Always Accessible\',
    description:
      \'Core study notes, the full glossary, and practice questions are permanently free. Quality education should not be locked behind a paywall.\',
    iconBg: \'bg-navy-950\',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: \'Exam Standard\',
    description:
      \'We track every examiner report and syllabus change. Our question banks are updated every exam sitting — not once a year.\',
    iconBg: \'bg-gold-500\',
    icon: (
      <svg className="w-5 h-5 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: \'Student First\',
    description:
      \'Every product decision starts with one question: does this actually help a student pass their exam? If the answer is no, we do not build it.\',
    iconBg: \'bg-slate-700\',
    icon: (
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
  },
]

const milestones = [
  { year: \'2010\', event: \'AccountingBody founded as a blog covering ACCA F3 topics.\' },
  { year: \'2013\', event: \'First 100 articles published. Google begins indexing the site.\' },
  { year: \'2016\', event: \'Practice question bank launched — 5,000 MCQs across ACCA Applied Skills.\' },
  { year: \'2018\', event: \'100,000 students reached. CIMA and AAT content added to the platform.\' },
  { year: \'2020\', event: \'Full glossary of 1,200+ accounting and finance terms published.\' },
  { year: \'2022\', event: \'250,000+ students across 80+ countries. 50,000+ practice questions live.\' },
  { year: \'2025\', event: \'Full platform rebuild on Next.js, Sanity CMS, and modern infrastructure.\' },
]

const qualifications = [
  { name: \'ACCA\',  detail: \'13 papers covered\',  accent: \'border-[#004B8D] text-[#004B8D]\', bg: \'bg-[#004B8D]/5\' },
  { name: \'CIMA\',  detail: \'Full pathway\',        accent: \'border-[#0081C6] text-[#0081C6]\', bg: \'bg-[#0081C6]/5\' },
  { name: \'AAT\',   detail: \'Levels 2–4\',          accent: \'border-[#00857A] text-[#00857A]\', bg: \'bg-[#00857A]/5\' },
  { name: \'ICAEW\', detail: \'ACA pathway\',         accent: \'border-navy-600  text-navy-700\',  bg: \'bg-navy-50\' },
  { name: \'ATT\',   detail: \'Tax qualification\',   accent: \'border-slate-500  text-slate-700\', bg: \'bg-slate-50\' },
  { name: \'CPA\',   detail: \'Core subjects\',       accent: \'border-teal-500   text-teal-700\',  bg: \'bg-teal-50\' },
  { name: \'CIPFA\', detail: \'Public finance\',      accent: \'border-gold-500   text-gold-600\',  bg: \'bg-gold-50\' },
  { name: \'CTA\',   detail: \'Tax advisory\',        accent: \'border-slate-400  text-slate-600\', bg: \'bg-slate-50\' },
]

export default function AboutPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-24 md:py-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-25"
            style={{ background: \'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)\' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: \'60px 60px\',
            }} />
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{ background: \'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)\' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <span className="eyebrow text-gold-400 mb-5 block">About AccountingBody</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: \'-0.02em\' }}>
              Built for the student who{\' \'}
              <span style={{
                background: \'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)\',
                WebkitBackgroundClip: \'text\',
                WebkitTextFillColor: \'transparent\',
                backgroundClip: \'text\',
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
                { value: \'3,000+\',   label: \'Articles & Study Notes\',  sub: \'Updated for 2025 exams\' },
                { value: \'50,000+\',  label: \'Practice Questions\',       sub: \'MCQ, written & scenario\' },
                { value: \'250,000+\', label: \'Students Helped\',          sub: \'Across 80+ countries\' },
                { value: \'15+\',      label: \'Years of Trust\',           sub: \'Founded 2010\' },
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
''')

# ─────────────────────────────────────────────────────────────────────────────
# 2. app/contact/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
write("app/contact/page.tsx", '''\
// app/contact/page.tsx
import type { Metadata } from \'next\'
import ContactForm from \'./ContactForm\'

export const metadata: Metadata = {
  title: \'Contact AccountingBody — Get in Touch\',
  description:
    \'Have a question, content partnership enquiry, or want to report an error? Get in touch with the AccountingBody team.\',
}

const faqs = [
  {
    q: \'Is AccountingBody really free?\',
    a: \'Yes. Study notes, the full glossary, and core practice questions are permanently free — no credit card, no trial, no hidden fees.\',
  },
  {
    q: \'How quickly do you reply to messages?\',
    a: \'We aim to reply to all messages within 2 business days. Technical issues are prioritised.\',
  },
  {
    q: \'Can I contribute articles or study notes?\',
    a: \'Yes — if you are a qualified accountant and want to contribute, select "Content Partnership" as the subject.\',
  },
  {
    q: \'I found an error in your content. How do I report it?\',
    a: \'Please use the contact form and select "Content Error". We take accuracy very seriously and will correct any errors promptly.\',
  },
  {
    q: \'Do you offer institutional or group licences?\',
    a: \'Yes. We offer discounted group access for training providers, universities, and employers. Select "Enterprise Enquiry" in the form.\',
  },
]

export default function ContactPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-25"
            style={{ background: \'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)\' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: \'60px 60px\',
            }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-2xl">
            <span className="eyebrow text-gold-400 mb-5 block">Get in Touch</span>
            <h1 className="font-display text-white mb-5 leading-tight">Contact AccountingBody</h1>
            <p className="text-white/65 text-xl leading-relaxed">
              Questions about study materials, content partnerships, technical issues,
              or anything else — we read every message and reply within 2 business days.
            </p>
          </div>
        </div>
      </section>

      {/* FORM + SIDEBAR */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <ContactForm />
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-display text-base text-navy-950 mb-4">Contact details</h3>
                <div className="space-y-4">
                  {[
                    { label: \'Email\',         value: \'hello@accountingbody.com\' },
                    { label: \'Response time\',  value: \'Within 2 business days\' },
                    { label: \'Based in\',       value: \'United Kingdom\' },
                  ].map(item => (
                    <div key={item.label}>
                      <span className="text-xs text-slate-400 block">{item.label}</span>
                      <span className="text-sm font-medium text-navy-950">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-navy-950 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ background: \'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)\' }} />
                <div className="relative z-10">
                  <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-3">Stay Ahead</p>
                  <h4 className="font-display text-white text-lg mb-2 leading-snug">Get free exam tips by email</h4>
                  <p className="text-white/60 text-sm leading-relaxed">
                    Weekly study tips written by qualified accountants. Subscribe using the contact form — just tick the box.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-2xl mb-10">
            <span className="eyebrow mb-3 block">FAQ</span>
            <h2 className="section-title mb-4">Common questions</h2>
          </div>
          <div className="max-w-3xl space-y-4">
            {faqs.map(faq => (
              <div key={faq.q} className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-navy-950 mb-2 text-sm">{faq.q}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
''')

# ─────────────────────────────────────────────────────────────────────────────
# 3. app/contact/ContactForm.tsx
# ─────────────────────────────────────────────────────────────────────────────
write("app/contact/ContactForm.tsx", '''\
\'use client\'
// app/contact/ContactForm.tsx
// Saves contact submissions and email subscribers to Supabase via /api/contact
// No third-party email service required.

import { useState } from \'react\'

type FormState = \'idle\' | \'loading\' | \'success\' | \'error\'

const subjects = [
  \'General Enquiry\',
  \'Content Error\',
  \'Content Partnership\',
  \'Enterprise Enquiry\',
  \'Technical Issue\',
  \'Press / Media\',
  \'Other\',
]

export default function ContactForm() {
  const [formState, setFormState]     = useState<FormState>(\'idle\')
  const [errorMsg, setErrorMsg]       = useState(\'\')
  const [subscribeState, setSubState] = useState<FormState>(\'idle\')

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState(\'loading\')
    setErrorMsg(\'\')
    const form = e.currentTarget
    const data = {
      name:      (form.elements.namedItem(\'name\')    as HTMLInputElement).value.trim(),
      email:     (form.elements.namedItem(\'email\')   as HTMLInputElement).value.trim(),
      subject:   (form.elements.namedItem(\'subject\') as HTMLSelectElement).value,
      message:   (form.elements.namedItem(\'message\') as HTMLTextAreaElement).value.trim(),
      subscribe: (form.elements.namedItem(\'subscribe\') as HTMLInputElement).checked,
    }
    try {
      const res  = await fetch(\'/api/contact\', {
        method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? \'Something went wrong\')
      setFormState(\'success\')
      form.reset()
    } catch (err: any) {
      setFormState(\'error\')
      setErrorMsg(err.message ?? \'Something went wrong. Please try again.\')
    }
  }

  async function handleSubscribeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubState(\'loading\')
    const form  = e.currentTarget
    const email = (form.elements.namedItem(\'sub-email\') as HTMLInputElement).value.trim()
    try {
      const res = await fetch(\'/api/contact\', {
        method: \'POST\', headers: { \'Content-Type\': \'application/json\' },
        body: JSON.stringify({ email, subscribe: true, subscribeOnly: true }),
      })
      if (!res.ok) throw new Error()
      setSubState(\'success\')
      form.reset()
    } catch {
      setSubState(\'error\')
    }
  }

  return (
    <div className="space-y-10">

      {/* CONTACT FORM */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="font-display text-2xl text-navy-950 mb-2">Send us a message</h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Fill in the form below. We read every message and reply within 2 business days.
        </p>

        {formState === \'success\' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-navy-950 mb-2">Message received</h3>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
              Thank you for getting in touch. We will reply within 2 business days.
            </p>
            <button onClick={() => setFormState(\'idle\')}
              className="mt-6 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors">
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input id="name" name="name" type="text" required placeholder="Jane Smith"
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition" />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input id="email" name="email" type="email" required placeholder="jane@example.com"
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition" />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                Subject <span className="text-red-500">*</span>
              </label>
              <select id="subject" name="subject" required defaultValue=""
                className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 bg-white focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition">
                <option value="" disabled>Select a subject…</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="message" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea id="message" name="message" required rows={6} placeholder="How can we help you?"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition resize-none" />
            </div>
            <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
              <input id="subscribe" name="subscribe" type="checkbox" defaultChecked
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-navy-950 focus:ring-navy-950 shrink-0" />
              <label htmlFor="subscribe" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                Also subscribe me to the free weekly email — exam tips and study guides written by qualified accountants.
              </label>
            </div>
            {formState === \'error\' && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{errorMsg || \'Something went wrong. Please try again.\'}</p>
              </div>
            )}
            <button type="submit" disabled={formState === \'loading\'}
              className="w-full h-12 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm">
              {formState === \'loading\' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Sending…
                </>
              ) : \'Send message\'}
            </button>
            <p className="text-xs text-slate-400 text-center">
              By submitting this form you agree to our{" "}
              <a href="/privacy-policy" className="underline hover:text-navy-700 transition-colors">Privacy Policy</a>.
            </p>
          </form>
        )}
      </div>

      {/* NEWSLETTER-ONLY */}
      <div className="bg-navy-950 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: \'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)\' }} />
        <div className="relative z-10">
          <span className="eyebrow text-gold-400 mb-3 block">Stay Ahead</span>
          <h2 className="font-display text-2xl text-white mb-2 leading-tight">Free exam tips, straight to your inbox</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-lg">
            Weekly study tips and new question releases — written by qualified accountants.
            Join 12,000+ accounting students and professionals.
          </p>
          {subscribeState === \'success\' ? (
            <div className="flex items-center gap-3 bg-white/10 rounded-lg px-5 py-4 border border-white/20 max-w-sm">
              <svg className="w-5 h-5 text-gold-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-white text-sm font-medium">You are subscribed — welcome!</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribeSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
              <input name="sub-email" type="email" required placeholder="your@email.com"
                className="flex-1 h-12 px-4 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" />
              <button type="submit" disabled={subscribeState === \'loading\'}
                className="h-12 px-6 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 disabled:opacity-60 transition-colors whitespace-nowrap">
                {subscribeState === \'loading\' ? \'Subscribing…\' : \'Subscribe free\'}
              </button>
            </form>
          )}
          {subscribeState === \'error\' && (
            <p className="text-red-400 text-xs mt-2">Something went wrong. Please try again.</p>
          )}
          <p className="text-white/30 text-xs mt-4">No spam, ever. Unsubscribe any time.</p>
        </div>
      </div>

    </div>
  )
}
''')

# ─────────────────────────────────────────────────────────────────────────────
# 4. app/api/contact/route.ts  — Supabase only, no Resend
# ─────────────────────────────────────────────────────────────────────────────
write("app/api/contact/route.ts", '''\
// app/api/contact/route.ts
// Saves contact submissions and email subscribers to Supabase.
// No third-party email service required.

import { NextRequest, NextResponse } from \'next/server\'
import { createClient }              from \'@supabase/supabase-js\'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error(\'Supabase env vars missing\')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, subject, message, subscribe, subscribeOnly } = body

    if (!email) {
      return NextResponse.json({ error: \'Email is required\' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. Save contact submission (skip for subscribe-only requests)
    if (!subscribeOnly) {
      if (!name || !subject || !message) {
        return NextResponse.json({ error: \'All fields are required\' }, { status: 400 })
      }
      const { error } = await supabase
        .from(\'contact_submissions\')
        .insert({ name, email, subject, message, created_at: new Date().toISOString() })
      if (error) console.error(\'contact_submissions error:\', error)
    }

    // 2. Add to email_subscribers if opted in
    if (subscribe || subscribeOnly) {
      const { error } = await supabase
        .from(\'email_subscribers\')
        .upsert(
          { email, source: \'contact_form\', subscribed: true, created_at: new Date().toISOString() },
          { onConflict: \'email\', ignoreDuplicates: false }
        )
      if (error) console.error(\'email_subscribers error:\', error)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(\'Contact API error:\', err)
    return NextResponse.json({ error: \'Internal server error.\' }, { status: 500 })
  }
}
''')

# ─────────────────────────────────────────────────────────────────────────────
# 5. app/privacy-policy/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
write("app/privacy-policy/page.tsx", '''\
// app/privacy-policy/page.tsx
import type { Metadata } from \'next\'
import Link from \'next/link\'

export const metadata: Metadata = {
  title: \'Privacy Policy — AccountingBody\',
  description: \'How AccountingBody collects, uses, and protects your personal data. Last updated March 2026.\',
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: \'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)\' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Privacy Policy</h1>
          <p className="text-white/50 text-sm">Last updated: March 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            <aside className="lg:col-span-1 hidden lg:block">
              <div className="sticky top-8 bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-bold text-navy-950 uppercase tracking-widest mb-4">Contents</p>
                <nav className="space-y-2">
                  {[
                    [\'#who-we-are\',\'Who we are\'],[\'#what-we-collect\',\'Data we collect\'],
                    [\'#how-we-use\',\'How we use it\'],[\'#third-parties\',\'Third parties\'],
                    [\'#cookies\',\'Cookies\'],[\'#your-rights\',\'Your rights\'],
                    [\'#retention\',\'Retention\'],[\'#contact\',\'Contact us\'],
                  ].map(([href,label]) => (
                    <a key={href} href={href}
                      className="block text-sm text-slate-500 hover:text-navy-950 transition-colors py-0.5">{label}</a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="lg:col-span-3 space-y-10">
              <div className="border-l-4 border-gold-400 pl-5">
                <p className="text-slate-600 text-base leading-relaxed">
                  AccountingBody is committed to protecting your privacy. This policy explains what personal data
                  we collect, how we use it, and the rights you have over it.
                </p>
              </div>

              {[
                {
                  id: \'who-we-are\', title: \'1. Who we are\',
                  body: \'AccountingBody operates the website accountingbody.com — an accounting and finance education platform. For privacy questions email privacy@accountingbody.com.\',
                },
                {
                  id: \'what-we-collect\', title: \'2. Data we collect\',
                  body: \'We collect: name and email when you register; contact form submissions; newsletter opt-ins; usage analytics (pages visited, device type, approximate country); and cookies. See our Cookie Policy for cookie details.\',
                },
                {
                  id: \'how-we-use\', title: \'3. How we use your data\',
                  body: \'We use your data to: provide and improve the platform; respond to contact enquiries; send the weekly newsletter to subscribers who opted in; manage Pro subscriptions; and monitor performance. We do not sell your data.\',
                },
                {
                  id: \'third-parties\', title: \'4. Third parties\',
                  body: \'We use: Supabase (database); Vercel (hosting); Clerk (authentication); Lemon Squeezy (payments — we never store card details ourselves); and Cloudflare (DNS and security). All processors handle your data in compliance with applicable data protection law.\',
                },
                {
                  id: \'cookies\', title: \'5. Cookies\',
                  body: \'We use cookies for authentication, site performance, and optional analytics. See our full Cookie Policy for details.\',
                },
                {
                  id: \'your-rights\', title: \'6. Your rights\',
                  body: \'Under UK GDPR you have the right to access, correct, delete, restrict, and port your data, and to withdraw consent at any time. Email privacy@accountingbody.com. You may also complain to the ICO at ico.org.uk.\',
                },
                {
                  id: \'retention\', title: \'7. Data retention\',
                  body: \'Contact submissions: 24 months. Email subscribers: until unsubscribed + 30 days. Account data: lifetime of account + 90 days. Usage analytics: anonymised after 26 months.\',
                },
                {
                  id: \'contact\', title: \'8. Contact us\',
                  body: \'Email: privacy@accountingbody.com. Contact form: accountingbody.com/contact. This policy was last updated March 2026.\',
                },
              ].map(s => (
                <div key={s.id} id={s.id} className="scroll-mt-8">
                  <h2 className="font-display text-xl text-navy-950 mb-3">{s.title}</h2>
                  <p className="text-slate-500 leading-relaxed text-sm">{s.body}</p>
                </div>
              ))}

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h2 className="font-display text-xl text-navy-950 mb-3">Questions?</h2>
                <div className="flex flex-wrap gap-3">
                  <Link href="/contact"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                    Contact us
                  </Link>
                  <Link href="/cookie-policy"
                    className="inline-flex items-center h-10 px-5 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors">
                    Cookie Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/cookie-policy"  className="hover:text-navy-700 transition-colors">Cookie Policy</Link>
          <Link href="/disclaimer"     className="hover:text-navy-700 transition-colors">Disclaimer</Link>
          <Link href="/contact"        className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
''')

# ─────────────────────────────────────────────────────────────────────────────
# 6. app/cookie-policy/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
write("app/cookie-policy/page.tsx", '''\
// app/cookie-policy/page.tsx
import type { Metadata } from \'next\'
import Link from \'next/link\'

export const metadata: Metadata = {
  title: \'Cookie Policy — AccountingBody\',
  description: \'How AccountingBody uses cookies and how to manage your preferences. Last updated March 2026.\',
}

const cookies = [
  { category: \'Necessary\',  bar: \'bg-teal-600\',  always: true,
    items: [
      { name: \'__session\',      provider: \'Clerk\',       purpose: \'Maintains your login session.\',                     duration: \'7 days\' },
      { name: \'_cf_clearance\',  provider: \'Cloudflare\',  purpose: \'Security — proves your browser passed a challenge.\', duration: \'30 mins\' },
      { name: \'sb-*\',           provider: \'Supabase\',    purpose: \'Stores authentication tokens for account data.\',    duration: \'7 days\' },
    ],
  },
  { category: \'Analytics\',  bar: \'bg-navy-800\',  always: false,
    items: [
      { name: \'_va_*\',  provider: \'Vercel Analytics\', purpose: \'Privacy-first page view counting. No personal data stored.\', duration: \'Session\' },
      { name: \'_ga\',    provider: \'Google Analytics\', purpose: \'Tracks pages visited and time on site (optional).\',          duration: \'2 years\' },
    ],
  },
  { category: \'Functional\', bar: \'bg-gold-500\',  always: false,
    items: [
      { name: \'ab_preferences\', provider: \'AccountingBody\', purpose: \'Stores your preferences such as calculator settings.\', duration: \'1 year\' },
    ],
  },
]

export default function CookiePolicyPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: \'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)\' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Cookie Policy</h1>
          <p className="text-white/50 text-sm">Last updated: March 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl">
            <div className="border-l-4 border-gold-400 pl-5 mb-10">
              <p className="text-slate-600 text-base leading-relaxed">
                Cookies are small text files stored on your device. This policy explains every cookie
                AccountingBody uses and how to control your preferences.
              </p>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-6">Cookies we use</h2>
            <div className="space-y-6 mb-10">
              {cookies.map(cat => (
                <div key={cat.category} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <span className={`w-3 h-3 rounded-full ${cat.bar}`} />
                    <h3 className="font-semibold text-navy-950 text-sm">{cat.category} cookies</h3>
                    {cat.always && <span className="ml-auto text-xs text-slate-400 italic">Always active</span>}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {cat.items.map(item => (
                      <div key={item.name} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-5">
                        <div>
                          <code className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{item.name}</code>
                          <span className="text-xs text-slate-400 block mt-1">{item.provider}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{item.purpose}</p>
                        <p className="text-xs text-slate-500">{item.duration}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">How to manage cookies</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              You can control cookies through your browser settings. Disabling necessary cookies will prevent the site
              from working correctly. You can also opt out of Google Analytics at{" "}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer"
                className="text-navy-700 underline hover:text-gold-600 transition-colors">
                tools.google.com/dlpage/gaoptout
              </a>.
            </p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
              <h2 className="font-display text-xl text-navy-950 mb-3">Questions?</h2>
              <Link href="/contact"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/privacy-policy" className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/disclaimer"     className="hover:text-navy-700 transition-colors">Disclaimer</Link>
          <Link href="/contact"        className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
''')

# ─────────────────────────────────────────────────────────────────────────────
# 7. app/disclaimer/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
write("app/disclaimer/page.tsx", '''\
// app/disclaimer/page.tsx
import type { Metadata } from \'next\'
import Link from \'next/link\'

export const metadata: Metadata = {
  title: \'Disclaimer — AccountingBody\',
  description: \'Important disclaimers regarding the accuracy and use of content on AccountingBody. Last updated March 2026.\',
}

const sections = [
  {
    id: \'general\', title: \'1. General disclaimer\',
    body: [
      \'The content on AccountingBody is provided for educational and informational purposes only. While we make every effort to ensure accuracy, we make no warranties about the completeness, reliability, or suitability of any content on this site.\',
      \'Your use of any content is entirely at your own risk. AccountingBody shall not be liable for any loss or damage arising from the use of, or inability to use, materials on this site.\',
    ],
  },
  {
    id: \'not-advice\', title: \'2. Not professional advice\',
    body: [
      \'Nothing on AccountingBody constitutes professional accounting, tax, legal, or financial advice. Study notes and articles are designed to help students understand concepts for educational purposes — they are not a substitute for advice from a qualified professional.\',
      \'If you require professional advice, consult a qualified and appropriately regulated professional.\',
    ],
  },
  {
    id: \'exam-content\', title: \'3. Exam content and syllabus accuracy\',
    body: [
      \'Professional accounting qualifications — including ACCA, CIMA, AAT, ICAEW, and others — are managed by independent examining bodies whose syllabuses can change at any time. AccountingBody strives to keep content current, but cannot guarantee it reflects the very latest syllabus.\',
      \'Always cross-reference with the official published syllabus. AccountingBody is not affiliated with, endorsed by, or officially connected to any professional accounting body.\',
    ],
  },
  {
    id: \'third-party\', title: \'4. Third-party links\',
    body: [
      \'AccountingBody may contain links to external websites. These links are provided for convenience only. We have no control over those sites and accept no responsibility for them or for any loss arising from your use of them.\',
    ],
  },
  {
    id: \'errors\', title: \'5. Errors and corrections\',
    body: [
      \'We take accuracy seriously. If you believe any content contains an error, please report it via our contact form. We will investigate and correct verified errors promptly.\',
      \'Despite our best efforts, AccountingBody cannot accept responsibility for errors or omissions, or for any loss resulting from reliance on such content.\',
    ],
  },
  {
    id: \'ip\', title: \'6. Intellectual property\',
    body: [
      \'All original content on AccountingBody — including study notes, practice questions, and guides — is the intellectual property of AccountingBody unless otherwise stated. Content may not be reproduced or republished without prior written permission.\',
    ],
  },
  {
    id: \'changes\', title: \'7. Changes to this disclaimer\',
    body: [
      \'We may update this disclaimer at any time. The last updated date at the top reflects the most recent revision. Continued use of the site after changes constitutes acceptance of the updated disclaimer.\',
    ],
  },
]

export default function DisclaimerPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: \'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)\' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Legal</span>
          <h1 className="font-display text-white mb-3 leading-tight">Disclaimer</h1>
          <p className="text-white/50 text-sm">Last updated: March 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            <aside className="lg:col-span-1 hidden lg:block">
              <div className="sticky top-8 bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-bold text-navy-950 uppercase tracking-widest mb-4">Contents</p>
                <nav className="space-y-2">
                  {sections.map(s => (
                    <a key={s.id} href={`#${s.id}`}
                      className="block text-sm text-slate-500 hover:text-navy-950 transition-colors py-0.5">
                      {s.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="border-l-4 border-gold-400 pl-5 mb-10">
                <p className="text-slate-600 text-base leading-relaxed">
                  Please read this disclaimer carefully before using accountingbody.com.
                  By using this site, you accept the terms set out below.
                </p>
              </div>

              <div className="space-y-10">
                {sections.map(s => (
                  <div key={s.id} id={s.id} className="scroll-mt-8">
                    <h2 className="font-display text-xl text-navy-950 mb-4">{s.title}</h2>
                    <div className="space-y-3">
                      {s.body.map((para, i) => (
                        <p key={i} className="text-slate-500 leading-relaxed text-sm">{para}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 bg-slate-50 rounded-xl border border-slate-200 p-6">
                <h2 className="font-display text-xl text-navy-950 mb-3">Questions?</h2>
                <div className="flex flex-wrap gap-3">
                  <Link href="/contact"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                    Contact us
                  </Link>
                  <Link href="/privacy-policy"
                    className="inline-flex items-center h-10 px-5 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/privacy-policy" className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/cookie-policy"  className="hover:text-navy-700 transition-colors">Cookie Policy</Link>
          <Link href="/contact"        className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
''')

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
print("\nAll files created successfully.\n")
print("Next steps:")
print("  1. Run the SQL in Supabase (see instructions below)")
print("  2. Update your nav/footer components")
print("  3. git add . && git commit -m 'Add static pages' && git push")
