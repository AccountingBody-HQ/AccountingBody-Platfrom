// app/layout.tsx
// AccountingBody.com — Root Layout
// Includes: GTM, AdSense meta, Open Graph, Navigation, Footer, NewsTicker, CookieConsent
// Added: Vercel Analytics, Vercel Speed Insights, Clerk Auth

import type { Metadata } from 'next'
import Script from 'next/script'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Navigation } from '@/components/layout/Navigation'
import { Footer } from '@/components/layout/Footer'
import { NewsTicker } from '@/components/layout/NewsTicker'
import CookieConsent from '@/components/CookieConsent'
import './globals.css'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AccountingBody — Everything You Need for Accounting & Finance',
    template: '%s | AccountingBody',
  },
  description:
    'The definitive accounting and finance education platform. Study notes, practice questions, and professional connections for ACCA, CIMA, AAT, ICAEW, and more.',
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
    siteName: 'AccountingBody',
    title: 'AccountingBody — Everything You Need for Accounting & Finance',
    description:
      'Study notes, practice questions, and professional connections for every accounting qualification. ACCA, CIMA, AAT, ICAEW and more.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'AccountingBody' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@accountingbody',
    creator: '@accountingbody',
    title: 'AccountingBody — Everything You Need for Accounting & Finance',
    description: 'Study notes, practice questions, and professional connections for every accounting qualification.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
          {GTM_ID && (
            <Script
              id="gtm-script"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                  })(window,document,'script','dataLayer','${GTM_ID}');
                `,
              }}
            />
          )}
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
          <NewsTicker />
          <Navigation />
          <main
            className="flex-1"
            style={{ paddingTop: 'calc(var(--ticker-height, 40px) + var(--nav-height, 64px))' }}
          >
            {children}
          </main>
          <Footer />
          <CookieConsent gtmId={GTM_ID ?? ''} />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  )
}
