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

// ── Content fetchers ──────────────────────────────────────

async function fetchArticleById(contentId: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('articles')
    .select('title, slug, excerpt, category, category_title, exam_body')
    .eq('content_id', contentId)
    .single()
  if (error || !data) throw new Error(`Article not found: ${contentId}`)
  return data as {
    title: string
    slug: string
    excerpt: string | null
    category: string | null
    category_title: string | null
    exam_body: string[] | null
  }
}

async function fetchQuestionSetById(contentId: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('question_sets')
    .select('title, slug, excerpt, topic, exam_body, difficulty')
    .eq('content_id', contentId)
    .single()
  if (error || !data) throw new Error(`Question set not found: ${contentId}`)
  return data as {
    title: string
    slug: string
    excerpt: string | null
    topic: string | null
    exam_body: string[] | null
    difficulty: string | null
  }
}

// ── Caption generators ────────────────────────────────────

async function generateArticleCaption(article: {
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  category_title: string | null
  exam_body: string[] | null
}, includeLink: boolean): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const examBody = (article.exam_body?.[0] ?? 'ACCA').toUpperCase()
  const category = article.category ?? 'financial-accounting'
  const articleUrl = `https://accountingbody.com/study/${category}/${article.slug}`
  const hashtags = buildHashtags(examBody, article.category_title ?? article.category ?? '')

  const prompt = `You are a social media writer for a professional accounting and finance platform.
Write a Facebook post for the article below.

STYLE RULES — follow these exactly:
— No emoji anywhere in the post
— No bullet points or lists
— No bold or formatting marks
— Write in clean, natural prose — the kind a senior accountant or finance editor would write
— Do not sound like AI generated content
— Do not use phrases like "dive in", "delve into", "unlock", "game-changer", "crucial", "key takeaways"
— Do not start with "In this article" or "This article"
— Write as if a knowledgeable colleague is recommending an article to a peer
— Maximum 3 short paragraphs

STRUCTURE:
${includeLink ? `Paragraph 1 (2-3 sentences): Open with a specific, thought-provoking observation or question
directly related to this article's topic. Make the reader feel this is relevant to their
professional life right now. Be specific — not generic accounting commentary.

Paragraph 2 (2-3 sentences): Describe what the article covers in plain, confident language.
What will the reader understand after reading it that they may not have before?
Do not list bullet points — write it as natural prose.

Then on its own line, just the URL — no "Read more" or "Read the full article" prefix:
${articleUrl}

Then on its own line, the hashtags:
${hashtags}` : `Paragraph 1 (2-3 sentences): Open with a specific, thought-provoking observation or question
directly related to this article's topic. Make the reader feel this is relevant to their
professional life right now. Be specific — not generic accounting commentary.

Paragraph 2 (2-3 sentences): Develop the insight further — share a second
observation, a professional implication, or a nuance that makes a practitioner
stop and think. Write as a self-contained post. Do not reference an article,
link, or external resource. Do not use phrases like "read more", "find out",
"learn how", or "click". The post must stand completely alone.

Then on its own line, the hashtags:
${hashtags}`}

ARTICLE:
Title: ${article.title}
Category: ${article.category_title ?? article.category ?? 'Accounting'}
Exam Body: ${examBody}
Summary: ${article.excerpt ?? article.title}

Return ONLY the post text. No preamble, no explanation, no quotes around the output.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text.trim()
}

async function generatePqCaption(qs: {
  title: string
  slug: string
  excerpt: string | null
  topic: string | null
  exam_body: string[] | null
  difficulty: string | null
}, includeLink: boolean): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const examBody = (qs.exam_body?.[0] ?? 'ACCA').toUpperCase()
  const pqUrl = `https://accountingbody.com/practice-questions/${qs.slug}`
  const hashtags = buildHashtags(examBody, qs.topic ?? '', true)

  const prompt = `You are a social media writer for a professional accounting and finance platform.
Write a Facebook post promoting a practice question set for the article below.

STYLE RULES — follow these exactly:
— No emoji anywhere in the post
— No bullet points or lists
— No bold or formatting marks
— Do not mention how many questions are in the set
— Write in clean, natural prose — the kind a senior accountant or finance editor would write
— Do not sound like AI generated content
— Do not use phrases like "dive in", "delve into", "unlock", "game-changer", "crucial"
— Write as if a knowledgeable colleague is recommending a revision resource to a peer
— Maximum 2 short paragraphs

STRUCTURE:
${includeLink ? `Paragraph 1 (2 sentences): Open with a direct, specific challenge or question that tests
whether the reader actually understands this topic at exam level. Be specific to the topic —
not generic exam advice.

