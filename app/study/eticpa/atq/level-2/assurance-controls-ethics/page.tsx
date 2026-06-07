import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getETICPAModuleArticles } from '@/lib/sanity-queries'
import type { ArticleSummary } from '@/lib/sanity-queries'

export const revalidate = 3600

const MODULE = {
  level: 'level-2',
  levelLabel: 'Level 2 — Advanced Technician',
  slug: 'assurance-controls-ethics',
  name: 'Assurance, Controls & Ethics',
  description: 'Build the professional integrity and assurance expertise that defines a trusted finance professional. This module covers internal controls, audit procedures, professional ethics, risk assessment and assurance engagements — the disciplines that protect organisations and uphold public trust in Ethiopian finance.',
  outcomes: [
    'Design and evaluate internal control systems for Ethiopian organisations',
    'Apply audit procedures to assess the reliability of financial information',
    'Demonstrate professional ethics and integrity in all finance activities',
    'Identify and assess risks within an organisational context',
    'Plan and execute assurance engagements in accordance with professional standards',
  ],
  topics: [
    { name: 'Internal Controls', slug: 'internal-controls' },
    { name: 'Audit Procedures', slug: 'audit-procedures' },
    { name: 'Professional Ethics', slug: 'professional-ethics' },
    { name: 'Risk Assessment', slug: 'risk-assessment' },
    { name: 'Assurance Engagements', slug: 'assurance-engagements' },
  ],
  prevModule: {
    name: 'Management Accounting',
    href: '/study/eticpa/atq/level-2/management-accounting',
  },
  nextModule: {
    name: 'Ethiopian Taxation',
    href: '/study/eticpa/atq/level-2/ethiopian-taxation',
  },
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/study/eticpa/${article.slug.current}`}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    >
      <div className="h-1 bg-[#1A4731]" />
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#f0f7f4] text-[#1A4731]">
            ATQ Level 2
          </span>
          {article.readTime && (
            <span className="text-xs text-slate-400">{article.readTime} min read</span>
          )}
        </div>
        <h3 className="font-display text-base text-navy-950 leading-snug mb-3 group-hover:text-[#1A4731] transition-colors flex-1">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">{article.excerpt}</p>
        )}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1A4731] group-hover:gap-2.5 transition-all mt-auto">
          Read note
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

export default async function AssuranceControlsEthicsPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/study')

  const articles = await getETICPAModuleArticles(MODULE.level, MODULE.slug)

  return (
    <div>

      {/* HERO */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ backgroundColor: '#1A4731' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #C9982A 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa" className="hover:text-white/70 transition-colors">ETICPA</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa/atq/level-2" className="hover:text-white/70 transition-colors">ATQ Level 2</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Assurance, Controls & Ethics</span>
          </nav>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold px-3 py-1.5 rounded-md" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                ATQ Level 2
              </span>
              <span className="text-xs font-semibold text-white/50">Advanced Technician</span>
            </div>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Assurance, Controls
              <br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                & Ethics
              </span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">
              {MODULE.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="#study-notes"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Browse study notes
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="#topics"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
                style={{ height: '48px', width: '220px', boxSizing: 'border-box' }}>
                View all topics
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* OVERVIEW */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Module Overview</span>
              <h2 className="section-title mb-6">What this module covers</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Assurance, Controls & Ethics is the third module of ATQ Level 2. It develops the professional standards and assurance skills that underpin trust in financial reporting — covering everything from internal controls to ethical decision-making.
              </p>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-4">Learning Outcomes</p>
                {MODULE.outcomes.map((outcome, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                      <svg className="w-3 h-3" fill="none" stroke="#C9982A" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed">{outcome}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-8 border" style={{ backgroundColor: '#f0f7f4', borderColor: '#d1e8db' }}>
              <p className="font-display text-xl text-navy-950 mb-6">Module at a glance</p>
              <div className="space-y-4">
                {[
                  { label: 'Qualification', value: 'ATQ — Accounting Technician Qualification' },
                  { label: 'Level', value: 'Level 2 — Advanced Technician' },
                  { label: 'Module', value: 'Assurance, Controls & Ethics' },
                  { label: 'Topics', value: '5 core topics' },
                  { label: 'Study Notes', value: `${articles.length} published` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-3 border-b border-white/60">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{item.label}</span>
                    <span className="text-sm font-semibold text-navy-950 text-right max-w-[60%]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOPICS */}
      <section id="topics" className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Syllabus</span>
            <h2 className="section-title mb-4">All topics in this module</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Five core topics make up Assurance, Controls & Ethics. Study notes are published for each topic as they are completed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULE.topics.map((topic, i) => (
              <div key={topic.slug} className="flex items-center gap-4 p-5 rounded-xl bg-white border border-slate-200">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
                  style={{ backgroundColor: '#1A4731' }}>
                  {i + 1}
                </span>
                <p className="text-sm font-semibold text-navy-950">{topic.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STUDY NOTES */}
      <section id="study-notes" className="section bg-white border-t border-slate-100">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Study Notes</span>
              <h2 className="section-title mb-4">Assurance, Controls & Ethics notes</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Professionally written study notes covering every topic in this module — free and built for exam success.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-4xl" style={{ color: '#1A4731' }}>{articles.length}</p>
              <p className="text-slate-400 text-sm">notes published</p>
            </div>
          </div>
          {articles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {articles.map((article) => (
                <ArticleCard key={article._id} article={article} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl p-12 text-center border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <p className="font-display text-xl text-navy-950 mb-2">Study notes coming soon</p>
              <p className="text-slate-500 text-sm">Use Content Factory to publish notes for this module. They will appear here automatically.</p>
            </div>
          )}
        </div>
      </section>

      {/* NAVIGATION */}
      <section className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href={MODULE.prevModule.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 transition-colors"
              style={{ borderColor: '#1A4731', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
              {MODULE.prevModule.name}
            </Link>
            <Link href={MODULE.nextModule.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#1A4731', color: 'white', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Next: {MODULE.nextModule.name}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
