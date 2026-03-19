// app/contact/page.tsx
import type { Metadata } from 'next'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact AccountingBody — Get in Touch',
  description:
    'Have a question, content partnership enquiry, or want to report an error? Get in touch with the AccountingBody team.',
}

const faqs = [
  {
    q: 'Is AccountingBody really free?',
    a: 'Yes. Study notes, the full glossary, and core practice questions are permanently free — no credit card, no trial, no hidden fees.',
  },
  {
    q: 'How quickly do you reply to messages?',
    a: 'We aim to reply to all messages within 2 business days. Technical issues are prioritised.',
  },
  {
    q: 'Can I contribute articles or study notes?',
    a: 'Yes — if you are a qualified accountant and want to contribute, select "Content Partnership" as the subject.',
  },
  {
    q: 'I found an error in your content. How do I report it?',
    a: 'Please use the contact form and select "Content Error". We take accuracy very seriously and will correct any errors promptly.',
  },
  {
    q: 'Do you offer institutional or group licences?',
    a: 'Yes. We offer discounted group access for training providers, universities, and employers. Select "Enterprise Enquiry" in the form.',
  },
]

export default function ContactPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-25"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
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
                    { label: 'Email',         value: 'hello@accountingbody.com' },
                    { label: 'Response time',  value: 'Within 2 business days' },
                    { label: 'Based in',       value: 'United Kingdom' },
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
                  style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
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
