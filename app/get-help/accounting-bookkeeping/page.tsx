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
  { title: 'Ethiopian Business Understanding', desc: 'Our professionals understand the specific accounting requirements of Ethiopian-owned businesses — both in the diaspora and within Ethiopia itself.' },
  { title: 'Multi-Standard Expertise', desc: 'We handle accounts under UK, US, Canadian and ETICPA standards — whichever your business requires, we have the qualified professional to deliver it.' },
  { title: 'Cloud Software Specialists', desc: 'Our team works with Xero, QuickBooks and Sage — setting up, cleaning up and maintaining your books on the platforms that work best for your business.' },
  { title: 'Fixed-Fee Transparency', desc: 'Monthly bookkeeping and annual accounts at a clear, fixed fee agreed upfront. No hourly billing surprises. You always know exactly what you pay.' },
]

const process = [
  { step: '01', title: 'Submit Your Brief', desc: 'Complete the enquiry form below. Tell us your business type, size and what you need.' },
  { step: '02', title: 'We Review & Qualify', desc: 'EthioTax reviews your brief within 24 hours and confirms the right approach.' },
  { step: '03', title: 'Fixed-Fee Proposal', desc: 'We send a clear, fixed-fee proposal within 72 hours. No surprises.' },
  { step: '04', title: 'EthioTax Manages Delivery', desc: 'We assign the right qualified professional and oversee every step.' },
  { step: '05', title: 'Delivered & Followed Up', desc: 'You receive completed, quality-checked work. We track your next deadline.' },
]

const otherServices = [
  { name: 'Tax Filing & Compliance', href: '/get-help/tax-filing-compliance' },
  { name: 'Business Consulting', href: '/get-help/business-consulting' },
  { name: 'Payroll Services', href: '/get-help/payroll-services' },
  { name: 'Company Formation', href: '/get-help/company-formation' },
  { name: 'Audit & Assurance', href: '/get-help/audit-assurance' },
  { name: 'Financial Planning', href: '/get-help/financial-planning' },
]

export default function AccountingBookkeepingPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', country: '', language: '', message: '', _h: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form._h) return
    setStatus('loading')
    try {
      await fetch('/api/help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, service: 'Accounting & Bookkeeping' }),
      })
      setStatus('success')
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
            <span className="text-white/70">Accounting & Bookkeeping</span>
          </nav>
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
              Accounting & Bookkeeping
            </h1>
            <p className="text-green-100 text-xl leading-relaxed mb-4 max-w-2xl">
              Accurate books, annual accounts and management reports — handled end to end by qualified accounting professionals who understand Ethiopian businesses worldwide.
            </p>
            <p className="text-green-200 text-sm leading-relaxed mb-10 max-w-2xl">
              UK · USA · Canada · UAE · Ethiopia · Australia and beyond. Whatever your business structure, wherever you operate, EthioTax keeps your finances in order.
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
                Complete accounting services — every business type, every location
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Good bookkeeping and accurate accounts are the foundation of every healthy business. Without them you cannot make informed decisions, file your returns correctly, or understand how your business is truly performing. EthioTax coordinates qualified accounting professionals who maintain your books and prepare your accounts to the standard required — wherever your business operates.
              </p>
              <ul className="space-y-3">
                {[
                  'Monthly and quarterly bookkeeping — all transactions recorded and reconciled',
                  'Annual accounts preparation — sole traders, partnerships and limited companies',
                  'Management accounts for decision-making and investor reporting',
                  'Accounts payable and receivable management',
                  'Bank reconciliation — monthly or weekly',
                  'Cloud accounting software setup — Xero, QuickBooks and Sage',
                  'Accounts clean-up and catch-up for businesses switching accountants',
                  'ETICPA-standard statutory accounts for Ethiopian entities',
                  'Group consolidated accounts for businesses with international operations',
                  'Management information and KPI reporting',
                  'Year-end accounts and filing preparation',
                  'Bookkeeping training for business owners who want to self-manage',
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
                    'Ethiopian diaspora business owners — restaurants, retail, transport, healthcare and more',
                    'Sole traders and self-employed professionals needing accurate records',
                    'Limited companies requiring monthly bookkeeping and annual accounts',
                    'Ethiopian businesses expanding internationally needing multi-standard accounts',
                    'Startups that need accounting set up correctly from day one',
                    'Businesses switching accountants and needing books brought up to date',
                    'Anyone who has fallen behind on their bookkeeping and needs to catch up fast',
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
              Why the Ethiopian community chooses EthioTax for accounting
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
                Enquire about Accounting & Bookkeeping
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
                    <option value="Amharic">Amharic — ኣማርኛ</option>
                    <option value="Afaan Oromoo">Afaan Oromoo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Tell us about your situation *</label>
                  <textarea required rows={5} value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A4731] focus:border-transparent transition-all resize-none"
                    placeholder="Please describe your business, what accounting or bookkeeping you need, your current situation and any deadlines..." />
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
