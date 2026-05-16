/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ]
  },
}
export default nextConfig
