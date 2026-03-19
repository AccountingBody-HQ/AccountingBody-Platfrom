// app/accessibility/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Accessibility Statement — AccountingBody',
  description: 'AccountingBody is committed to making its website accessible to everyone. Read our accessibility statement.',
}

const standards = [
  {
    title: 'Keyboard navigation',
    body: 'All interactive elements — links, buttons, and form fields — are fully accessible via keyboard. Focus states are clearly visible throughout the site.',
  },
  {
    title: 'Screen reader support',
    body: 'We use semantic HTML, proper heading hierarchy, ARIA labels, and descriptive alt text to ensure the site works well with screen readers including NVDA, JAWS, and VoiceOver.',
  },
  {
    title: 'Colour contrast',
    body: 'Text and interactive elements meet or exceed WCAG 2.1 AA contrast ratio requirements. We do not rely on colour alone to convey information.',
  },
  {
    title: 'Responsive design',
    body: 'AccountingBody works on all screen sizes from mobile to desktop. Text can be resized up to 200% without loss of content or functionality.',
  },
  {
    title: 'Forms and inputs',
    body: 'All form fields have visible labels, clear error messages, and do not rely solely on placeholder text. Required fields are clearly marked.',
  },
  {
    title: 'Motion and animation',
    body: 'Animations are subtle and functional. Users who prefer reduced motion will see minimal animation as we respect the prefers-reduced-motion media query.',
  },
]

const known = [
  'Some older PDF documents may not be fully accessible to screen readers. We are working to update these.',
  'Some embedded third-party content (such as video players) may have accessibility limitations outside our direct control.',
  'The Sanity Studio editor interface (available to content editors only) uses third-party components that may not fully meet all WCAG criteria.',
]

export default function AccessibilityPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Accessibility</span>
          <h1 className="font-display text-white mb-3 leading-tight">Accessibility Statement</h1>
          <p className="text-white/50 text-sm">Last updated: March 2026</p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl">

            <div className="border-l-4 border-gold-400 pl-5 mb-10">
              <p className="text-slate-600 text-base leading-relaxed">
                AccountingBody is committed to ensuring that its website is accessible to everyone —
                including people with disabilities. We aim to conform to the Web Content Accessibility
                Guidelines (WCAG) 2.1 at Level AA.
              </p>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-6">What we do to support accessibility</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
              {standards.map(s => (
                <div key={s.title} className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                    <h3 className="font-semibold text-navy-950 text-sm">{s.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">Known limitations</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Despite our best efforts, some areas of the site may not yet fully meet WCAG 2.1 AA standards.
              Known limitations include:
            </p>
            <ul className="space-y-3 mb-10">
              {known.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                  </span>
                  <p className="text-sm text-slate-500 leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>

            <h2 className="font-display text-2xl text-navy-950 mb-4">Feedback and contact</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              We welcome feedback on the accessibility of AccountingBody. If you experience any barriers
              or have suggestions for improvement, please get in touch. We aim to respond to accessibility
              feedback within 5 business days.
            </p>

            <div className="bg-navy-950 rounded-xl p-6 relative overflow-hidden mb-10">
              <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
              <div className="relative z-10">
                <h3 className="font-display text-white text-lg mb-2">Report an accessibility issue</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-4">
                  If you cannot access any part of this site or need content in a different format,
                  contact us and we will do our best to help.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/contact"
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">
                    Contact us
                  </Link>
                  <a href="mailto:accessibility@accountingbody.com"
                    className="inline-flex items-center h-10 px-5 rounded-lg text-sm font-medium text-white border border-white/25 hover:bg-white/10 transition-colors">
                    accessibility@accountingbody.com
                  </a>
                </div>
              </div>
            </div>

            <h2 className="font-display text-2xl text-navy-950 mb-4">Technical information</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-3">
              AccountingBody is built with Next.js 14 using semantic HTML5, Tailwind CSS, and
              React. The site is tested using keyboard navigation, the WAVE accessibility tool,
              and VoiceOver on macOS.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              This statement was prepared in March 2026 and will be reviewed annually or whenever
              significant changes are made to the site.
            </p>

          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="container-site flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="font-medium text-navy-950">Related:</span>
          <Link href="/privacy-policy"  className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          <Link href="/terms"           className="hover:text-navy-700 transition-colors">Terms of Service</Link>
          <Link href="/contact"         className="hover:text-navy-700 transition-colors">Contact Us</Link>
        </div>
      </section>
    </>
  )
}
