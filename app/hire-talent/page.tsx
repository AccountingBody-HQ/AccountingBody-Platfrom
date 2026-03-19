import Link from 'next/link'

const roleCategories = [
  { title: 'Accountant', icon: '📊' },
  { title: 'Bookkeeper', icon: '📒' },
  { title: 'CFO', icon: '👔' },
  { title: 'Tax Advisor', icon: '🧾' },
  { title: 'Auditor', icon: '🔍' },
  { title: 'Payroll Manager', icon: '💷' },
  { title: 'Finance Director', icon: '📈' },
  { title: 'Management Accountant', icon: '📋' },
  { title: 'Financial Controller', icon: '🏦' },
  { title: 'Credit Controller', icon: '💳' },
  { title: 'Accounts Assistant', icon: '🗂️' },
  { title: 'Practice Manager', icon: '🏢' },
]

export default function HireTalentPage() {
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="eyebrow text-gold-400 mb-4 block">Talent Marketplace</span>
              <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight">
                Find Top Accounting &amp; Finance Talent
              </h1>
              <p className="text-white/60 text-xl leading-relaxed mb-10">
                Connect with qualified accounting professionals across the UK — from bookkeepers to CFOs. Post a role or browse open positions today.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/hire-talent/post-a-job" className="h-12 px-7 flex items-center text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">Post a Job</Link>
                <Link href="/hire-talent/jobs" className="h-12 px-7 flex items-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all">Browse Jobs</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Specialist Platform', value: 'Accounting' },
                { label: 'Coverage', value: 'UK Wide' },
                { label: 'Role Types', value: '12+' },
                { label: 'Response Time', value: '< 24hrs' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-2xl p-6 text-center">
                  <div className="font-display text-xl text-gold-400 mb-1">{stat.value}</div>
                  <div className="text-sm text-white/50">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0f2444] mb-4">Browse by Role</h2>
            <p className="text-gray-500 text-lg">Roles across every accounting and finance specialism.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {roleCategories.map((role) => (
              <Link key={role.title} href={`/hire-talent/jobs?role=${encodeURIComponent(role.title)}`}
                className="bg-white border border-gray-100 rounded-2xl p-6 text-center hover:border-[#c9963f] hover:shadow-md transition-all group">
                <div className="text-3xl mb-3">{role.icon}</div>
                <h3 className="font-bold text-[#0f2444] text-sm group-hover:text-[#c9963f] transition-colors">{role.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm">
            <h3 className="text-2xl font-bold text-[#0f2444] mb-6">For Employers</h3>
            <ul className="space-y-4 text-gray-600 text-sm mb-8">
              {['Post jobs to a targeted accounting audience','Reach qualified professionals across the UK','Receive applications directly to your inbox','Hire faster with pre-screened candidates'].map((item) => (
                <li key={item} className="flex items-start gap-3"><span className="text-[#c9963f] font-bold mt-0.5">✓</span>{item}</li>
              ))}
            </ul>
            <Link href="/hire-talent/post-a-job" className="inline-block bg-[#0f2444] text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#1a3a6b] transition-colors text-sm">Post a Job →</Link>
          </div>
          <div className="bg-[#0f2444] text-white rounded-2xl p-10">
            <h3 className="text-2xl font-bold mb-6">For Job Seekers</h3>
            <ul className="space-y-4 text-blue-200 text-sm mb-8">
              {['Browse roles matched to your specialism','Apply directly through the platform','Roles from firms and businesses across the UK','Dedicated accounting and finance focus'].map((item) => (
                <li key={item} className="flex items-start gap-3"><span className="text-[#c9963f] font-bold mt-0.5">✓</span>{item}</li>
              ))}
            </ul>
            <Link href="/hire-talent/jobs" className="inline-block bg-[#c9963f] text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#b8852e] transition-colors text-sm">Browse Jobs →</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
