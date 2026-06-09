'use client'

export default function ComingSoonExamCard({ name, level }: { name: string; level: string }) {
  return (
    <button
      onClick={() => alert('Mock exam coming soon — check back once study content is published for this module.')}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-md text-left w-full cursor-pointer">
      <div className="h-1 bg-slate-200" />
      <div className="p-6 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-bold px-2.5 py-1 rounded-md"
            style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>{level}</span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-400">
            Coming Soon
          </span>
        </div>
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-slate-50 border border-slate-100">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
            <circle cx="24" cy="26" r="14" stroke="#cbd5e1" strokeWidth="2"/>
            <path d="M24 18v8l5 3" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 8h8M24 8v4" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        {/* Title */}
        <h3 className="font-display text-base text-slate-400 leading-snug mb-2">{name}</h3>
        {/* Stats placeholder */}
        <div className="flex items-center gap-4 mb-5">
          <div>
            <p className="font-display text-xl font-bold text-slate-200">—</p>
            <p className="text-xs text-slate-300">questions in pool</p>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div>
            <p className="font-display text-xl font-bold text-slate-200">50</p>
            <p className="text-xs text-slate-300">per attempt</p>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div>
            <p className="font-display text-xl font-bold text-slate-200">∞</p>
            <p className="text-xs text-slate-300">attempts</p>
          </div>
        </div>
        {/* CTA */}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-auto text-slate-300">
          Exam not yet available
        </span>
      </div>
    </button>
  )
}
