import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

export const metadata = {
  title: 'Dashboard — AccountingBody',
}

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const firstName = user.firstName ?? 'there'

  const quickLinks = [
    {
      title: 'Study Notes',
      description: 'Pick up where you left off across ACCA, CIMA, and AAT.',
      href: '/study',
      accent: 'bg-teal-50 text-teal-600',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: 'Practice Questions',
      description: 'Continue your MCQ sessions and view your recent scores.',
      href: '/practice-questions',
      accent: 'bg-gold-50 text-gold-600',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      title: 'Saved Calculations',
      description: 'View employer cost calculations you have saved.',
      href: '/saved-calculations',
      accent: 'bg-navy-50 text-navy-700',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: 'Account Settings',
      description: 'Update your email, password, and notification preferences.',
      href: '/account',
      accent: 'bg-slate-100 text-slate-600',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="container-site py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-navy-950 font-bold tracking-tight">
            AccountingBody
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/study" className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-navy-950 transition-colors">Study</Link>
            <Link href="/practice-questions" className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-navy-950 transition-colors">Practice</Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="container-site py-10">

        <div className="mb-10">
          <span className="eyebrow block mb-2">Your dashboard</span>
          <h1 className="font-display text-4xl text-navy-950 leading-tight mb-2">
            Welcome back, {firstName}.
          </h1>
          <p className="text-slate-500 text-lg">
            Here&apos;s everything in one place — your study tools, saved work, and account.
          </p>
        </div>

        <div className="rounded-xl bg-navy-950 p-6 mb-10 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top right, #D4A017 0%, transparent 60%)' }}
          />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-1">Current plan</p>
              <p className="font-display text-2xl text-white">Free</p>
              <p className="text-white/50 text-sm mt-1">Upgrade to Pro for saved calculations, full reports, and AI assistant access.</p>
            </div>
            <Link href="/pricing" className="shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-gold-500 text-navy-950 text-sm font-semibold hover:bg-gold-400 transition-colors">
              Upgrade to Pro
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="font-display text-xl text-navy-950 mb-5">Quick access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickLinks.map(link => (
              <Link key={link.title} href={link.href}
                className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${link.accent}`}>
                  {link.icon}
                </div>
                <h3 className="font-semibold text-navy-950 mb-1.5 text-sm group-hover:text-navy-700 transition-colors">{link.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-display text-xl text-navy-950 mb-5">Account details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Email</p>
              <p className="text-sm font-medium text-navy-950">{user.emailAddresses[0]?.emailAddress ?? '—'}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Member since</p>
              <p className="text-sm font-medium text-navy-950">
                {new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
