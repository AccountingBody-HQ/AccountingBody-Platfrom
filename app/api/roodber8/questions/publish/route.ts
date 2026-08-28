/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SITE_CODE_MAP } from '@/lib/site-codes'

export const runtime = 'nodejs'
export const maxDuration = 60

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 200)
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const {
      bundle,
      qualification,
      examBody,
      showOnSites = ['accountingbody'],
      canonicalOwner = 'accountingbody',
    } = body

    if (!bundle || !bundle.questions?.length) {
      return NextResponse.json({ error: 'bundle with questions is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase environment variables are not set' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const title = bundle.title ?? 'Practice Question Set'
    const slug  = generateSlug(title)
    const now   = new Date().toISOString()

    // Map examBody string to array for the question_sets schema
    const examBodyArr: string[] = []
    if (examBody && examBody !== 'none') examBodyArr.push(examBody.toLowerCase())
    if (qualification && qualification !== 'none') {
      const q = qualification.toLowerCase()
      if (!examBodyArr.includes(q)) examBodyArr.push(q)
    }

    const showOnSitesCodes = (showOnSites as string[]).map(s => SITE_CODE_MAP[s] ?? s)
    const platform = SITE_CODE_MAP[canonicalOwner] ?? canonicalOwner

    // Content ID — query highest existing AB-QZ-XXXXX and increment
    const { data: lastRow } = await supabase
      .from('question_sets')
      .select('content_id')
      .like('content_id', 'AB-QZ-%')
      .order('content_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextNum = 1
    if (lastRow?.content_id) {
      const match = (lastRow.content_id as string).match(/AB-QZ-(\d+)$/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    const contentId = 'AB-QZ-' + String(nextNum).padStart(5, '0')

    const setRow: any = {
      title,
      slug,
      excerpt:          bundle.excerpt ?? '',
      difficulty:       bundle.difficulty ?? 'intermediate',
      topic:            bundle.topic ?? '',
      exam_body:        examBodyArr,
      question_type:    bundle.questionType ?? 'multiple-choice',
      show_on_sites:    showOnSitesCodes,
      canonical_owner:  canonicalOwner,
      seo_title:        title.length <= 60 ? title : title.slice(0, 60).replace(/\s+\S*$/, '...'),
      seo_description:  (bundle.excerpt ?? '').length <= 160 ? (bundle.excerpt ?? '') : (bundle.excerpt ?? '').slice(0, 160).replace(/\s+\S*$/, '...'),
      status:           'published',
      platform,
      content_id:       contentId,
      published_at:     now,
    }

    const { data: insertedSet, error: setError } = await supabase
      .from('question_sets')
      .insert(setRow)
      .select('id')
      .single()

    if (setError || !insertedSet) {
      console.error('questions/publish set insert error:', setError)
      return NextResponse.json({ error: setError?.message ?? 'Failed to insert question set' }, { status: 500 })
    }

    const setId = insertedSet.id

    // Map bundle questions to Supabase `questions` rows (options are 4 discrete columns, not an array)
    const questionRows = bundle.questions.map((q: any, i: number) => {
      const opts = Array.isArray(q.options) ? q.options : []
      return {
        set_id:               setId,
        question_order:       i + 1,
        type:                 q.type ?? 'multiple-choice',
        question_text:        q.questionText ?? '',
        option_a:             opts[0] != null ? String(opts[0]) : '',
        option_b:             opts[1] != null ? String(opts[1]) : '',
        option_c:             opts[2] != null ? String(opts[2]) : '',
        option_d:             opts[3] != null ? String(opts[3]) : '',
        correct_index:        typeof q.correctIndex === 'number' ? q.correctIndex : null,
        explanation:          q.explanation ?? null,
        writing_model_answer: q.writingModelAnswer ?? null,
        writing_explanation:  q.writingExplanation ?? null,
        case_id:              q.caseId ?? null,
        primary_topic:        q.primaryTopic ?? '',
        difficulty:           q.difficulty ?? 'intermediate',
        time_target_minutes:  q.timeTargetMinutes ?? (q.type === 'writing' ? 20 : 2),
        points:               q.points ?? 1,
      }
    })

    const { error: qError } = await supabase.from('questions').insert(questionRows)

    if (qError) {
      console.error('questions/publish questions insert error:', qError)
      // Roll back the orphaned question set since its questions failed to insert
      await supabase.from('question_sets').delete().eq('id', setId)
      return NextResponse.json({ error: qError.message }, { status: 500 })
    }

    // Insert case exhibits if present (scenario question sets)
    const cases = bundle.cases ?? []
    if (cases.length > 0) {
      const caseRows = cases
        .filter((c: any) => c.caseId && c.exhibitHtml)
        .map((c: any) => ({
          set_id:       setId,
          case_id:      c.caseId,
          title:        c.title ?? '',
          exhibit_html: c.exhibitHtml,
        }))
      if (caseRows.length > 0) {
        const { error: caseError } = await supabase
          .from('question_cases')
          .insert(caseRows)
        if (caseError) {
          console.error('questions/publish cases insert error:', caseError)
          // Non-fatal — questions are published, cases failed. Log and continue.
        }
      }
    }

    return NextResponse.json({
      success:       true,
      documentId:    setId,
      contentId,
      title,
      slug,
      questionCount: questionRows.length,
    })

  } catch (err: any) {
    console.error('questions/publish error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
