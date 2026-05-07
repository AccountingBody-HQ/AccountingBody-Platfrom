import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { title, content, qualification, contentType, subject } = await req.json()

    if (!title || !content || !qualification) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const writeToken = process.env.SANITY_WRITE_TOKEN
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET

    if (!writeToken || !projectId || !dataset) {
      return NextResponse.json({ error: "Sanity not configured" }, { status: 500 })
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96)

    const doc = {
      _type: "article",
      title: title,
      slug: { _type: "slug", current: slug },
      body: content,
      qualification: qualification,
      contentType: contentType || "Study Note",
      subject: subject || "",
      publishedAt: new Date().toISOString(),
    }

    const response = await fetch(
      "https://" + projectId + ".api.sanity.io/v2021-06-07/data/mutate/" + dataset,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + writeToken,
        },
        body: JSON.stringify({
          mutations: [{ create: doc }],
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: "Sanity error: " + error }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, documentId: data.results?.[0]?.id }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
