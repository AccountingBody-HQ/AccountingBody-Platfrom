import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

async function generateCaption(article: {
  title: string
  excerpt: string | null
  category_title: string | null
  slug: string
  exam_body: string[] | null
}): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const examBody = (article.exam_body?.[0] ?? 'ACCA').toUpperCase()
  const articleUrl = `https://accountingbody.com/study/${article.slug}`

  const prompt = `You are a social media expert for a professional accounting and finance platform.
Write a Facebook post for the following article. The post must:

1. Open with ONE punchy hook sentence that stops the scroll — a surprising fact,
   a common misconception, or a provocative professional question. No emojis in the hook.
2. Follow with a blank line, then ONE sentence explaining what the article covers and why it matters.
3. Follow with a blank line, then exactly 4 bullet points using ✅ emoji, each one a specific
   learning outcome the reader will get from the article. Each bullet: max 12 words.
4. Follow with a blank line, then this exact line:
   Read the full article →
5. Follow with the article URL on its own line: ${articleUrl}
6. Follow with a blank line, then 5-6 relevant hashtags on one line.
   Always include #Accounting #${examBody} #AccountingBody plus 2-3 topic-specific ones.

ARTICLE DETAILS:
Title: ${article.title}
Category: ${article.category_title ?? 'Accounting'}
Exam Body: ${examBody}
Summary: ${article.excerpt ?? article.title}

Rules:
— No generic filler like "In this article" or "Check out our latest post"
— No em dashes in the hook
— The hook must be specific to this article's topic, not generic accounting content
— Write for accounting professionals and serious students, not a general audience
— Return ONLY the post text. No preamble, no explanation, no quotes around the output.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text.trim()
}

async function postToFacebook(caption: string): Promise<{ id: string }> {
  const pageId = process.env.FB_PAGE_ID
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN
  if (!pageId || !pageToken) throw new Error('Facebook credentials not configured')

  const res = await fetch(
    `https://graph.facebook.com/v26.0/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: caption,
        access_token: pageToken,
      }),
    }
  )

  const data = await res.json() as { id?: string; error?: { message: string } }
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? 'Facebook API error')
  }
  return { id: data.id! }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      action: 'generate' | 'post'
      caption?: string
      article?: {
        title: string
        excerpt: string | null
        category_title: string | null
        slug: string
        exam_body: string[] | null
      }
    }

    if (body.action === 'generate') {
      if (!body.article) {
        return NextResponse.json({ error: 'Article required for generate' }, { status: 400 })
      }
      const caption = await generateCaption(body.article)
      return NextResponse.json({ caption })
    }

    if (body.action === 'post') {
      if (!body.caption?.trim()) {
        return NextResponse.json({ error: 'Caption required for post' }, { status: 400 })
      }
      const result = await postToFacebook(body.caption)

      // Log to Supabase best-effort
      try {
        const supabase = getSupabase()
        await supabase.from('social_posts').insert({
          platform: 'facebook',
          caption: body.caption,
          post_id: result.id,
          posted_at: new Date().toISOString(),
          platform_ab: 'ab',
        })
      } catch {
        // non-fatal
      }

      return NextResponse.json({ success: true, postId: result.id })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
