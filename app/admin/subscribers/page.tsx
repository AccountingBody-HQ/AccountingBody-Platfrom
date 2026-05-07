import { createClient } from "@supabase/supabase-js"
import { Users } from "lucide-react"

async function getSubscribers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: subscribers, count } = await supabase
    .from("email_subscribers")
    .select("*", { count: "exact" })
    .order("subscribed_at", { ascending: false })

  return {
    subscribers: (subscribers ?? []) as Array<Record<string, string>>,
    total: count ?? 0,
  }
}

export default async function SubscribersPage() {
  const { subscribers, total } = await getSubscribers()

  const tableHeaderStyle = {
    padding: "12px 16px",
    textAlign: "left" as const,
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #1a2238",
  }

  const tableCellStyle = {
    padding: "14px 16px",
    fontSize: "14px",
    color: "#cbd5e1",
    borderBottom: "1px solid #1a2238",
    verticalAlign: "top" as const,
  }

  const csvRows = subscribers.map((s) => s.email + "," + (s.status ?? "active") + "," + s.subscribed_at).join("\n")
  const csvContent = "email,status,subscribed_at\n" + csvRows

  return (
    <div>
      <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Subscribers</h1>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Email list from footer and homepage signup forms</p>
        </div>
        <a
          href={"data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)}
          download="subscribers.csv"
          style={{ backgroundColor: "#10b981", color: "#ffffff", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          Export CSV
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontSize: "36px", fontWeight: "700", color: "#10b981", marginBottom: "4px" }}>{total}</div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>Total Subscribers</div>
        </div>
        <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontSize: "36px", fontWeight: "700", color: "#2563eb", marginBottom: "4px" }}>
            {subscribers.filter((s) => s.status === "active" || !s.status).length}
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>Active</div>
        </div>
        <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontSize: "36px", fontWeight: "700", color: "#f59e0b", marginBottom: "4px" }}>
            {subscribers.filter((s) => s.status === "unsubscribed").length}
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>Unsubscribed</div>
        </div>
      </div>

      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <Users size={18} style={{ color: "#10b981" }} />
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>All Subscribers ({total})</h2>
        </div>
        {subscribers.length === 0 ? (
          <div style={{ padding: "32px 24px", color: "#94a3b8", fontSize: "14px" }}>No subscribers yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Subscribed At</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.email}</td>
                    <td style={tableCellStyle}>
                      <span style={{
                        backgroundColor: item.status === "unsubscribed" ? "#ef444420" : "#10b98120",
                        color: item.status === "unsubscribed" ? "#ef4444" : "#10b981",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500"
                      }}>
                        {item.status ?? "active"}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>
                      {item.subscribed_at ? new Date(item.subscribed_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
