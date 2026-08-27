import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  images: {
    remotePatterns: [],
  },
  async redirects() {
    return [
      // /free-courses/ is the canonical URL — everything else redirects here
      {
        source: '/courses',
        destination: '/free-courses',
        permanent: true,
      },
      {
        source: '/courses/:path*',
        destination: '/free-courses/:path*',
        permanent: true,
      },
      {
        source: '/course',
        destination: '/free-courses',
        permanent: true,
      },
      {
        source: '/course/:path*',
        destination: '/free-courses/:path*',
        permanent: true,
      },
      // Lesson redirect must come before the general /study/courses/:path* redirect
      // below, so this more specific path matches first — the old lesson URL segment
      // is "lessons", the new one is "learn".
      {
        source: '/study/courses/:slug/lessons/:lessonSlug',
        destination: '/free-courses/:slug/learn/:lessonSlug',
        permanent: true,
      },
      {
        source: '/study/courses/:slug',
        destination: '/free-courses/:slug',
        permanent: true,
      },
      {
        source: '/study/courses',
        destination: '/free-courses',
        permanent: true,
      },
      {
        source: '/study/courses/:path*',
        destination: '/free-courses/:path*',
        permanent: true,
      },

      // Legacy WordPress URLs — safe redirects (no existing routes affected)
      { source: '/module/:slug', destination: '/articles/:slug', permanent: true },
      { source: '/firms', destination: '/firms-freelancers', permanent: true },
      { source: '/all-resources', destination: '/study', permanent: true },
      { source: '/study-hub', destination: '/study', permanent: true },
      { source: '/practitioner-apply', destination: '/firms-freelancers/join', permanent: true },

      // /hire-talent is the legacy, orphaned route — /jobs/hire-talent is current
      { source: '/hire-talent', destination: '/jobs/hire-talent', permanent: true },
      { source: '/hire-talent/:path*', destination: '/jobs/hire-talent/:path*', permanent: true },
    ]
  },
}
export default withSentryConfig(nextConfig, {
  org: 'accounting-body',
  project: 'javascript-accountingbody-website',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
})
