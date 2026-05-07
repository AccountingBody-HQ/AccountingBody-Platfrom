import { createClient } from "@supabase/supabase-js"

async function getSubmissions() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: helpRequests } = await supabase
    .from("help_requests")
    .select("*")
    .order("created_at", { ascending: false })

  const { data: contactSubmissions } = await supabase
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })

  return {
    helpRequests: helpRequests ?? [],
    contactSubmissions: contactSubmissions ?? [],
  }
}

export default async function SubmissionsPage() {
  const { helpRequests, contactSubmissions } = await getSubmissions()

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

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Submissions</h1>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Help requests and contact form submissions</p>
      </div>

      {/* Help Requests */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", marginBottom: "32px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px" }}>🙋</span>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Help Requests ({helpRequests.length})</h2>
        </div>
        {helpRequests.length === 0 ? (
          <div style={{ padding: "32px 24px", color: "#94a3b8", fontSize: "14px" }}>No help requests yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Phone</th>
                  <th style={tableHeaderStyle}>Service Type</th>
                  <th style={tableHeaderStyle}>Message</th>
                  <th style={tableHeaderStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {helpRequests.map((item: any) => (
                  <tr key={item.id} style={{ backgroundColor: "transparent" }}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.name}</td>
                    <td style={tableCellStyle}>{item.email}</td>
                    <td style={tableCellStyle}>{item.phone ?? "—"}</td>
                    <td style={tableCellStyle}>
                      <span style={{ backgroundColor: "#2563eb20", color: "#2563eb", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "500" }}>
                        {item.service_type ?? "—"}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: "300px" }}>
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.message}</div>
                    </td>
                    <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>{new Date(item.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contact Submissions */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px" }}>📬</span>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Contact Submissions ({contactSubmissions.length})</h2>
        </div>
        {contactSubmissions.length === 0 ? (
          <div style={{ padding: "32px 24px", color: "#94a3b8", fontSize: "14px" }}>No contact submissions yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Name</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Subject</th>
                  <th style={tableHeaderStyle}>Message</th>
                  <th style={tableHeaderStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {contactSubmissions.map((item: any) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.name}</td>
                    <td style={tableCellStyle}>{item.email}</td>
                    <td style={tableCellStyle}>{item.subject ?? "—"}</td>
                    <td style={{ ...tableCellStyle, maxWidth: "300px" }}>
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.message}</div>
                    </td>
                    <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>{new Date(item.created_at).toLocaleDateString()}</td>
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
