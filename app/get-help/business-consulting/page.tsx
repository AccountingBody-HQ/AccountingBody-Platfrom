'use client'
import { useState } from 'react'

const countries = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
  'Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
]

const whyEthioTax = [
  { title: 'Diaspora Investment Expertise', desc: 'We understand the regulatory, legal and financial landscape for Ethiopians investing from abroad — structuring investments correctly to protect your capital and maximise returns.' },
  { title: 'Ethiopia Market Knowledge', desc: 'Our professionals have direct knowledge of the Ethiopian business environment — EIC registration, trade licences, sector regulations and the practical realities of operating in Ethiopia.' },
  { title: 'International Business Standards', desc: 'We produce business plans, financial models and strategic documents that meet the standard required by international lenders, investors and grant bodies worldwide.' },
  { title: 'End-to-End Management', desc: 'From initial strategy through to implementation support — EthioTax manages every element and oversees the specialists involved, so you have one point of contact throughout.' },
]

const process = [
  { step: '01', title: 'Submit Your Brief', desc: 'Complete the enquiry form below. Tell us your business situation and what you are trying to achieve.' },
  { step: '02', title: 'We Review & Qualify', desc: 'EthioTax reviews your brief within 24 hours and confirms the right approach.' },
  { step: '03', title: 'Fixed-Fee Proposal', desc: 'We send a clear, fixed-fee proposal within 72 hours. No surprises.' },
  { step: '04', title: 'EthioTax Manages Delivery', desc: 'We assign the right qualified professional and oversee every step.' },
  { step: '05', title: 'Delivered & Followed Up', desc: 'You receive completed, quality-checked work. We remain available for follow-up questions.' },
]

const otherServices = [
  { name: 'Tax Filing & Compliance', href: '/get-help/tax-filing-compliance' },
  { name: 'Accounting & Bookkeeping', href: '/get-help/accounting-bookkeeping' },
  { name: 'Payroll Services', href: '/get-help/payroll-services' },
  { name: 'Company Formation', href: '/get-help/company-formation' },
  { name: 'Audit & Assurance', href: '/get-help/audit-assurance' },
  { name: 'Financial Planning', href: '/get-help/financial-planning-advisory' },
]

