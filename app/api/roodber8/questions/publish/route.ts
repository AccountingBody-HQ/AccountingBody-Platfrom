/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { SITE_CODE_MAP } from '@/lib/site-codes'
import { checkRead } from '@/lib/db-check'
import {
  ALREADY_HAS_SET_PLAIN,
  ARTICLE_RULE,
  CASES_SAVE_FAILED,
  CONTENT_ID_FAILED,
  CONTENT_ID_RULE,
  CORRECT_INDEX_RULE,
  EMPTY_ADDRESS,
  LEFT_DRAFT,
  LINK_FAILED,
  NOT_FOUND,
  PUBLISH_FAILED,
  SET_READ_FAILED,
  SLUG_READ_FAILED,
  SLUG_RULE,
  alreadyHasSetMessage,
  checkPublishBundle,
  fixThisQuestionMessage,
  publishProblemsMessage,
  slugTakenMessage,
  violatedRule,
} from '@/lib/question-publish-checks'
import { linkedSetSlug, setArticleLink } from '@/lib/question-article-link'
import { refreshQuestionCaches } from '@/lib/question-cache'
import { reportServerError } from '@/lib/report-error'
import { REGISTRY_INVALID, eticpaColumnsOf, parseRegistry } from '@/lib/question-registry'

export const runtime = 'nodejs'
export const maxDuration = 60

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 200).replace(/^-+|-+$/g, '')
}

