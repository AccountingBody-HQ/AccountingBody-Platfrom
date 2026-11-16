import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The unused Careerjet route, the Fixie proxy code, old one-off scripts and
// unused packages were retired on 16 Nov 2026. They stay in git history only.

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
]

const RETIRED_PACKAGES = [
  '@stripe/stripe-js',
  'stripe',
  'clsx',
  'otplib',
  'tailwind-merge',
  '@tailwindcss/typography',
  'undici',
]

describe('retired files and packages', () => {
  it('lists each file once', () => {
    expect(new Set(RETIRED_FILES).size).toBe(RETIRED_FILES.length)
    expect(RETIRED_FILES.length).toBe(20)
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
