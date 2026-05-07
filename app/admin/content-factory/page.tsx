'use client'

import { useState } from "react"

const QUALIFICATIONS = ["ACCA", "CIMA", "ICAEW", "AAT"]

const CONTENT_TYPES = [
  "Study Note",
  "Practice Question Explainer",
  "Exam Technique Guide",
  "Subject Overview",
  "Past Paper Analysis",
]

const DIFFICULTY_LEVELS = ["Foundation", "Intermediate", "Advanced"]

const TONES = ["Academic but approachable", "Concise and technical", "Conversational", "Exam-focused"]

export default function ContentFactoryPage() {
  const [qualification, setQualification] = useState("ACCA")
  const [contentType, setContentType] = useState("Study Note")
  const [subject, setSubject] = useState("")
  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState("Intermediate")
  const [tone, setTone] = useState("Academic but approachable")
  const [editedContent, setEditedContent] = useState("")
  const [title, setTitle] = useState("")
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  async function handleGenerate() {
    if (!topic.trim()) {
      setError("Please enter a topic.")
      return
    }
    setGenerating(true)
    setError("")
    setSuccessMsg("")
    setEditedContent("")

    const res = await fetch("/api/admin/content-factory/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, qualification, subject, topic, difficulty, tone }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Generation failed.")
    } else {
      setEditedContent(data.content)
      const firstLine = data.content.split("\n")[0].replace(/^#+\s*/, "").trim()
      setTitle(firstLine || topic)
    }
    setGenerating(false)
  }

  async function handlePublish() {
    if (!editedContent.trim() || !title.trim()) {
      setError("Title and content are required to publish.")
      return
    }
    setPublishing(true)
    setError("")
    setSuccessMsg("")

    const res = await fetch("/api/admin/content-factory/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: editedContent, qualification, contentType, subject }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Publish failed.")
    } else {
      setSuccessMsg("Published successfully to Sanity! Document ID: " + data.documentId)
      setEditedContent("")
      setTitle("")
      setTopic("")
    }
    setPublishing(false)
  }

  const inputStyle = {
    width: "100%",
    backgroundColor: "#111827",
    border: "1px solid #1a2238",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "8px",
  }

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", margin: "0 0 8px 0" }}>Content Factory</h1>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>Generate ACCA, CIMA, ICAEW and AAT study content using Claude AI and publish directly to Sanity</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Config Panel */}
        <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: "0 0 24px 0" }}>Configure Content</h2>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Qualification</label>
            <select value={qualification} onChange={(e) => setQualification(e.target.value)} style={inputStyle}>
              {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Content Type</label>
            <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={inputStyle}>
              {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Subject / Paper</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Financial Reporting, P2, AA"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Topic <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Lease accounting under IFRS 16"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={inputStyle}>
              {DIFFICULTY_LEVELS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)} style={inputStyle}>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{ width: "100%", backgroundColor: "#2563eb", color: "#ffffff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: "600", cursor: generating ? "not-allowed" : "pointer", opacity: generating ? 0.7 : 1 }}
          >
            {generating ? "Generating..." : "Generate Content"}
          </button>
        </div>

        {/* Preview & Publish Panel */}
        <div>
          {error && (
            <div style={{ backgroundColor: "#ef444420", border: "1px solid #ef4444", borderRadius: "8px", padding: "16px", marginBottom: "16px", fontSize: "14px", color: "#ef4444" }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ backgroundColor: "#10b98120", border: "1px solid #10b981", borderRadius: "8px", padding: "16px", marginBottom: "16px", fontSize: "14px", color: "#10b981" }}>
              {successMsg}
            </div>
          )}

          {generating && (
            <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚙️</div>
              <div style={{ color: "#94a3b8", fontSize: "14px" }}>Claude is generating your content...</div>
            </div>
          )}

          {editedContent && !generating && (
            <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2238" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", margin: "0 0 12px 0" }}>Review & Edit</h2>
                <div style={{ marginBottom: "12px" }}>
                  <label style={labelStyle}>Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ padding: "24px" }}>
                <label style={labelStyle}>Content</label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={24}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6", fontFamily: "monospace" }}
                />
              </div>

              <div style={{ padding: "20px 24px", borderTop: "1px solid #1a2238", display: "flex", gap: "12px" }}>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  style={{ backgroundColor: "#10b981", color: "#ffffff", border: "none", borderRadius: "8px", padding: "12px 24px", fontSize: "14px", fontWeight: "600", cursor: publishing ? "not-allowed" : "pointer", opacity: publishing ? 0.7 : 1 }}
                >
                  {publishing ? "Publishing..." : "Publish to Sanity"}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #1a2238", borderRadius: "8px", padding: "12px 24px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {!editedContent && !generating && (
            <div style={{ backgroundColor: "#0d1424", border: "1px solid #1a2238", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏭</div>
              <div style={{ color: "#ffffff", fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>Content Factory Ready</div>
              <div style={{ color: "#94a3b8", fontSize: "14px" }}>Configure your content on the left and click Generate Content to begin.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
