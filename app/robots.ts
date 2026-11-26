// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/studio/',
          '/_next/',
          '/dashboard/',
          '/account/',
          '/private/',
        ],
      },
      { userAgent: 'GPTBot',        disallow: ['/'] },
      { userAgent: 'CCBot',         disallow: ['/'] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'}/sitemap.xml`,
    host:    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com',
  }
}