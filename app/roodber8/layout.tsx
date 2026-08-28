'use client'
import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Inbox, Users, Briefcase, Building2,
  Factory, Settings, LogOut, ExternalLink,
  ChevronRight, BookOpen
} from 'lucide-react'

// Sanity Studio nav entry removed — Sanity CMS is fully decommissioned (replaced by Supabase).
const NAV = [
  { href: '/roodber8',                 exact: true,  icon: LayoutDashboard, label: 'Command Centre',  sub: 'Overview & live stats'     },
  { href: '/roodber8/submissions',     exact: false, icon: Inbox,           label: 'Submissions',     sub: 'Help & contact forms'      },
  { href: '/roodber8/subscribers',     exact: false, icon: Users,           label: 'Subscribers',     sub: 'Email list & export'       },
  { href: '/roodber8/jobs-firms',      exact: false, icon: Briefcase,       label: 'Jobs & Firms',    sub: 'Listings & applications'   },
  { href: '/roodber8/candidates',      exact: false, icon: Users,           label: 'Candidates',      sub: 'Candidate registrations'   },
  { href: '/roodber8/employers',        exact: false, icon: Building2,        label: 'Employers',       sub: 'Employer briefs'           },
  { href: '/roodber8/questions',        exact: false, icon: BookOpen,        label: 'Questions',       sub: 'Generate and manage MCQs'  },
  { href: '/roodber8/content-factory', exact: false, icon: Factory,         label: 'Content Factory', sub: 'AI content generation'     },
  { href: '/roodber8/course-factory',   exact: false, icon: BookOpen,        label: 'Course Factory',  sub: 'Assemble structured courses' },
  { href: '/roodber8/ab-press',         exact: false, icon: BookOpen,        label: 'AB Press',        sub: 'Generate KDP-ready books'    },
  { href: '/roodber8/settings',        exact: false, icon: Settings,        label: 'Settings',        sub: 'Environment & checklist'   },
]

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getBreadcrumb(pathname: string) {
  const map: Record<string, string> = {
    '/roodber8':                    'Command Centre',
    '/roodber8/submissions':        'Submissions',
    '/roodber8/subscribers':        'Subscribers',
    '/roodber8/jobs-firms':         'Jobs & Firms',
    '/roodber8/candidates':         'Candidates',
    '/roodber8/employers':          'Employers',
    '/roodber8/questions':          'Questions',
    '/roodber8/questions/generate': 'Generate',
    '/roodber8/questions/import':   'Import',
    '/roodber8/content-factory':    'Content Factory',
    '/roodber8/course-factory':     'Course Factory',
    '/roodber8/ab-press':           'AB Press',
  }
  if (map[pathname]) return map[pathname]

  const segments = pathname.split('/')
  if (segments[1] === 'roodber8' && segments[2] === 'questions' && segments[3] && UUID_RE.test(segments[3])) {
    return 'Manage Set'
  }

  const base = '/' + segments.slice(1, 3).join('/')
  return map[base] ?? 'Admin'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const crumb = getBreadcrumb(pathname)

  async function handleLogout() {
    await fetch('/api/roodber8-logout', { method: 'POST' })
    router.push('/roodber8-login')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#080d1a' }}>

      {/* SIDEBAR */}
      <aside className="w-64 shrink-0 flex flex-col border-r" style={{ background: '#0d1424', borderColor: '#1a2238' }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1a2238' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
              <LayoutDashboard size={17} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-tight">AccountingBody</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-xs font-semibold" style={{ color: '#34d399' }}>Admin Console</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = isActive(pathname, item.href, item.exact)
            return (
              <Link key={item.href} href={item.href} target={item.href.startsWith("https://") ? "_blank" : undefined} rel={item.href.startsWith("https://") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative"
                style={{
                  background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
                  borderLeft: active ? '2px solid #2563eb' : '2px solid transparent',
                }}>
                {active && (
                  <div className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{ background: 'linear-gradient(90deg,rgba(37,99,235,0.06),transparent)' }} />
                )}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
                  style={{ background: active ? '#2563eb' : 'rgba(255,255,255,0.04)' }}>
                  <item.icon size={15} style={{ color: active ? '#ffffff' : '#475569' }} />
                </div>
                <div className="relative">
                  <p className="text-sm font-semibold" style={{ color: active ? '#ffffff' : '#64748b' }}>
                    {item.label}
                  </p>
                  <p className="text-xs" style={{ color: active ? 'rgba(255,255,255,0.45)' : '#334155' }}>
                    {item.sub}
                  </p>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t space-y-0.5" style={{ borderColor: '#1a2238' }}>
          <a href="/"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold" style={{ color: '#475569' }}>View Live Platform</span>
            </div>
            <ExternalLink size={11} style={{ color: '#1e293b' }} />
          </a>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all w-full text-left"
            style={{ background: 'transparent' }}>
            <LogOut size={14} style={{ color: '#ef4444' }} />
            <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>Log out</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-12 shrink-0 flex items-center px-6 border-b"
          style={{ background: '#0d1424', borderColor: '#1a2238' }}>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold" style={{ color: '#334155' }}>Admin</span>
            <ChevronRight size={12} style={{ color: '#1e293b' }} />
            <span className="font-semibold" style={{ color: '#64748b' }}>{crumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold" style={{ color: '#34d399' }}>Live</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Suspense fallback={
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-8 w-64 rounded-xl" style={{ background: '#0d1424' }} />
              <div className="h-4 w-96 rounded-lg" style={{ background: '#0d1424' }} />
              <div className="grid grid-cols-4 gap-4 mt-6">
                {[...Array(4)].map((_,i) => (
                  <div key={i} className="h-28 rounded-2xl" style={{ background: '#0d1424' }} />
                ))}
              </div>
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
