// app/layout.tsx
// AccountingBody.com — Root Layout
// Includes: GTM, AdSense meta, Open Graph, Navigation, Footer, NewsTicker, CookieConsent
// Added: Vercel Analytics, Vercel Speed Insights, Clerk Auth

import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { NavigationWrapper } from '@/components/layout/NavigationWrapper'
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
    'Professional accounting services, expert network and study platform for ACCA, CIMA, ICAEW and AAT — serving clients and students worldwide.',
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
      'Professional accounting services, expert network and study platform for ACCA, CIMA, ICAEW and AAT — serving clients and students worldwide.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Accounting Body' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@accountingbody',
    creator: '@accountingbody',
    title: 'Accounting Body — Everything You Need for Accounting & Finance',
    description: 'Professional accounting services, expert network and study platform for ACCA, CIMA, ICAEW and AAT — serving clients and students worldwide.',
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

  return (
    <ClerkProvider>
      <html lang="en-GB" className="scroll-smooth">
        <head>
          {process.env.NEXT_PUBLIC_ADSENSE_ID && (
            <meta name="google-adsense-account" content={process.env.NEXT_PUBLIC_ADSENSE_ID} />
          )}
          <link rel="dns-prefetch" href="//fonts.googleapis.com" />
          <link rel="dns-prefetch" href="//fonts.gstatic.com" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
          <NavigationWrapper />
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
