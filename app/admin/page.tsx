import { createClient } from "@supabase/supabase-js"

async function getStats() {
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
  ] = await Promise.all([
    supabase.from("contact_submissions").select("*", { count: "exact", head: true }),
    supabase.from("email_subscribers").select("*", { count: "exact", head: true }),
    supabase.from("help_requests").select("*", { count: "exact", head: true }),
    supabase.from("firms_applications").select("*", { count: "exact", head: true }),
    supabase.from("job_listings").select("*", { count: "exact", head: true }),
  ])

  const { data: recentSubmissions } = await supabase
    .from("contact_submissions")
    .select("id, name, email, subject, created_at")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentSubscribers } = await supabase
    .from("email_subscribers")
    .select("id, email, subscribed_at")
    .order("subscribed_at", { ascending: false })
    .limit(5)

  return {
    contactCount: contactCount ?? 0,
    subscriberCount: subscriberCount ?? 0,
    helpCount: helpCount ?? 0,
    firmsCount: firmsCount ?? 0,
    jobsCount: jobsCount ?? 0,
    recentSubmissions: (recentSubmissions ?? []) as Array<{id: string; name: string; email: string; subject: string; created_at: string}>,
    recentSubscribers: (recentSubscribers ?? []) as Array<{id: string; email: string; subscribed_at: string}>,
  }
}

export default async function AdminCommandCentre() {
  const stats = await getStats()

  const statCards = [
    { label: "Contact Submissions", value: stats.contactCount, icon: "📬", color: "#2563eb" },
    { label: "Email Subscribers", value: stats.subscriberCount, icon: "📧", color: "#10b981" },
    { label: "Help Requests", value: stats.helpCount, icon: "🙋", color: "#f59e0b" },
    { label: "Firm Applications", value: stats.firmsCount, icon: "🏢", color: "#8b5cf6" },
    { label: "Job Listings", value: stats.jobsCount, icon: "💼", color: "#ec4899" },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Command Centre</h1>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Live platform overview — all data from Supabase</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "40px" }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>{card.icon}</div>
            <div style={{ fontSize: "36px", fontWeight: "700", color: card.color, marginBottom: "4px" }}>{card.value}</div>
            <div style={{ fontSize: "13px", color: "#94a3b8" }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Recent Submissions */}
        <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: "0 0 16px 0" }}>Recent Contact Submissions</h2>
          {stats.recentSubmissions.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#94a3b8" }}>No submissions yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {stats.recentSubmissions.map((item) => (
                <div key={item.id} style={{ borderBottom: "1px solid #1a2238", paddingBottom: "12px" }}>
                  <div style={{ fontSize: "14px", color: "#ffffff", fontWeight: "500" }}>{item.name}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>{item.email}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>{item.subject}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>{new Date(item.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Subscribers */}
        <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: "0 0 16px 0" }}>Recent Subscribers</h2>
          {stats.recentSubscribers.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#94a3b8" }}>No subscribers yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {stats.recentSubscribers.map((item) => (
                <div key={item.id} style={{ borderBottom: "1px solid #1a2238", paddingBottom: "12px" }}>
                  <div style={{ fontSize: "14px", color: "#ffffff", fontWeight: "500" }}>{item.email}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>{new Date(item.subscribed_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
