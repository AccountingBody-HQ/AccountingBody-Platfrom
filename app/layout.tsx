// app/layout.tsx
// AccountingBody.com — Root Layout
// Includes: GTM, AdSense meta, Open Graph, Navigation, Footer, NewsTicker

import type { Metadata } from 'next'
import Script from 'next/script'
import { Navigation } from '@/components/layout/Navigation'
import { Footer } from '@/components/layout/Footer'
import { NewsTicker } from '@/components/layout/NewsTicker'
import './globals.css'

// ── Environment ────────────────────────────────────────────────────────────────
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

// ── Default Metadata ──────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'AccountingBody — Everything You Need for Accounting & Finance',
    template: '%s | AccountingBody',
  },

  description:
    'The definitive accounting and finance education platform. Study notes, practice questions, and professional connections for ACCA, CIMA, AAT, ICAEW, and more.',

  keywords: [
    'accounting education',
    'ACCA study',
    'CIMA study',
    'AAT study notes',
    'ICAEW ACA',
    'accounting practice questions',
    'finance qualifications',
    'bookkeeping courses',
    'accounting glossary',
    'hire accountant',
  ],

  authors: [{ name: 'AccountingBody', url: SITE_URL }],
  creator: 'AccountingBody',
  publisher: 'AccountingBody Ltd',

  // ── Open Graph ──────────────────────────────────────────────────────────────
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: SITE_URL,
    siteName: 'AccountingBody',
    title: 'AccountingBody — Everything You Need for Accounting & Finance',
    description:
      'Study notes, practice questions, and professional connections for every accounting qualification. ACCA, CIMA, AAT, ICAEW and more.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'AccountingBody — Accounting & Finance Education Platform',
      },
    ],
  },

  // ── Twitter / X ─────────────────────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    site: '@accountingbody',
    creator: '@accountingbody',
    title: 'AccountingBody — Everything You Need for Accounting & Finance',
    description:
      'Study notes, practice questions, and professional connections for every accounting qualification.',
    images: ['/og-default.png'],
  },

  // ── Robots ──────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // ── Icons ───────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },

  // ── Manifest ────────────────────────────────────────────────────────────────
  manifest: '/site.webmanifest',

  // ── Verification ────────────────────────────────────────────────────────────
  verification: {
    // Google AdSense site verification — add your code in .env.local as
    // NEXT_PUBLIC_ADSENSE_VERIFICATION=ca-pub-XXXXXXXXXX
    google: process.env.NEXT_PUBLIC_ADSENSE_VERIFICATION,
  },

  // ── Alternate languages ──────────────────────────────────────────────────────
  alternates: {
    canonical: SITE_URL,
  },
}

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" className="scroll-smooth">

      <head>
        {/* ── Google AdSense verification ──────────────────────────────── */}
        {process.env.NEXT_PUBLIC_ADSENSE_ID && (
          <meta
            name="google-adsense-account"
            content={process.env.NEXT_PUBLIC_ADSENSE_ID}
          />
        )}

        {/* ── DNS prefetch for performance ─────────────────────────────── */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />

        {/* ── GTM <head> snippet ───────────────────────────────────────── */}
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

        {/* ── GTM <body> noscript ──────────────────────────────────────── */}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}

        {/* ── News ticker — fixed top bar ──────────────────────────────── */}
        <NewsTicker />

        {/* ── Main navigation — fixed below ticker ─────────────────────── */}
        <Navigation />

        {/* ── Page content ─────────────────────────────────────────────── */}
        {/* pt offsets the fixed ticker + nav height */}
        <main
          className="flex-1"
          style={{ paddingTop: 'calc(var(--ticker-height, 40px) + var(--nav-height, 64px))' }}
        >
          {children}
        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <Footer />

      </body>
    </html>
  )
}
