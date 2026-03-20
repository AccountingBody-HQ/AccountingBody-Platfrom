// app/layout.tsx
// AccountingBody — Root Layout
// Metadata · GTM (loaded after consent only — UK GDPR) · AdSense · Canonical

import type { Metadata } from 'next'
import CookieConsent from '@/components/CookieConsent'
import './globals.css'

// ─────────────────────────────────────────────────────────────────────────────
const SITE_URL  = 'https://accountingbody.com'
const SITE_NAME = 'AccountingBody'
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  // Tells Next.js the base URL so relative paths in metadata resolve correctly
  metadataBase: new URL(SITE_URL),

  // ── Title ──────────────────────────────────────────────────────────────────
  // template: every page that exports its own `title` will get " | AccountingBody" appended
  title: {
    default:  `${SITE_NAME} — Study Notes, Practice Questions & Professional Resources`,
    template: `%s | ${SITE_NAME}`,
  },

  // ── Description ────────────────────────────────────────────────────────────
  description:
    "The UK's leading accounting education platform. Study notes, practice questions, and " +
    'professional resources for ACCA, CIMA, AAT, ICAEW, and more. Trusted by 250,000+ students.',

  // ── Keywords ───────────────────────────────────────────────────────────────
  keywords: [
    'ACCA study notes', 'CIMA study notes', 'AAT study notes', 'ICAEW resources',
    'accounting practice questions', 'accounting qualifications', 'accounting education',
    'ACCA F3', 'CIMA OCS', 'AAT Level 3', 'deferred tax', 'financial accounting',
    'management accounting', 'UK accounting', 'accounting glossary',
  ],

  // ── Authorship ─────────────────────────────────────────────────────────────
  authors:   [{ name: 'AccountingBody', url: SITE_URL }],
  creator:   SITE_NAME,
  publisher: SITE_NAME,

  // ── Prevents mobile browsers auto-linking phone numbers, emails, etc ────────
  formatDetection: { email: false, address: false, telephone: false },

  // ── Open Graph (Facebook, LinkedIn, WhatsApp previews) ─────────────────────
  openGraph: {
    type:        'website',
    locale:      'en_GB',
    url:         SITE_URL,
    siteName:    SITE_NAME,
    title:       `${SITE_NAME} — Study Notes, Practice Questions & Professional Resources`,
    description: "The UK's leading accounting education platform. Trusted by 250,000+ students worldwide.",
    images: [
      {
        url:    '/og-image.png',   // ← Create this image: 1200×630px, navy background with your logo
        width:  1200,
        height: 630,
        alt:    'AccountingBody — Accounting Education Platform',
      },
    ],
  },

  // ── Twitter / X card ───────────────────────────────────────────────────────
  twitter: {
    card:        'summary_large_image',
    title:       `${SITE_NAME} — Accounting Study & Professional Resources`,
    description: 'Study notes, practice questions, and professional resources for ACCA, CIMA, AAT, ICAEW, and more.',
    images:      ['/og-image.png'],
  },

  // ── Robots (global default — pages can override) ───────────────────────────
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:                  true,
      follow:                 true,
      'max-video-preview':    -1,
      'max-image-preview':    'large',
      'max-snippet':          -1,
    },
  },

  // ── Verification ───────────────────────────────────────────────────────────
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in Vercel env vars after Step 8
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },

  // ── Default canonical (each page overrides this with its own URL) ──────────
  alternates: {
    canonical: '/',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO SET CANONICAL ON INDIVIDUAL PAGES
// In any page.tsx, export this at the top:
//
//   export const metadata: Metadata = {
//     title:      'ACCA F3 Study Guide',
//     description: '...',
//     alternates: { canonical: 'https://accountingbody.com/articles/acca-f3-study-guide' },
//   }
//
// For articles served on accountingbody.com, the canonical IS accountingbody.com.
// For GlobalPayrollExpert articles DISPLAYED on GPE, the canonical points BACK here.
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gtmId     = process.env.NEXT_PUBLIC_GTM_ID     ?? ''
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID ?? ''

  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* ── Google AdSense verification ──────────────────────────────────
            This meta tag proves to Google that you own this site.
            It does NOT serve ads — it is verification only.
            Set NEXT_PUBLIC_ADSENSE_ID in Vercel env vars (e.g. ca-pub-XXXXXXXXXXXXXXXX) */}
        {adsenseId && (
          <meta name="google-adsense-account" content={adsenseId} />
        )}

        {/* ── GTM is intentionally NOT loaded here ─────────────────────────
            Under UK GDPR, analytics tracking requires explicit user consent.
            The <CookieConsent> component below loads GTM dynamically only
            AFTER the user clicks "Accept cookies". This is legally compliant. */}
      </head>

      <body className="bg-white text-navy-950 antialiased">

        {/* ── Navigation ─────────────────────────────────────────────────────
            Uncomment this line when your Navigation component is ready:
            <Navigation />
        */}

        {/* ── Page content ───────────────────────────────────────────────── */}
        <main>{children}</main>

        {/* ── Footer ─────────────────────────────────────────────────────────
            Uncomment this line when your Footer component is ready:
            <Footer />
        */}

        {/* ── Cookie consent banner — also the GTM loader ────────────────── */}
        <CookieConsent gtmId={gtmId} />

      </body>
    </html>
  )
}