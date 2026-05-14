import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

export const metadata = {
  title: 'Create Free Account — Accounting Body',
  description: 'Join 250,000+ ACCA, CIMA, ICAEW and AAT students. Free access to study notes and practice questions.',
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="container-site flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-navy-950 font-bold tracking-tight">
            Accounting Body
          </Link>
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-navy-700 font-semibold hover:text-gold-500 transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="eyebrow block mb-3">Free forever</span>
            <h1 className="font-display text-4xl text-navy-950 leading-tight mb-3">
              Join Accounting Body
            </h1>
            <p className="text-slate-500 text-base">
              Study notes, practice questions, and free tools —
              no credit card required.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {['3,000+ articles', '50,000+ questions', 'Free forever', 'No spam'].map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                {item}
              </span>
            ))}
          </div>

          <div className="flex justify-center">
            <SignUp
              appearance={{
                variables: {
                  colorPrimary: '#0a0f2e',
                  colorBackground: '#ffffff',
                  colorText: '#0f172a',
                  colorTextSecondary: '#64748b',
                  colorInputBackground: '#ffffff',
                  colorInputText: '#0f172a',
                  borderRadius: '0.5rem',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 py-6 text-center">
        <p className="text-xs text-slate-400">
          By signing up you agree to our{' '}
          <Link href="/terms" className="hover:text-navy-700 transition-colors">Terms of Service</Link>
          {' and '}
          <Link href="/privacy" className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
        </p>
      </div>

    </div>
  )
}
