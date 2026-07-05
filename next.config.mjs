import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    scrollRestoration: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
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
