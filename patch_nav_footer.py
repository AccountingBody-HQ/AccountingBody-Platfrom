import re

# ── 1. FOOTER — fix legal link hrefs ─────────────────────────────────────────
with open("components/layout/Footer.tsx", "r") as f:
    footer = f.read()

footer = footer.replace(
    """const legalLinks = [
  { label: 'Privacy Policy',    href: '/privacy' },
  { label: 'Terms of Service',  href: '/terms' },
  { label: 'Cookie Policy',     href: '/cookies' },
  { label: 'Accessibility',     href: '/accessibility' },
  { label: 'Sitemap',           href: '/sitemap' },
]""",
    """const legalLinks = [
  { label: 'Privacy Policy',    href: '/privacy-policy' },
  { label: 'Terms of Service',  href: '/terms' },
  { label: 'Cookie Policy',     href: '/cookie-policy' },
  { label: 'Disclaimer',        href: '/disclaimer' },
  { label: 'Accessibility',     href: '/accessibility' },
  { label: 'Sitemap',           href: '/sitemap' },
]"""
)

# Fix the privacy link in email signup form too
footer = footer.replace(
    "href=\"/privacy\" className=\"underline hover:text-white/60\">Privacy Policy",
    "href=\"/privacy-policy\" className=\"underline hover:text-white/60\">Privacy Policy"
)

with open("components/layout/Footer.tsx", "w") as f:
    f.write(footer)
print("  patched  components/layout/Footer.tsx")

# ── 2. NAV — add About and Contact as simple links ───────────────────────────
with open("components/layout/Navigation.tsx", "r") as f:
    nav = f.read()

# Add About and Contact after the closing brace of the firms section
nav = nav.replace(
    """  {
    id:    'firms',
    label: 'Firms & Freelancers',""",
    """  {
    id:    'about',
    label: 'About',
    href:  '/about',
  },
  {
    id:    'contact',
    label: 'Contact',
    href:  '/contact',
  },
  {
    id:    'firms',
    label: 'Firms & Freelancers',"""
)

with open("components/layout/Navigation.tsx", "w") as f:
    f.write(nav)
print("  patched  components/layout/Navigation.tsx")

print("\nDone. Now run: git add . && git commit -m 'Add nav/footer links for About, Contact, legal pages' && git push")
