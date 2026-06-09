'use client'

export default function ComingSoonExamCard({ name, level }: { name: string; level: string }) {
  return (
    <button
      onClick={() => alert('Mock exam coming soon — check back once study content is published for this module.')}
      className="group flex flex-col p-6 rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:shadow-lg hover:border-slate-300 text-left cursor-pointer w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold px-2.5 py-1 rounded-md"
          style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>{level}</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-400">Coming Soon</span>
      </div>
      <h3 className="font-display text-base text-slate-400 leading-snug mb-1">{name}</h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">Study content being prepared</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-auto text-slate-300">
        Coming soon
      </span>
    </button>
  )
}
