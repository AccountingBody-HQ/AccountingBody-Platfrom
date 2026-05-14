import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export const metadata = {
  title: 'Sign In — Accounting Body',
  description: 'Sign in to your Accounting Body account.',
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="container-site flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-navy-950 font-bold tracking-tight">
            Accounting Body
          </Link>
          <p className="text-sm text-slate-500">
            No account?{' '}
            <Link href="/sign-up" className="text-navy-700 font-semibold hover:text-gold-500 transition-colors">
              Sign up free →
            </Link>
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="eyebrow block mb-3">Welcome back</span>
            <h1 className="font-display text-4xl text-navy-950 leading-tight mb-3">
              Sign in to Accounting Body
            </h1>
            <p className="text-slate-500 text-base">
              Access your study notes, practice questions, and saved calculations.
            </p>
          </div>
          <div className="flex justify-center">
            <SignIn
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
          Trusted by 250,000+ accounting students worldwide ·{' '}
          <Link href="/privacy" className="hover:text-navy-700 transition-colors">Privacy Policy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-navy-700 transition-colors">Terms</Link>
        </p>
      </div>

    </div>
  )
}
