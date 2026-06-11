import { headers } from 'next/headers'

export default async function AboutEthioTaxPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) return null

  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section style={{ backgroundColor: '#1A4731' }} className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-4">
            <a href="/" className="text-sm" style={{ color: '#C9982A' }}>Home</a>
            <span className="text-green-200 mx-2">/</span>
            <span className="text-green-200 text-sm">About EthioTax</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
            About EthioTax
          </h1>
          <p className="text-green-100 text-xl max-w-3xl mb-10">
            EthioTax is a managed professional services firm built exclusively for the Ethiopian community. We deliver accounting, tax, audit, payroll and business consulting to the highest professional standards &mdash; wherever you are in the world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm" style={{ backgroundColor: '#C9982A', color: '#fff' }}>
              Enquire about a service
            </a>
            <a href="/how-it-works" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2 border-white text-white">
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* OUR MISSION */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR MISSION</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-6">For the Ethiopian Community &mdash; Worldwide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">The Ethiopian community &mdash; whether in Addis Ababa, London, Washington DC, Toronto, Dubai or Stockholm &mdash; has long deserved a professional services firm that truly understands its needs.</p>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">EthioTax was built to fill that gap. Our team of specialists delivers accounting, tax, audit, payroll and business consulting services to individuals and businesses across the globe &mdash; with the expertise, cultural understanding and language capability that our community deserves.</p>
              <p className="text-gray-600 text-lg leading-relaxed">Every engagement is managed end-to-end by EthioTax. You deal with us. We handle everything.</p>
            </div>
            <div className="rounded-2xl p-8" style={{ backgroundColor: '#f0f7f4', borderLeft: '4px solid #1A4731' }}>
              <p className="font-display text-2xl text-gray-900 mb-2">Our mission</p>
              <p className="text-gray-600 leading-relaxed mb-6">To make world-class professional financial services accessible to every member of the Ethiopian community, wherever they are in the world &mdash; delivered in their language, by specialists who understand their context.</p>
              <p className="font-display text-2xl text-gray-900 mb-2">Our vision</p>
              <p className="text-gray-600 leading-relaxed">To become the most trusted professional services firm in the global Ethiopian community &mdash; the first call for tax, accounting, business and finance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUR TEAM */}
      <section className="py-20" style={{ backgroundColor: '#f0f7f4' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR TEAM</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Our team of specialists</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Every EthioTax engagement is handled by a qualified specialist with the credentials, experience and jurisdictional expertise relevant to your specific needs.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 border" style={{ borderColor: '#d1e8db' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2a4 4 0 100 8 4 4 0 000-8zm0 10c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Qualified professionals</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Every specialist in our team holds the qualifications and credentials required for the services they deliver &mdash; across every jurisdiction we operate in.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border" style={{ borderColor: '#d1e8db' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2a4 4 0 100 8 4 4 0 000-8zm0 10c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Jurisdictional expertise</h3>
              <p className="text-gray-600 text-sm leading-relaxed">From UK Self Assessment to ERCA filings, US Federal returns to Ethiopian statutory accounts &mdash; our specialists understand the regulatory landscape in every market we serve.</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border" style={{ borderColor: '#d1e8db' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2a4 4 0 100 8 4 4 0 000-8zm0 10c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Cultural understanding</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Our team understands Ethiopian business culture, community needs and the specific challenges facing both diaspora professionals and businesses operating inside Ethiopia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUR LANGUAGES */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR LANGUAGES</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Professional services in your language</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Every stage of your engagement &mdash; from first contact to final delivery &mdash; can be conducted in the language you are most comfortable with.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">English</h3>
              <p className="text-gray-600 text-sm leading-relaxed">The primary language of all formal deliverables, proposals and documentation.</p>
            </div>
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Amharic</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Full service available in Amharic &mdash; from first enquiry to final delivery.</p>
            </div>
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Afaan Oromoo</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Full service available in Afaan Oromoo &mdash; from first enquiry to final delivery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUR COMMUNITY */}
      <section className="py-20" style={{ backgroundColor: '#1A4731' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#C9982A' }}>OUR COMMUNITY</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Ethiopia and its global diaspora</h2>
          <p className="text-green-100 text-lg mb-12 max-w-3xl">EthioTax serves the Ethiopian community wherever they are &mdash; inside Ethiopia and across every major diaspora market worldwide.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Ethiopia</p>
              <p className="text-green-200 text-sm">Addis Ababa and all regions</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">United Kingdom</p>
              <p className="text-green-200 text-sm">London, Sheffield, Milton Keynes</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">United States</p>
              <p className="text-green-200 text-sm">Washington DC, Minneapolis, Dallas</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Canada</p>
              <p className="text-green-200 text-sm">Toronto, Calgary</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">UAE</p>
              <p className="text-green-200 text-sm">Dubai, Abu Dhabi</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Sweden</p>
              <p className="text-green-200 text-sm">Stockholm</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Australia</p>
              <p className="text-green-200 text-sm">Melbourne, Sydney</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Worldwide</p>
              <p className="text-green-200 text-sm">All diaspora locations</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUR VALUES */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR VALUES</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">What we stand for</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Four values guide every decision EthioTax makes &mdash; from how we select our specialists to how we handle every client engagement.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Quality</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Every deliverable meets the highest professional standard before it reaches you. We do not release work that falls short of what was agreed. No exceptions.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Transparency</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Fixed fees agreed in writing before work starts. No hidden charges. No surprises. You always know exactly what you are paying and what you will receive.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Community</h3>
                <p className="text-gray-500 text-sm leading-relaxed">EthioTax exists to serve the Ethiopian community. Every decision we make is guided by what is best for our clients and the broader community we are proud to be part of.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Trust</h3>
                <p className="text-gray-500 text-sm leading-relaxed">You share sensitive financial information with us. We protect that trust through confidentiality, professionalism and consistent delivery &mdash; every single time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="py-12 bg-white border-t" style={{ borderColor: '#e8f0eb' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-gray-400 text-xs leading-relaxed max-w-3xl">
            All professional work, filings and regulatory submissions are prepared and carried out by qualified specialists. EthioTax manages your engagement and maintains service standards throughout.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t bg-white" style={{ borderColor: '#e8f0eb' }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Ready to work with EthioTax?</h2>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">Tell us what you need and we will respond within 24 hours &mdash; in English, Amharic or Afaan Oromoo.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm text-white" style={{ backgroundColor: '#1A4731' }}>
              Enquire about a service
            </a>
            <a href="/how-it-works" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2" style={{ borderColor: '#1A4731', color: '#1A4731' }}>
              How it works
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
