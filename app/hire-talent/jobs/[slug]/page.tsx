import Link from 'next/link'

export default function JobPage() {
  return (
    <main className="min-h-screen bg-surface py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="text-5xl mb-6">🔎</div>
        <h1 className="text-2xl font-bold text-navy-950 mb-4">Job Not Found</h1>
        <p className="text-slate-500 mb-8">This role may no longer be active or the link may have changed.</p>
        <Link href="/hire-talent/jobs" className="inline-block bg-navy-950 text-white font-semibold px-8 h-11 px-6 rounded-lg flex items-center justify-center hover:bg-navy-900 transition-colors">← Browse All Jobs</Link>
      </div>
    </main>
  )
}
