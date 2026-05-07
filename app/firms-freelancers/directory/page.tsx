import Link from 'next/link'

export default function DirectoryPage() {
  return (
    <main className="min-h-screen bg-surface">
            <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: "radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="container-site relative z-10">
          <span className="eyebrow text-gold-400 mb-4 block">Directory</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">Accounting Firms &amp; Freelancers</h1>
          <p className="text-white/60 text-xl leading-relaxed">Verified accounting professionals across the UK, searchable by specialism and location.</p>
        </div>
      </section>
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center py-24">
          <div className="text-6xl mb-6">🏢</div>
          <h2 className="text-2xl font-bold text-navy-950 mb-3">Directory Launching Soon</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
            We are building our professional directory. Be among the first to list your practice.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/firms-freelancers/join" className="inline-block bg-navy-950 text-white font-semibold px-8 h-11 px-6 rounded-lg flex items-center justify-center hover:bg-navy-900 transition-colors">List Your Practice →</Link>
            <Link href="/get-help" className="inline-block border border-navy-950 text-navy-950 font-semibold px-8 h-11 px-6 rounded-lg flex items-center justify-center hover:bg-navy-950 hover:text-white transition-colors">Get Matched Instead</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
