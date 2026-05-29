// app/layout.tsx
// AccountingBody.com — Root Layout
// Includes: GTM, AdSense meta, Open Graph, Navigation, Footer, NewsTicker, CookieConsent
// Added: Vercel Analytics, Vercel Speed Insights, Clerk Auth

import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Navigation } from '@/components/layout/Navigation'
import { headers } from 'next/headers'
import { Footer } from '@/components/layout/Footer'
import CookieConsent from '@/components/CookieConsent'
import ScrollToTop from '@/components/ScrollToTop'
import './globals.css'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Accounting Body — Everything You Need for Accounting & Finance',
    template: '%s | Accounting Body',
  },
  description:
    'The definitive platform for ACCA, CIMA, ICAEW and AAT. Study notes, practice questions, and professional connections for accounting qualification students.',
  keywords: [
    'accounting education', 'ACCA study', 'CIMA study', 'AAT study notes',
    'ICAEW ACA', 'accounting practice questions', 'finance qualifications',
    'bookkeeping courses', 'accounting glossary', 'hire accountant',
  ],
  authors: [{ name: 'AccountingBody', url: SITE_URL }],
  creator: 'AccountingBody',
  publisher: 'AccountingBody Ltd',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: SITE_URL,
    siteName: 'Accounting Body',
    title: 'Accounting Body — Everything You Need for Accounting & Finance',
    description:
      'Study notes, practice questions, and professional connections for ACCA, CIMA, ICAEW and AAT students.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Accounting Body' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@accountingbody',
    creator: '@accountingbody',
    title: 'Accounting Body — Everything You Need for Accounting & Finance',
    description: 'Study notes, practice questions, and professional connections for ACCA, CIMA, ICAEW and AAT.',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  verification: { google: process.env.NEXT_PUBLIC_ADSENSE_VERIFICATION },
  alternates: { canonical: SITE_URL },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const studyQualificationLinks = isEthioTax
    ? [
        { label: 'ETICPA / CPA', href: '/study/eticpa', description: "Ethiopia's national CPA qualification" },
        { label: 'ACCA',         href: '/study/acca',   badge: 'Popular', description: 'All 13 ACCA papers covered' },
        { label: 'CIMA',         href: '/study/cima',   description: 'Certificate to Strategic level' },
        { label: 'AAT',          href: '/study/aat',    description: 'Level 2, 3 and 4 coverage' },
      ]
    : undefined
  return (
    <ClerkProvider>
      <html lang="en-GB" className="scroll-smooth">
        <head>
          {process.env.NEXT_PUBLIC_ADSENSE_ID && (
            <meta name="google-adsense-account" content={process.env.NEXT_PUBLIC_ADSENSE_ID} />
          )}
          <link rel="dns-prefetch" href="//fonts.googleapis.com" />
          <link rel="dns-prefetch" href="//fonts.gstatic.com" />
          <link rel="dns-prefetch" href="//www.googletagmanager.com" />
          {/* GTM loaded by CookieConsent only after user consent — GDPR compliant */}
        </head>
        <body className="antialiased bg-surface text-slate-900 min-h-screen flex flex-col">
          {GTM_ID && (
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                height="0" width="0"
                style={{ display: 'none', visibility: 'hidden' }}
              />
            </noscript>
          )}
          <Navigation studyQualificationLinks={studyQualificationLinks} />
          <main
            className="flex-1"
            style={{ paddingTop: 'var(--nav-height, 64px)' }}
          >
            {children}
          </main>
          <Footer />
          <CookieConsent gtmId={GTM_ID ?? ''} />
          <ScrollToTop />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
