import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Accessibility structure guards (A11-F1, FINDINGS FM). Public pages only:
// the admin area is found by its layout (the one that calls requireAdmin)
// and skipped without naming it.
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(relative(root, full))
  }
  return out
}

const appDir = join(root, 'app')
const adminDirs = readdirSync(appDir).filter((name) => {
  const layout = join(appDir, name, 'layout.tsx')
  try {
    return statSync(layout).isFile() && readFileSync(layout, 'utf8').includes('requireAdmin')
  } catch {
    return false
  }
})
const isAdmin = (file: string) =>
  adminDirs.some((d) => file.startsWith(`app/${d}/`) || file.startsWith(`app/${d}-`) || file.startsWith(`components/${d}/`))

describe('accessibility structure (A11-F1)', () => {
  it('finds exactly one admin area to skip', () => {
    expect(adminDirs).toHaveLength(1)
  })

  it('the root layout has a skip link to the one main landmark', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain('href="#main-content"')
    expect(layout).toContain('Skip to main content')
    expect(layout).toContain('id="main-content"')
    expect(layout.match(/<main\b/g)).toHaveLength(1)
    expect(layout.indexOf('href="#main-content"')).toBeLessThan(layout.indexOf('<NavigationWrapper'))
  })

  it('no public page or component opens a second main landmark', () => {
    const files = [...walk(join(root, 'app')), ...walk(join(root, 'components'))]
      .filter((f) => f !== 'app/layout.tsx' && !isAdmin(f))
    const offenders = files.filter((f) => /<main\b/.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('every desktop menu arrow button has a name and opens by click', () => {
    const nav = read('components/layout/Navigation.tsx')
    expect(nav).toContain('aria-label={`${section.label} menu`}')
    // Keyboard toggles; a pointer click after hover never closes (lib/nav-disclosure.ts).
    expect(nav).toMatch(/nextOpenSection\(\s*activeDropdown,\s*section\.id,\s*e\.detail\s*\)/)
    expect(nav).toContain("if (e.key === 'Escape') setActiveDropdown(null)")
  })

  it('the desktop menu is a disclosure: no menu popup claim, Escape returns focus, focus-out closes', () => {
    const nav = read('components/layout/Navigation.tsx')
    expect(nav).not.toContain('aria-haspopup')
    expect(nav).toMatch(/data-menu-toggle/)
    expect(nav).toMatch(/querySelector<HTMLButtonElement>\('\[data-menu-toggle\]'\)\?\.focus\(\)/)
    expect(nav).toMatch(/shouldCloseOnFocusOut\(\s*isActive,\s*e\.currentTarget,\s*e\.relatedTarget\s*\)/)
  })

  it('the menu panels contain no headings that come before the page h1', () => {
    expect(read('components/layout/Navigation.tsx')).not.toMatch(/<h[1-6]\b/)
  })

  it('the footer email field is labelled', () => {
    expect(read('components/layout/Footer.tsx')).toContain('aria-label="Email address"')
  })

  it('the hidden sticky apply bar is inert while hidden', () => {
    expect(read('app/jobs/[slug]/ApplyBarWithSticky.tsx')).toContain('inert={!showSticky}')
  })
})
