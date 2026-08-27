import { CheckCircle, Circle, Server } from "lucide-react"

export default function SettingsPage() {
  const envVars = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, description: "Supabase project URL" },
    { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", required: true, description: "Supabase anon key" },
    { name: "SUPABASE_SECRET_KEY", required: true, description: "Supabase service role key — server only" },
    { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true, description: "Clerk publishable key" },
    { name: "CLERK_SECRET_KEY", required: true, description: "Clerk secret key" },
    { name: "RESEND_API_KEY", required: true, description: "Resend email API key" },
    { name: "ANTHROPIC_API_KEY", required: true, description: "Claude AI — Content Factory" },
    { name: "ADMIN_SECRET", required: true, description: "Admin console password" },
    { name: "NEXT_PUBLIC_SITE_URL", required: true, description: "Public site URL" },
    { name: "NEXT_PUBLIC_GTM_ID", required: false, description: "Google Tag Manager ID" },
    { name: "NEXT_PUBLIC_ADSENSE_ID", required: false, description: "AdSense verification ID" },
  ]

  const checklist = [
    { label: "Admin panel built", done: true },
    { label: "ADMIN_SECRET set", done: !!process.env.ADMIN_SECRET },
    { label: "ANTHROPIC_API_KEY set", done: !!process.env.ANTHROPIC_API_KEY },
    { label: "Clerk test keys upgraded to production", done: (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_live_") },
    { label: "GTM ID configured", done: !!process.env.NEXT_PUBLIC_GTM_ID },
    { label: "AdSense ID configured", done: !!process.env.NEXT_PUBLIC_ADSENSE_ID },
    { label: "Supabase Pro upgrade", done: false },
    { label: "Vercel Pro upgrade", done: false },
    { label: "Rate limiting on AI routes", done: false },
    { label: "CSP headers configured", done: false },
    { label: "Contact form tested end-to-end", done: false },
    { label: "Subscribe form tested end-to-end", done: false },
    { label: "WordPress content migration", done: false },
    { label: "EthioTax: HMRC AML registration", done: false },
    { label: "EthioTax: ICO GDPR registration", done: false },
    { label: "EthioTax: Terms of Service (UK solicitor)", done: false },
    { label: "EthioTax: First real client testimonial", done: false },
    { label: "EthioTax: GSC sitemap submitted", done: false },
  ]

  const completedCount = checklist.filter((i) => i.done).length

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Settings</h1>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Environment status, pre-launch checklist, and platform configuration</p>
      </div>

      {/* Pre-launch Checklist */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", marginBottom: "32px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckCircle size={18} style={{ color: "#10b981" }} />
            <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Pre-Launch Checklist</h2>
          </div>
          <span style={{ fontSize: "14px", color: "#94a3b8" }}>{completedCount} / {checklist.length} complete</span>
        </div>
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {checklist.map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {item.done ? <CheckCircle size={16} style={{ color: "#10b981" }} /> : <Circle size={16} style={{ color: "#334155" }} />}
              <span style={{ fontSize: "14px", color: item.done ? "#10b981" : "#94a3b8" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment Variables */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238", display: "flex", alignItems: "center", gap: "12px" }}>
          <Server size={18} style={{ color: "#2563eb" }} />
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: 0 }}>Environment Variables</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #1a2238" }}>Variable</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #1a2238" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #1a2238" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {envVars.map((env) => {
                const isSet = !!process.env[env.name]
                return (
                  <tr key={env.name}>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "#ffffff", fontFamily: "monospace", borderBottom: "1px solid #1a2238" }}>{env.name}</td>
                    <td style={{ padding: "14px 16px", borderBottom: "1px solid #1a2238" }}>
                      <span style={{
                        backgroundColor: isSet ? "#10b98120" : env.required ? "#ef444420" : "#f59e0b20",
                        color: isSet ? "#10b981" : env.required ? "#ef4444" : "#f59e0b",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}>
                        {isSet ? "SET" : env.required ? "MISSING" : "OPTIONAL"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "#94a3b8", borderBottom: "1px solid #1a2238" }}>{env.description}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Info */}
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px", marginTop: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: "0 0 16px 0" }}>Platform Configuration</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {[
            { label: "Framework", value: "Next.js 14.2.35" },
            { label: "CMS", value: "Supabase" },
            { label: "Database", value: "Supabase" },
            { label: "Auth", value: "Clerk" },
            { label: "Email", value: "Resend" },
            { label: "Deployment", value: "Vercel" },
            { label: "Qualifications", value: "ACCA, CIMA, ICAEW, AAT, ETICPA CPA, ETICPA ATQ" },
            { label: "Repository", value: "AccountingBody-Platfrom" },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "14px", color: "#ffffff", fontWeight: "500" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
