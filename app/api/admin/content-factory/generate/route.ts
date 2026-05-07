import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { contentType, qualification, subject, topic, difficulty, tone } = await req.json()

    if (!contentType || !qualification || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })
    }

    const systemPrompt = "You are an expert accounting tutor and content writer specialising in UK professional accounting qualifications. You write clear, accurate, and engaging study content for students preparing for " + qualification + " examinations. Your content is always precise, uses correct accounting terminology, and is structured for effective learning."

    const userPrompt = "Write a " + contentType + " for " + qualification + " students.\n\nSubject/Paper: " + (subject || "General") + "\nTopic: " + topic + "\nDifficulty Level: " + (difficulty || "Intermediate") + "\nTone: " + (tone || "Academic but approachable") + "\n\nStructure your response with:\n1. A clear title\n2. An introduction explaining why this topic matters for " + qualification + "\n3. The main content with clear headings and subheadings\n4. Key points to remember\n5. A brief exam technique tip specific to " + qualification + "\n\nWrite in full sentences and paragraphs. Be thorough but concise. Target length: 600-900 words."

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: "Claude API error: " + error }, { status: 500 })
    }

    const data = await response.json()
    const content = data.content?.[0]?.text ?? ""

    return NextResponse.json({ content }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