export default function BusinessConsultingPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', language: '', message: '', _h: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form._h) return
    setStatus('loading')
    try {
      const res = await fetch('/api/help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, service_type: 'Business Consulting' }),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F8F4]">

      {/* HERO */}
      <section className="bg-[#1A4731] py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #2d6a4f 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <nav className="flex items-center gap-2 text-sm mb-6">
            <a href="/" style={{ color: '#C9982A' }}>Home</a>
            <span className="text-green-200 mx-1">›</span>
            <a href="/get-help" className="text-green-200">Services</a>
            <span className="text-green-200 mx-1">›</span>
            <span className="text-white/70">Business Consulting</span>
          </nav>
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
              Business Consulting & Strategy
            </h1>
            <p className="text-green-100 text-xl leading-relaxed mb-4 max-w-2xl">
              Business plans, financial modelling, diaspora investment structuring and strategic advisory — delivered by qualified professionals who understand Ethiopian business globally.
            </p>
            <p className="text-green-200 text-sm leading-relaxed mb-10 max-w-2xl">
              Whether you are starting a business, growing an existing one, investing in Ethiopia from abroad, or seeking funding — EthioTax manages the expertise you need.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#enquire"
                className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] font-semibold text-sm rounded-xl" style={{ backgroundColor: '#C9982A', color: '#fff' }}>
                Enquire about this service
              </a>
              <a href="/get-help"
                className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] border-2 border-white text-white font-semibold text-sm rounded-xl">
                View all services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="bg-white border-b border-[#e8f0eb] py-6">
        <div className="container-site">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '24hr', label: 'Response Guarantee' },
              { value: '72hr', label: 'Fixed-Fee Proposal' },
              { value: '100%', label: 'Quality Checked' },
              { value: 'Global', label: 'Diaspora Coverage' },
            ].map(s => (
              <div key={s.value} className="text-center py-4">
                <p className="font-display text-2xl font-extrabold text-[#1A4731] mb-1">{s.value}</p>
                <p className="text-[#1A4731] text-xs font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE DELIVER */}
      <section className="py-20 bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-[#1A4731] text-[11px] font-bold uppercase tracking-[0.12em] mb-3">What We Deliver</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-6">
                Strategic business support — from startup to scale
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Whether you are launching a new business, seeking investment, expanding into Ethiopia or growing an established company, EthioTax manages qualified business consultants and advisors who understand the Ethiopian business environment — both locally and across the global diaspora.
              </p>
              <ul className="space-y-3">
                {[
                  'Business plan development — investor-ready, bank-ready and grant-ready',
                  'Financial modelling, forecasting and scenario analysis',
                  'Market entry strategy for Ethiopian businesses expanding internationally',
                  'Diaspora investment in Ethiopia — structuring, legal navigation and regulatory compliance',
                  'Company valuation for sale, acquisition or investment purposes',
                  'Exit planning and business succession strategy',
                  'Business performance review and operational improvement',
                  'Grant and funding application support',
                  'Pitch deck preparation for investor presentations',
                  'Cash flow planning and financial health assessment',
                  'Strategic partnerships and joint venture structuring',
                  'Due diligence support for acquisitions and investments',
                ].map(b => (
                  <li key={b} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#f0f7f4] flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="#1A4731" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                    </span>
                    <span className="text-gray-600 text-[15px] leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-5">
              <div className="bg-[#f0f7f4] rounded-2xl p-8 border border-[#d1e8db]">
                <h3 className="font-display text-xl font-bold text-[#1A4731] mb-4">Who is this for?</h3>
                <ul className="space-y-3">
                  {[
                    'Ethiopian diaspora entrepreneurs starting or growing a business abroad',
                    'Diaspora Ethiopians investing capital back into Ethiopia',
                    'Ethiopian businesses seeking international expansion',
                    'Startups preparing for investor or bank funding rounds',
                    'Business owners planning a sale, merger or exit',
                    'Companies needing a credible business plan for grants or licences',
                    'Anyone who needs expert financial and strategic guidance to make better business decisions',
                  ].map(w => (
                    <li key={w} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9982A] shrink-0 mt-2" />
                      <span className="text-gray-600 text-sm leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#1A4731] rounded-2xl p-8">
                <h3 className="font-display text-xl font-bold text-white mb-2">Not sure what you need?</h3>
                <p className="text-white/65 text-sm leading-relaxed mb-5">Tell us your situation and we will advise on exactly what is required — no obligation, no cost.</p>
                <a href="#enquire"
                  className="inline-flex items-center justify-center h-[44px] w-full font-semibold text-sm rounded-xl" style={{ backgroundColor: '#C9982A', color: '#fff' }}>
                  Submit a free enquiry
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY ETHIOTAX */}
      <section className="py-20 bg-[#F7F8F4]">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <p className="text-[#1A4731] text-[11px] font-bold uppercase tracking-[0.12em] mb-3">Why EthioTax</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              Why the Ethiopian community chooses EthioTax for business consulting
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {whyEthioTax.map(w => (
              <div key={w.title} className="bg-white rounded-2xl p-8 border-l-4 border-[#1A4731]">
                <h3 className="font-display text-lg font-bold text-[#1A4731] mb-3">{w.title}</h3>
                <p className="text-gray-500 text-[15px] leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="py-20 bg-[#1A4731]">
        <div className="container-site">
          <div className="text-center mb-14">
            <p className="text-[#C9982A] text-[11px] font-bold uppercase tracking-[0.12em] mb-4">How It Works</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
              Five steps from enquiry to completion
            </h2>
            <p className="text-white/55 text-lg max-w-md mx-auto">EthioTax manages every stage. You deal with us — we handle the rest.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 max-w-5xl mx-auto">
            {process.map(item => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="w-[52px] h-[52px] rounded-full bg-[#C9982A] flex items-center justify-center text-[#1A4731] font-extrabold text-base mb-4 shrink-0">
                  {item.step}
                </div>
                <h3 className="font-display text-white text-[15px] font-bold mb-2">{item.title}</h3>
                <p className="text-white/50 text-[12px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ENQUIRY FORM */}
      <section id="enquire" className="py-20 bg-white">
        <div className="container-site">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-[#1A4731] text-[11px] font-bold uppercase tracking-[0.12em] mb-3">Get Started</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
                Enquire about Business Consulting
              </h2>
              <p className="text-gray-500 text-lg">
                Submit your enquiry and EthioTax will respond within 24 hours with confirmation and next steps.
              </p>
            </div>

            {status === 'success' ? (
              <div className="bg-[#f0f7f4] border border-[#d1e8db] rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-[#1A4731] flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <h3 className="font-display text-2xl font-bold text-[#1A4731] mb-3">Enquiry Received</h3>
                <p className="text-gray-600 text-base leading-relaxed mb-6">
                  Thank you. EthioTax will review your enquiry and respond within 24 hours. For urgent matters, the WhatsApp button is available at the bottom right of this page.
                </p>
                <button onClick={() => setStatus('idle')}
                  className="text-sm font-semibold text-[#1A4731] hover:text-[#C9982A] transition-colors">
                  Submit another enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e8f0eb] shadow-sm p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1.5">Full Name *</label>
                    <input required type="text" value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all"
                      placeholder="Your full name" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1.5">Email Address *</label>
                    <input required type="email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all"
                      placeholder="you@example.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1.5">Phone Number</label>
                    <input type="tel" value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all"
                      placeholder="Optional — include country code" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1.5">Country *</label>
                    <select required value={form.country}
                      onChange={e => setForm({ ...form, country: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all bg-white">
                      <option value="">Select your country</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Preferred Language</label>
                  <select value={form.language}
                    onChange={e => setForm({ ...form, language: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all bg-white">
                    <option value="">No preference</option>
                    <option value="English">English</option>
                    <option value="Amharic">Amharic — &#4768;&#4635;&#4653;&#4763;</option>
                    <option value="Afaan Oromoo">Afaan Oromoo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Tell us about your situation *</label>
                  <textarea required rows={5} value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all resize-none"
                    placeholder="Please describe your business, what consulting support you need, your goals and any relevant timelines..." />
                </div>
                {status === 'error' && (
                  <p className="text-red-600 text-sm">Something went wrong. Please try again or use WhatsApp to reach us directly.</p>
                )}
                <button type="submit" disabled={status === 'loading'}
                  className="w-full h-[52px] rounded-xl bg-[#1A4731] text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {status === 'loading' ? 'Submitting...' : 'Submit Enquiry →'}
                </button>
                <input type="text" value={form._h} onChange={e => setForm({ ...form, _h: e.target.value })} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                <p className="text-xs text-gray-400 text-center">
                  EthioTax will review your enquiry and respond within 24 hours. No work commences without your approval of scope and fee.
                </p>
              </form>
            )}
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
      {/* OTHER SERVICES */}
      <section className="py-16 bg-[#F7F8F4] border-t border-[#e8f0eb]">
        <div className="container-site">
          <div className="text-center mb-10">
            <p className="text-[#1A4731] text-[11px] font-bold uppercase tracking-[0.12em] mb-3">Explore Further</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Other services EthioTax delivers</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {otherServices.map(s => (
              <a key={s.name} href={s.href}
                className="group bg-white rounded-xl border border-[#e8f0eb] p-5 hover:border-[#1A4731] hover:shadow-md transition-all duration-200 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f0f7f4] flex items-center justify-center group-hover:bg-[#1A4731] transition-colors">
                  <svg className="w-4 h-4 text-[#1A4731] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
                <span className="font-semibold text-xs text-gray-700 group-hover:text-[#1A4731] leading-tight">{s.name}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

    </main>
  )
}
