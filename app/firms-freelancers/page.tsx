import Link from 'next/link'

const benefits = [
  { icon: '🌐', title: 'Global Reach', desc: 'Get discovered by businesses and individuals across the UK and beyond.' },
  { icon: '⭐', title: 'Verified Listings', desc: 'All profiles are reviewed to maintain quality and trust.' },
  { icon: '📩', title: 'Direct Enquiries', desc: 'Clients contact you directly through your profile page.' },
  { icon: '📊', title: 'Showcase Your Work', desc: 'Highlight your specialisms, qualifications and experience.' },
]

export default function FirmsFreelancersPage() {
  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: "radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <span className="eyebrow text-gold-400 mb-4 block">Professional Directory</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight">
              The Accounting Firms &amp; Freelancers Directory
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10">
              Find a trusted accounting firm or freelance professional — or list your practice and get discovered by clients looking for your expertise.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/firms-freelancers/directory" className="h-12 px-7 flex items-center text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">Browse Directory →</Link>
              <Link href="/firms-freelancers/join" className="h-12 px-7 flex items-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all">List Your Practice</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0f2444] mb-4">Why Join the Directory?</h2>
            <p className="text-gray-500 text-lg">Grow your practice with a profile on the UK&apos;s dedicated accounting directory.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="text-4xl mb-4">{b.icon}</div>
                <h3 className="font-bold text-[#0f2444] text-lg mb-3">{b.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
            <div className="text-4xl mb-5">🔍</div>
            <h3 className="text-2xl font-bold text-[#0f2444] mb-4">Looking for a Professional?</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">Search our directory of verified accounting firms and freelancers by location and specialism.</p>
            <Link href="/firms-freelancers/directory" className="inline-block bg-[#0f2444] text-white font-semibold px-8 py-4 rounded-lg hover:bg-[#1a3a6b] transition-colors">Browse Directory →</Link>
          </div>
          <div className="bg-[#0f2444] text-white rounded-2xl p-10 text-center">
            <div className="text-4xl mb-5">🏢</div>
            <h3 className="text-2xl font-bold mb-4">Are You an Accountant?</h3>
            <p className="text-blue-200 text-sm mb-8 leading-relaxed">Get listed in front of thousands of businesses and individuals searching for accounting help.</p>
            <Link href="/firms-freelancers/join" className="inline-block bg-[#c9963f] text-white font-semibold px-8 py-4 rounded-lg hover:bg-[#b8852e] transition-colors">Join the Directory →</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
