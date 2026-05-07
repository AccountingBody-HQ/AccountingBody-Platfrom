import { createClient } from "@supabase/supabase-js"

async function getJobsAndFirms() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: jobListings } = await supabase
    .from("job_listings")
    .select("*")
    .order("created_at", { ascending: false })

  const { data: firmsApplications } = await supabase
    .from("firms_applications")
    .select("*")
    .order("created_at", { ascending: false })

  return {
    jobListings: (jobListings ?? []) as Array<Record<string, string>>,
    firmsApplications: (firmsApplications ?? []) as Array<Record<string, string>>,
  }
}

export default async function JobsFirmsPage() {
  const { jobListings, firmsApplications } = await getJobsAndFirms()

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
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Jobs & Firms</h1>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Job listings and firm directory applications</p>
      </div>

      {/* Job Listings */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", marginBottom: "32px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px" }}>💼</span>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Job Listings ({jobListings.length})</h2>
        </div>
        {jobListings.length === 0 ? (
          <div style={{ padding: "32px 24px", color: "#94a3b8", fontSize: "14px" }}>No job listings yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Job Title</th>
                  <th style={tableHeaderStyle}>Company</th>
                  <th style={tableHeaderStyle}>Type</th>
                  <th style={tableHeaderStyle}>Location</th>
                  <th style={tableHeaderStyle}>Salary</th>
                  <th style={tableHeaderStyle}>Contact</th>
                  <th style={tableHeaderStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {jobListings.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.job_title ?? "—"}</td>
                    <td style={tableCellStyle}>{item.company_name ?? "—"}</td>
                    <td style={tableCellStyle}>
                      <span style={{ backgroundColor: "#2563eb20", color: "#2563eb", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "500" }}>
                        {item.job_type ?? "—"}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{item.location ?? "—"}</td>
                    <td style={tableCellStyle}>{item.salary_range ?? "—"}</td>
                    <td style={tableCellStyle}>{item.contact_email ?? "—"}</td>
                    <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Firms Applications */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px" }}>🏢</span>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Firm Applications ({firmsApplications.length})</h2>
        </div>
        {firmsApplications.length === 0 ? (
          <div style={{ padding: "32px 24px", color: "#94a3b8", fontSize: "14px" }}>No firm applications yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Practice Name</th>
                  <th style={tableHeaderStyle}>Type</th>
                  <th style={tableHeaderStyle}>Contact</th>
                  <th style={tableHeaderStyle}>Email</th>
                  <th style={tableHeaderStyle}>Location</th>
                  <th style={tableHeaderStyle}>Website</th>
                  <th style={tableHeaderStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {firmsApplications.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.practice_name ?? "—"}</td>
                    <td style={tableCellStyle}>
                      <span style={{ backgroundColor: "#8b5cf620", color: "#8b5cf6", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "500" }}>
                        {item.practice_type ?? "—"}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{item.contact_name ?? "—"}</td>
                    <td style={tableCellStyle}>{item.email ?? "—"}</td>
                    <td style={tableCellStyle}>{item.location ?? "—"}</td>
                    <td style={tableCellStyle}>
                      {item.website ? (
                        <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                          {item.website}
                        </a>
                      ) : "—"}
                    </td>
                    <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
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