function contentIdOf(num: number): string {
  return 'AB-QZ-' + String(num).padStart(5, '0')
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }
  try {
    const body = await req.json()
    const {
      bundle,
      qualification,
      examBody,
      showOnSites = ['accountingbody', 'ethiotax'],
      canonicalOwner = 'accountingbody',
      articleSlug,
      registry,
    } = body

    if (!bundle || !Array.isArray(bundle.questions) || bundle.questions.length === 0) {
      return NextResponse.json({ error: 'bundle with questions is required' }, { status: 400 })
    }

    // Structure first: nothing is read or written for an incomplete bundle.
    const checked = checkPublishBundle(bundle)
    if (!checked.ok) {
      return NextResponse.json({ error: publishProblemsMessage(checked.problems) }, { status: 400 })
    }

    // The quality record from the Content Studio (prompt, model, score), when sent.
    const record = parseRegistry(registry)
    if (!record.ok) {
      return NextResponse.json({ error: REGISTRY_INVALID }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase environment variables are not set' }, { status: 500 })
    }

    const supabase = getServerSupabase('admin')

    const title = bundle.title ?? 'Practice Question Set'
    const slug  = generateSlug(title)
    const now   = new Date().toISOString()

    // A title in another alphabet can leave nothing, or only dashes. No
    // address is invented for it.
    if (!/[a-z0-9]/.test(slug)) {
      return NextResponse.json({ error: EMPTY_ADDRESS }, { status: 400 })
    }

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
    const lastRead = checkRead(
      await supabase
        .from('question_sets')
        .select('content_id')
        .like('content_id', 'AB-QZ-%')
        .order('content_id', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'questions/publish: last content_id',
    )
    if (!lastRead.ok) {
      return NextResponse.json({ error: CONTENT_ID_FAILED }, { status: 500 })
    }
    const lastRow = lastRead.data
    let nextNum = 1
    if (lastRow?.content_id) {
      const match = (lastRow.content_id as string).match(/AB-QZ-(\d+)$/)
      if (match) nextNum = parseInt(match[1], 10) + 1
    }
    let contentId = contentIdOf(nextNum)

    // Resolve articleSlug: an AB-ART-XXXXX content_id, or the slug of a
    // published article. An article that was named must exist, and must not
    // have a practice set yet (any status).
    let resolvedArticleSlug: string | null = null
    let articleLink: string | null = null
    let eticpaColumns: ReturnType<typeof eticpaColumnsOf> = {}
    const articleRef = articleSlug ? String(articleSlug).trim() : ''
    if (articleRef) {
      const contentRef = articleRef.toUpperCase()
      const articles = supabase.from('articles').select('slug, mcq_url, eticpa_level, eticpa_module')
      const artRead = checkRead(
        await (contentRef.startsWith('AB-ART-')
          ? articles.eq('content_id', contentRef)
          : articles.eq('slug', articleRef).eq('status', 'published')
        ).maybeSingle(),
        'questions/publish: linked article',
      )
      if (!artRead.ok) {
        return NextResponse.json({ error: 'Could not read the linked article. Nothing was published.' }, { status: 500 })
      }
      resolvedArticleSlug = (artRead.data?.slug as string | null | undefined) || null
      if (!resolvedArticleSlug) {
        return NextResponse.json({ error: NOT_FOUND }, { status: 400 })
      }
      // An ETICPA study note gives its level and module to its set (D369).
      eticpaColumns = eticpaColumnsOf(artRead.data ?? {})

      const linkedSetRead = checkRead(
        await supabase
          .from('question_sets')
          .select('title')
          .eq('article_slug', resolvedArticleSlug)
          .limit(1)
          .maybeSingle(),
        'questions/publish: existing set',
      )
      if (!linkedSetRead.ok) {
        return NextResponse.json({ error: SET_READ_FAILED }, { status: 500 })
      }
      if (linkedSetRead.data) {
        return NextResponse.json({ error: alreadyHasSetMessage(linkedSetRead.data.title) }, { status: 409 })
      }

      // Nor may its link point to a set, whichever article that set names. A
      // link to a set that does not exist is broken, and is replaced.
      articleLink = (artRead.data?.mcq_url as string | null | undefined) ?? null
      const otherSlug = linkedSetSlug(articleLink)
      if (otherSlug) {
        const otherSetRead = checkRead(
          await supabase
            .from('question_sets')
            .select('title')
            .eq('slug', otherSlug)
            .limit(1)
            .maybeSingle(),
          'questions/publish: set the article points to',
        )
        if (!otherSetRead.ok) {
          return NextResponse.json({ error: SET_READ_FAILED }, { status: 500 })
        }
        if (otherSetRead.data) {
          return NextResponse.json({ error: alreadyHasSetMessage(otherSetRead.data.title) }, { status: 409 })
        }
      }
    }

    // The web address must be free (any status). No suffix is invented: the
    // title decides the address.
    const slugRead = checkRead(
      await supabase
        .from('question_sets')
        .select('slug')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle(),
      'questions/publish: web address',
    )
    if (!slugRead.ok) {
      return NextResponse.json({ error: SLUG_READ_FAILED }, { status: 500 })
    }
    if (slugRead.data) {
      return NextResponse.json({ error: slugTakenMessage(slug) }, { status: 409 })
    }

    // The set is saved as a draft, which visitors never see, and is published
    // only when its parts are saved. published_at is set at that moment.
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
      status:           'draft',
      platform,
      article_slug:     resolvedArticleSlug,
      ...eticpaColumns,
      ...(record.columns ?? {}),
    }

    const insertSet = () =>
      supabase
        .from('question_sets')
        .insert({ ...setRow, content_id: contentId })
        .select('id')
        .single()

    let saved = await insertSet()
    // The number was taken meanwhile: the next one, once. A refused insert
    // wrote nothing.
    if (violatedRule(saved.error) === CONTENT_ID_RULE) {
      contentId = contentIdOf(nextNum + 1)
      saved = await insertSet()
    }
    const { data: insertedSet, error: setError } = saved

    if (setError || !insertedSet) {
      console.error('questions/publish set insert error:', setError)
      // Taken in the moment between the checks above and the insert.
      const rule = violatedRule(setError)
      if (rule === SLUG_RULE) return NextResponse.json({ error: slugTakenMessage(slug) }, { status: 409 })
      if (rule === ARTICLE_RULE) return NextResponse.json({ error: ALREADY_HAS_SET_PLAIN }, { status: 409 })
      if (rule === CONTENT_ID_RULE) return NextResponse.json({ error: CONTENT_ID_FAILED }, { status: 500 })
      return NextResponse.json({ error: setError?.message ?? 'Failed to insert question set' }, { status: 500 })
    }

    const setId = insertedSet.id

    // Removes the draft after a step before publishing failed. Its questions
    // and cases go with it, as when the set editor deletes a set.
    const undoDraft = async (message: string, status = 500) => {
      const { error: undoError } = await supabase.from('question_sets').delete().eq('id', setId)
      if (undoError) console.error('questions/publish rollback delete failed', undoError.code ?? 'unknown')
      return NextResponse.json({ error: undoError ? LEFT_DRAFT : message }, { status: undoError ? 500 : status })
    }

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
      if (violatedRule(qError) === CORRECT_INDEX_RULE) return undoDraft(fixThisQuestionMessage(['correct-answer']), 400)
      return undoDraft(qError.message)
    }

    // Insert case exhibits if present (scenario question sets). A set never
    // goes live without them.
    const cases: any[] = Array.isArray(bundle.cases) ? bundle.cases : []
    if (cases.length > 0) {
      const caseRows = cases
        .filter((c: any) => c?.caseId && c.exhibitHtml)
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
          return undoDraft(CASES_SAVE_FAILED)
        }
      }
    }

    // Everything is saved: publish. Exactly one set must change.
    const { data: publishedRows, error: publishError } = await supabase
      .from('question_sets')
      .update({ status: 'published', published_at: now })
      .eq('id', setId)
      .select('id')
    if (publishError || publishedRows?.length !== 1) {
      console.error('questions/publish status update failed', publishError?.code ?? 'no_row')
      return undoDraft(PUBLISH_FAILED)
    }

    // Close the bidirectional link: update articles.mcq_url so the
    // article page's "Practice this topic" CTA points to this PQ set.
    // Only while its link is still the one that was read above. Exactly one
    // article must change; anything else is told to the admin as a warning
    // next to the success, never as an error.
    let linkWarning: string | undefined
    if (resolvedArticleSlug && !(await setArticleLink(supabase, resolvedArticleSlug, articleLink, slug))) {
      linkWarning = LINK_FAILED
    }

    refreshQuestionCaches({
      slugs: [slug],
      setIds: [setId],
      articleSlugs: linkWarning ? [] : [resolvedArticleSlug],
    })

    return NextResponse.json({
      success:       true,
      documentId:    setId,
      contentId,
      title,
      slug,
      questionCount: questionRows.length,
      ...(linkWarning ? { linkWarning } : {}),
    })

  } catch (err: any) {
    console.error('questions/publish error:', err)
    reportServerError('admin question set publish failed', err, { area: 'admin' })
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
