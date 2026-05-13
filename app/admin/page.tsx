import { createClient } from "@supabase/supabase-js"
import { unstable_noStore as noStore } from "next/cache"
import Link from "next/link"
import AutoRefresh from "@/components/admin/AutoRefresh"
import {
  Mail, Users, HelpCircle, Building2, Briefcase,
  ArrowRight, TrendingUp, Factory, Inbox
} from "lucide-react"

export const dynamic = "force-dynamic"

async function getStats() {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [
    { count: contactCount },
    { count: subscriberCount },
    { count: helpCount },
    { count: firmsCount },
    { count: jobsCount },
    { count: openHelpCount },
    { count: pendingFirmsCount },
  ] = await Promise.all([
    supabase.from("contact_submissions").select("*", { count: "exact", head: true }).eq("platform", "ab"),
    supabase.from("email_subscribers").select("*", { count: "exact", head: true }).eq("platform", "ab"),
    supabase.from("help_requests").select("*", { count: "exact", head: true }).eq("platform", "ab"),
    supabase.from("firms_applications").select("*", { count: "exact", head: true }).eq("platform", "ab"),
    supabase.from("job_listings").select("*", { count: "exact", head: true }),
    supabase.from("help_requests").select("*", { count: "exact", head: true }).eq("platform", "ab").eq("status", "open"),
    supabase.from("firms_applications").select("*", { count: "exact", head: true }).eq("platform", "ab").in("status", ["pending", "under_review"]),
  ])

  const { data: recentSubmissions } = await supabase
    .from("contact_submissions")
    .select("id, name, email, subject, created_at")
    .eq("platform", "ab")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentSubscribers } = await supabase
    .from("email_subscribers")
    .select("id, email, subscribed_at")
    .eq("platform", "ab")
    .order("subscribed_at", { ascending: false })
    .limit(5)

  const { data: recentHelpRequests } = await supabase
    .from("help_requests")
    .select("id, name, email, service_type, status, created_at")
    .eq("platform", "ab")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: pendingFirms } = await supabase
    .from("firms_applications")
    .select("id, firm_name, contact_email, firm_type, status, created_at")
    .eq("platform", "ab")
    .in("status", ["pending", "under_review"])
    .order("created_at", { ascending: false })
    .limit(5)

  return {
    contactCount:      contactCount      ?? 0,
    subscriberCount:   subscriberCount   ?? 0,
    helpCount:         helpCount         ?? 0,
    firmsCount:        firmsCount        ?? 0,
    jobsCount:         jobsCount         ?? 0,
    openHelpCount:     openHelpCount     ?? 0,
    pendingFirmsCount: pendingFirmsCount ?? 0,
    recentSubmissions:   (recentSubmissions   ?? []) as Array<{id: string; name: string; email: string; subject: string; created_at: string}>,
    recentSubscribers:   (recentSubscribers   ?? []) as Array<{id: string; email: string; subscribed_at: string}>,
    recentHelpRequests:  (recentHelpRequests  ?? []) as Array<{id: string; name: string; email: string; service_type: string; status: string; created_at: string}>,
    pendingFirms:        (pendingFirms        ?? []) as Array<{id: string; firm_name: string; contact_email: string; firm_type: string; status: string; created_at: string}>,
  }
}

