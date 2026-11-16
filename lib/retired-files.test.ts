import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The unused Careerjet route, the Fixie proxy code, old one-off scripts and
// unused packages were retired on 16 Nov 2026. They stay in git history only.
// The unused Sanity Studio, its config and schemas, an unused Portable Text component and their packages were retired on 16 Nov 2026.
// The unused Clerk sign-in integration (its account pages and package) was retired on 16 Nov 2026.

const ROOT = process.cwd()

const RETIRED_FILES = [
  'app/api/careerjet/route.ts',
  'deploy_route.py',
  'patch_nav_footer.py',
  'setup_pages.py',
  'write_cardgrid.js',
  'requirements.txt',
  'accountingbodycom.WordPress.2026-04-03.xml',
  'scripts/audit_per_article.py',
  'scripts/audit_sanity.py',
  'scripts/fix_article_links.py',
  'scripts/link_author.py',
  'scripts/link_mcq.py',
  'scripts/link_practice_categories.py',
  'scripts/migrate_quiz_posts.py',
  'scripts/migrate_wp_to_sanity.py',
  'scripts/migrate_wp_to_supabase.py',
  'scripts/wipe_practice_posts.py',
  'scripts/wipe_sanity.py',
  'scripts/migration_log.json',
  'scripts/quiz_migration_log.json',
  'app/studio/[[...tool]]/page.tsx',
  'app/studio/layout.tsx',
  'sanity.config.ts',
  'sanity.cli.ts',
  'sanity/client.ts',
  'sanity/schemas/_quizFields.ts',
  'sanity/schemas/article.ts',
  'sanity/schemas/author.ts',
  'sanity/schemas/category.ts',
  'sanity/schemas/course.ts',
  'sanity/schemas/firmProfile.ts',
  'sanity/schemas/jobListing.ts',
  'sanity/schemas/lesson.ts',
  'sanity/schemas/manualCard.ts',
  'sanity/schemas/page.ts',
  'sanity/schemas/practicePost.ts',
  'sanity/schemas/quizbankBlock.ts',
  'sanity/schemas/quizbankQuiz.ts',
  'sanity/schemas/tableBlock.ts',
  'components/course/ArticleBody.tsx',
  'app/dashboard/page.tsx',
  'app/sign-in/[[...sign-in]]/page.tsx',
  'app/sign-up/[[...sign-up]]/page.tsx',
]

const RETIRED_PACKAGES = [
  '@stripe/stripe-js',
  'stripe',
  'clsx',
  'otplib',
  'tailwind-merge',
  '@tailwindcss/typography',
  'undici',
  'sanity',
  'next-sanity',
  '@sanity/client',
  '@sanity/image-url',
  '@sanity/vision',
  '@portabletext/react',
  'styled-components',
  'react-is',
  '@clerk/nextjs',
]

describe('retired files and packages', () => {
  it('lists each file once', () => {
    expect(new Set(RETIRED_FILES).size).toBe(RETIRED_FILES.length)
    expect(RETIRED_FILES.length).toBe(43)
  })

  it('none of the retired files is back', () => {
    expect(RETIRED_FILES.filter((path) => existsSync(join(ROOT, path)))).toEqual([])
  })

  it('package.json lists none of the retired packages', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>
    const listed = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].flatMap((field) => Object.keys(pkg[field] ?? {}))
    expect(RETIRED_PACKAGES.filter((name) => listed.includes(name))).toEqual([])
  })
})