Paragraph 2 (2 sentences): Describe what the practice questions test, in plain confident
language. Mention the exam body and level naturally. Do not mention question count.

Then on its own line, just the URL — no prefix:
${pqUrl}

Then on its own line, the hashtags:
${hashtags}` : `Paragraph 1 (2 sentences): Open with a direct, specific challenge or question that tests
whether the reader actually understands this topic at exam level. Be specific to the topic —
not generic exam advice.

Paragraph 2 (2 sentences): Follow with a second exam-relevant observation or
a common mistake candidates make on this topic. Write as a self-contained post.
Do not reference a link, quiz, question set, or external resource. Do not use
phrases like "test yourself", "try our", "find out", or "click". The post must
stand completely alone.

Then on its own line, the hashtags:
${hashtags}`}

QUESTION SET:
Title: ${qs.title}
Topic: ${qs.topic ?? 'Accounting'}
Exam Body: ${examBody}
Difficulty: ${qs.difficulty ?? 'intermediate'}
Summary: ${qs.excerpt ?? qs.title}

Return ONLY the post text. No preamble, no explanation, no quotes around the output.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  return content.text.trim()
}

function buildHashtags(examBody: string, topic: string, isPq = false): string {
  const tags = new Set(['#Accounting', `#${examBody}`, '#AccountingBody'])
  if (isPq) tags.add('#PracticeQuestions')
  const topicLower = topic.toLowerCase()
  if (topicLower.includes('tax')) tags.add('#Taxation')
  if (topicLower.includes('audit')) tags.add('#Audit')
  if (topicLower.includes('financial') && topicLower.includes('report')) tags.add('#FinancialReporting')
  if (topicLower.includes('management')) tags.add('#ManagementAccounting')
  if (topicLower.includes('finance') || topicLower.includes('financial management')) tags.add('#FinancialManagement')
  if (topicLower.includes('currency') || topicLower.includes('forex') || topicLower.includes('exchange')) tags.add('#ForeignExchange')
  if (topicLower.includes('ias') || topicLower.includes('ifrs')) tags.add('#IFRS')
  if (examBody === 'ACCA') tags.add('#ACCA')
  if (examBody === 'CIMA') tags.add('#CIMA')
  if (examBody === 'ICAEW') tags.add('#ICAEW')
  if (examBody === 'AAT') tags.add('#AAT')
  if (examBody === 'ETICPA') tags.add('#ETICPA')
  // Keep to 5 hashtags max
  return Array.from(tags).slice(0, 5).join(' ')
}

// ── Facebook poster ───────────────────────────────────────

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
  if (!res.ok || data.error) throw new Error(data.error?.message ?? 'Facebook API error')
  return { id: data.id! }
}

// ── Route handler ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      action: 'resolve' | 'generate' | 'post'
      contentId?: string
      caption?: string
      includeLink?: boolean
    }

    // Resolve content ID to type + metadata
    if (body.action === 'resolve') {
      const id = (body.contentId ?? '').trim().toUpperCase()
      if (id.startsWith('AB-ART-')) {
        const article = await fetchArticleById(id)
        return NextResponse.json({ type: 'article', content: article })
      }
      if (id.startsWith('AB-QZ-')) {
        const qs = await fetchQuestionSetById(id)
        return NextResponse.json({ type: 'pq', content: qs })
      }
      return NextResponse.json({ error: 'Invalid ID — must start with AB-ART- or AB-QZ-' }, { status: 400 })
    }

    // Generate caption
    if (body.action === 'generate') {
      const id = (body.contentId ?? '').trim().toUpperCase()
      const includeLink = body.includeLink ?? true
      let caption: string
      let title: string
      if (id.startsWith('AB-ART-')) {
        const article = await fetchArticleById(id)
        caption = await generateArticleCaption(article, includeLink)
        title = article.title
      } else if (id.startsWith('AB-QZ-')) {
        const qs = await fetchQuestionSetById(id)
        caption = await generatePqCaption(qs, includeLink)
        title = qs.title
      } else {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
      }
      return NextResponse.json({ caption, title, includeLink })
    }

    // Post to Facebook
    if (body.action === 'post') {
      if (!body.caption?.trim()) {
        return NextResponse.json({ error: 'Caption required' }, { status: 400 })
      }
      const result = await postToFacebook(body.caption)

      try {
        const supabase = getSupabase()
        await supabase.from('social_posts').insert({
          platform: 'facebook',
          caption: body.caption,
          post_id: result.id,
          posted_at: new Date().toISOString(),
          platform_ab: 'ab',
          link_included: body.includeLink ?? true,
        })
      } catch {
        // best-effort
      }

      return NextResponse.json({ success: true, postId: result.id })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
