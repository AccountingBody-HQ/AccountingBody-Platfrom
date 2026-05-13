/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'

export const runtime = 'nodejs'
export const maxDuration = 60

function makeKey() {
  return Math.random().toString(36).slice(2, 12)
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 200)
}

export async function POST(req: NextRequest) {
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

    const token     = (process.env.SANITY_API_TOKEN ?? '').trim()
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'

    if (!token) {
      return NextResponse.json({ error: 'SANITY_API_TOKEN is not set' }, { status: 500 })
    }

    const client = createClient({
      projectId,
      dataset,
      apiVersion: '2021-06-07',
      token,
      useCdn: false,
    })

    const title = bundle.title ?? 'Practice Question Set'
    const slug  = generateSlug(title)
    const now   = new Date().toISOString()

    // Map examBody string to array for the practicePost schema
    const examBodyArr: string[] = []
    if (examBody && examBody !== 'none') examBodyArr.push(examBody.toLowerCase())
    if (qualification && qualification !== 'none') {
      const q = qualification.toLowerCase()
      if (!examBodyArr.includes(q)) examBodyArr.push(q)
    }

    // Map bundle questions to Sanity quizQuestion objects
    const quizQuestions = bundle.questions.map((q: any, i: number) => ({
      _type:              'quizQuestion',
      _key:               makeKey(),
      id:                 q.id ?? `q${i + 1}`,
      type:               q.type ?? 'multiple-choice',
      questionText:       q.questionText ?? '',
      options:            Array.isArray(q.options) ? q.options : [],
      correctIndex:       typeof q.correctIndex === 'number' ? q.correctIndex : null,
      explanation:        q.explanation ?? null,
      writingModelAnswer: q.writingModelAnswer ?? null,
      writingExplanation: q.writingExplanation ?? null,
      caseId:             q.caseId ?? null,
      primaryTopic:       q.primaryTopic ?? '',
      difficulty:         q.difficulty ?? 'intermediate',
      timeTargetMinutes:  q.timeTargetMinutes ?? (q.type === 'writing' ? 20 : 2),
      points:             q.points ?? 1,
    }))

    // Map scenario cases to Sanity scenarioCase objects
    const cases = Array.isArray(bundle.cases)
      ? bundle.cases.map((c: any) => ({
          _type:       'scenarioCase',
          _key:        makeKey(),
          caseId:      c.caseId ?? makeKey(),
          title:       c.title ?? 'Case',
          exhibitHtml: c.exhibitHtml ?? '',
        }))
      : []

    const doc: any = {
      _type:         'practicePost',
      title,
      slug:          { _type: 'slug', current: slug },
      excerpt:       bundle.excerpt ?? '',
      publishedAt:   now,
      difficulty:    bundle.difficulty ?? 'intermediate',
      topic:         bundle.topic ?? '',
      examBody:      examBodyArr[0] ?? '',
      questionType:  bundle.questionType ?? 'multiple-choice',
      tags:          Array.isArray(bundle.tags) ? bundle.tags : [],
      cases,
      quizQuestions,
      showOnSites,
      canonicalOwner,
    }

    const result = await client.create(doc)

    return NextResponse.json({
      success:    true,
      documentId: result._id,
      title,
      slug,
      questionCount: quizQuestions.length,
    })

  } catch (err: any) {
    console.error('questions/publish error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
