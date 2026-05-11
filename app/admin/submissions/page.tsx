'use client'

import { useEffect, useState, useCallback } from 'react'
import { HelpCircle, Mail } from 'lucide-react'

type Row = Record<string, string>

export default function SubmissionsPage() {
  const [helpRequests, setHelpRequests] = useState<Row[]>([])
  const [contactSubmissions, setContactSubmissions] = useState<Row[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/submissions', { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      setHelpRequests(data.helpRequests ?? [])
      setContactSubmissions(data.contactSubmissions ?? [])
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Failed to fetch submissions:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

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
      <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Submissions</h1>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Help requests and contact form submissions</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastUpdated && (
            <span style={{ fontSize: "12px", color: "#475569" }}>Updated {lastUpdated}</span>
          )}
          <button onClick={fetchData}
            style={{ fontSize: "12px", color: "#94a3b8", background: "#1a2238", border: "1px solid #2a3550", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Help Requests */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", marginBottom: "32px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <HelpCircle size={18} style={{ color: "#f59e0b" }} />
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
                {helpRequests.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.name ?? "—"}</td>
                    <td style={tableCellStyle}>
                      <a href={`mailto:${item.email}`} style={{ color: "#94a3b8", textDecoration: "none" }}>{item.email ?? "—"}</a>
                    </td>
                    <td style={tableCellStyle}>{item.phone ?? "—"}</td>
                    <td style={tableCellStyle}>
                      <span style={{ backgroundColor: "#2563eb20", color: "#60a5fa", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "500" }}>
                        {item.service_type ?? "—"}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, maxWidth: "300px" }}>
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.message ?? "—"}</div>
                    </td>
                    <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
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
          <Mail size={18} style={{ color: "#3b82f6" }} />
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
                {contactSubmissions.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, color: "#ffffff", fontWeight: "500" }}>{item.name ?? "—"}</td>
                    <td style={tableCellStyle}>
                      <a href={`mailto:${item.email}`} style={{ color: "#94a3b8", textDecoration: "none" }}>{item.email ?? "—"}</a>
                    </td>
                    <td style={tableCellStyle}>{item.subject ?? "—"}</td>
                    <td style={{ ...tableCellStyle, maxWidth: "300px" }}>
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.message ?? "—"}</div>
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
