'use client'

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

const navItems = [
  { label: "Command Centre", href: "/admin", icon: "⚡" },
  { label: "Submissions", href: "/admin/submissions", icon: "📥" },
  { label: "Subscribers", href: "/admin/subscribers", icon: "📧" },
  { label: "Jobs & Firms", href: "/admin/jobs-firms", icon: "💼" },
  { label: "Content Factory", href: "/admin/content-factory", icon: "🏭" },
  { label: "Sanity Studio", href: "/studio", icon: "🎨" },
  { label: "Settings", href: "/admin/settings", icon: "⚙️" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/admin-logout", { method: "POST" })
    router.push("/admin-login")
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080d1a", display: "flex", fontFamily: "DM Sans, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: "240px", backgroundColor: "#0d1424", borderRight: "1px solid #1a2238", display: "flex", flexDirection: "column", position: "fixed", height: "100vh", zIndex: 10 }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px", borderBottom: "1px solid #1a2238" }}>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>AccountingBody</div>
          <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "2px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Admin Console</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {navItems.map((item) => {
            const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  marginBottom: "4px",
                  backgroundColor: isActive ? "#2563eb20" : "transparent",
                  color: isActive ? "#2563eb" : "#94a3b8",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: isActive ? "600" : "400",
                  border: isActive ? "1px solid #2563eb40" : "1px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "16px 12px", borderTop: "1px solid #1a2238" }}>
          <button
            onClick={handleLogout}
            style={{ width: "100%", backgroundColor: "transparent", border: "1px solid #1a2238", borderRadius: "8px", padding: "10px 12px", color: "#94a3b8", fontSize: "14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft: "240px", flex: 1, padding: "32px", minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  )
}
