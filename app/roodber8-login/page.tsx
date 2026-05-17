'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/roodber8-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, totpCode }),
    })

    if (res.ok) {
      router.push("/roodber8")
    } else {
      const data = await res.json()
      setError(data.error || "Access denied.")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, sans-serif" }}>
      <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "48px", width: "100%", maxWidth: "400px" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#ffffff", marginBottom: "8px" }}>Accounting Body</div>
          <div style={{ fontSize: "14px", color: "#94a3b8" }}>Admin Console</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px" }}>
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", backgroundColor: "#111827", border: "1px solid #1a2238", borderRadius: "8px", padding: "12px", color: "#ffffff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
              placeholder="Enter admin password"
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", color: "#94a3b8", marginBottom: "8px" }}>
              Google Authenticator Code
            </label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{ width: "100%", backgroundColor: "#111827", border: "1px solid #1a2238", borderRadius: "8px", padding: "12px", color: "#ffffff", fontSize: "14px", outline: "none", boxSizing: "border-box", letterSpacing: "0.3em", textAlign: "center" }}
              placeholder="000000"
            />
          </div>
          {error && (
            <div style={{ backgroundColor: "#ef444420", border: "1px solid #ef4444", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "13px", color: "#ef4444" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Verifying..." : "Access Admin Console"}
          </button>
        </form>
      </div>
    </div>
  )
}