export default async function AdminCommandCentre() {
  const stats = await getStats()

  const STAT_CARDS = [
    {
      label: "Contact Submissions",
      value: stats.contactCount,
      sub: "from contact form",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.2)",
      icon: Mail,
      href: "/admin/submissions",
    },
    {
      label: "Email Subscribers",
      value: stats.subscriberCount,
      sub: "on the mailing list",
      color: "#10b981",
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
      icon: Users,
      href: "/admin/subscribers",
    },
    {
      label: "Help Requests",
      value: stats.helpCount,
      sub: stats.openHelpCount + " open — needs action",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.2)",
      icon: HelpCircle,
      href: "/admin/submissions",
    },
    {
      label: "Firm Applications",
      value: stats.firmsCount,
      sub: stats.pendingFirmsCount + " pending review",
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.08)",
      border: "rgba(139,92,246,0.2)",
      icon: Building2,
      href: "/admin/jobs-firms",
    },
    {
      label: "Job Listings",
      value: stats.jobsCount,
      sub: "on the job board",
      color: "#ec4899",
      bg: "rgba(236,72,153,0.08)",
      border: "rgba(236,72,153,0.2)",
      icon: Briefcase,
      href: "/admin/jobs-firms",
    },
  ]

  const QUICK_ACTIONS = [
    { label: "View Submissions",   sub: "Help & contact forms",     href: "/admin/submissions",     icon: Inbox,       color: "#3b82f6" },
    { label: "Manage Subscribers", sub: "Email list & CSV export",  href: "/admin/subscribers",     icon: Users,       color: "#10b981" },
    { label: "Content Factory",    sub: "Generate AI study content",href: "/admin/content-factory", icon: Factory,     color: "#f59e0b" },
    { label: "Jobs & Firms",       sub: "Listings & applications",  href: "/admin/jobs-firms",      icon: Briefcase,   color: "#8b5cf6" },
    { label: "Questions",          sub: "Generate practice questions",href: "/admin/questions",       icon: HelpCircle,  color: "#D4A017" },
  ]

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Command Centre</h1>
        <p className="text-sm" style={{ color: "#475569" }}>
          Live platform overview — {stats.subscriberCount} subscribers · {stats.contactCount} contact submissions · {stats.helpCount} help requests
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {STAT_CARDS.map(card => (
          <Link key={card.label} href={card.href}
            className="rounded-2xl p-5 border transition-all hover:scale-[1.02] group"
            style={{ background: card.bg, borderColor: card.border }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${card.color}20` }}>
                <card.icon size={17} style={{ color: card.color }} />
              </div>
              <ArrowRight size={14} style={{ color: card.color }} className="opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </div>
            <p className="text-3xl font-black text-white mb-1">{card.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: card.color }}>{card.label}</p>
            <p className="text-xs" style={{ color: "#334155" }}>{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">

        {/* Recent Submissions */}
        <div className="col-span-2 rounded-2xl border overflow-hidden"
          style={{ background: "#0d1424", borderColor: "#1a2238" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "#1a2238" }}>
            <div className="flex items-center gap-2">
              <Inbox size={15} style={{ color: "#3b82f6" }} />
              <h2 className="text-white font-bold text-sm">Recent Contact Submissions</h2>
            </div>
            <Link href="/admin/submissions"
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "#475569" }}>
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a2238" }}>
            {stats.recentSubmissions.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm" style={{ color: "#334155" }}>No submissions yet.</p>
              </div>
            ) : (
              stats.recentSubmissions.map((item) => (
                <div key={item.id} className="px-6 py-3.5 flex items-center justify-between"
                  style={{ borderColor: "#1a2238" }}>
                  <div>
                    <p className="text-white text-sm font-semibold">{item.name}</p>
                    <p className="text-xs" style={{ color: "#475569" }}>{item.email} · {item.subject ?? "No subject"}</p>
                  </div>
                  <p className="text-xs" style={{ color: "#334155" }}>
                    {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Subscribers */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: "#0d1424", borderColor: "#1a2238" }}>
          <div className="px-5 py-4 border-b flex items-center gap-2"
            style={{ borderColor: "#1a2238" }}>
            <Users size={14} style={{ color: "#10b981" }} />
            <h2 className="text-white font-bold text-sm">Recent Subscribers</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a2238" }}>
            {stats.recentSubscribers.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs" style={{ color: "#334155" }}>No subscribers yet.</p>
              </div>
            ) : (
              stats.recentSubscribers.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3"
                  style={{ borderColor: "#1a2238" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(16,185,129,0.1)" }}>
                    <Users size={12} style={{ color: "#10b981" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{item.email}</p>
                    <p className="text-xs" style={{ color: "#334155" }}>
                      {item.subscribed_at ? new Date(item.subscribed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </p>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#10b981" }} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Open Help Requests */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: "#0d1424", borderColor: "#1a2238" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "#1a2238" }}>
            <div className="flex items-center gap-2">
              <HelpCircle size={15} style={{ color: "#f59e0b" }} />
              <h2 className="text-white font-bold text-sm">Open Help Requests</h2>
            </div>
            <div className="flex items-center gap-3">
              {stats.openHelpCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                  {stats.openHelpCount} open
                </span>
              )}
              <Link href="/admin/submissions"
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: "#475569" }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a2238" }}>
            {stats.recentHelpRequests.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm" style={{ color: "#334155" }}>No open help requests.</p>
              </div>
            ) : (
              stats.recentHelpRequests.map((item) => (
                <div key={item.id} className="px-6 py-3.5 flex items-center justify-between gap-4"
                  style={{ borderColor: "#1a2238" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.service_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: "rgba(37,99,235,0.1)", color: "#60a5fa" }}>
                          {item.service_type}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "#334155" }}>
                        {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                  <a href={"mailto:" + item.email}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0"
                    style={{ background: "rgba(37,99,235,0.1)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.2)" }}>
                    ✉ Reply
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Firm Applications */}
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: "#0d1424", borderColor: "#1a2238" }}>
          <div className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "#1a2238" }}>
            <div className="flex items-center gap-2">
              <Building2 size={15} style={{ color: "#8b5cf6" }} />
              <h2 className="text-white font-bold text-sm">Pending Applications</h2>
            </div>
            <div className="flex items-center gap-3">
              {stats.pendingFirmsCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                  {stats.pendingFirmsCount} pending
                </span>
              )}
              <Link href="/admin/jobs-firms"
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: "#475569" }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a2238" }}>
            {stats.pendingFirms.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm" style={{ color: "#334155" }}>No pending applications.</p>
              </div>
            ) : (
              stats.pendingFirms.map((item) => (
                <div key={item.id} className="px-6 py-3.5 flex items-center justify-between gap-4"
                  style={{ borderColor: "#1a2238" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.firm_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.firm_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>
                          {item.firm_type}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "#334155" }}>
                        {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                  <a href={"mailto:" + item.contact_email}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0"
                    style={{ background: "rgba(37,99,235,0.1)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.2)" }}>
                    ✉ Reply
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "#0d1424", borderColor: "#1a2238" }}>
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "#1a2238" }}>
          <TrendingUp size={14} style={{ color: "#2563eb" }} />
          <h2 className="text-white font-bold text-sm">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: "#1a2238" }}>
          {QUICK_ACTIONS.map(action => (
            <Link key={action.label} href={action.href}
              className="px-6 py-5 flex flex-col gap-3 transition-all group hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${action.color}15` }}>
                <action.icon size={17} style={{ color: action.color }} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold mb-0.5">{action.label}</p>
                <p className="text-xs" style={{ color: "#334155" }}>{action.sub}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold mt-auto"
                style={{ color: action.color }}>
                Open <ArrowRight size={11} />
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
