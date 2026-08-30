'use client'

import { useEffect, useState } from 'react'
import {
  Sparkles, Share2, Copy, Check, RefreshCw, Loader2, X, Plus,
  FileText, HelpCircle, BookOpen, ExternalLink,
} from 'lucide-react'

const C = {
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input:   { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
  active:  { background: 'rgba(212,160,23,0.12)', border: '1px solid #D4A017', color: '#fff' },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' },
  warning: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' },
  danger:  { background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.25)',  color: '#ef4444' },
} as const

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)', color: '#10b981', border: 'rgba(16,185,129,0.2)' },
  intermediate: { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  advanced:     { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444', border: 'rgba(239,68,68,0.2)'  },
}

const CATEGORY_DOT: Record<string, string> = {
  news: '#3b82f6',
  professional: '#10b981',
  academic: '#8b5cf6',
}

// ── Types ─────────────────────────────────────────────────────────────────

interface DailyArticle {
  id: string
  title: string
  slug: string
  content_id: string | null
  category: string | null
  category_title: string | null
  exam_body: string[] | null
  difficulty: string | null
  read_time: number | null
  excerpt: string | null
  content_preview: string
}

interface PqTask {
  article_id: string
  article_title: string
  article_slug: string
  prompt_built: boolean
  prompt_copied: boolean
  json_imported: boolean
  published_at: string | null
}

interface ArticleTaskState {
  input_type: 'url' | 'topic' | 'idea' | null
  input_value: string
  prompt_built: boolean
  prompt_copied: boolean
  json_imported: boolean
  published_at: string | null
}

interface SocialTaskState {
  facebook_published: boolean
  linkedin_published: boolean
  published_at: string | null
}

interface StudioSession {
  id: string
  session_date: string
  pq_tasks: PqTask[]
  article_task: ArticleTaskState
  social_task: SocialTaskState
}

interface ReferenceSource {
  id: string
  label: string
  url: string
  category: string
  display_order: number
}

const DEFAULT_ARTICLE_TASK: ArticleTaskState = {
  input_type: null,
  input_value: '',
  prompt_built: false,
  prompt_copied: false,
  json_imported: false,
  published_at: null,
}

const DEFAULT_SOCIAL_TASK: SocialTaskState = {
  facebook_published: false,
  linkedin_published: false,
  published_at: null,
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stripHtmlAndTruncate(html: string, maxLen = 4000): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…'
}

function buildPqPrompt(article: DailyArticle, fullContent: string): string {
  const examBodyUpper = (article.exam_body?.[0] || '').toUpperCase()
  const examBodyLower = examBodyUpper.toLowerCase()
  const categoryLower = (article.category || article.category_title || '').toLowerCase()
  const cleanContent = stripHtmlAndTruncate(fullContent, 4000)
  const slug = article.slug

  return `You are an expert accounting and finance examination question writer
with deep knowledge of professional qualifications including
${examBodyUpper} (and ACCA, CIMA, ICAEW, AAT where relevant).

Your task is to generate exactly 25 high-quality, exam-standard
multiple-choice questions (MCQs) based on the following article.

ARTICLE DETAILS:
Title: ${article.title}
Category: ${article.category_title}
Exam Body: ${examBodyUpper}
Difficulty: ${article.difficulty}
Topic: ${article.excerpt}

ARTICLE CONTENT:
${cleanContent}

QUALITY REQUIREMENTS:
Each question must be:
- Exam-standard — matching the rigour of ${examBodyUpper} professional examinations
- Technically accurate — no errors in accounting, finance, or business concepts
- Challenging — testing genuine understanding, not surface recall
- Unambiguous — one clearly correct answer, three clearly wrong distractors
- Educational — the explanation must teach, not just confirm
- Original — do not lift sentences directly from the article

QUESTION STRUCTURE:
Each of the 25 questions must include ALL of the following fields:

questionText: The question stem. Clear, professional, concise.
  May include a scenario, calculation, or conceptual challenge.

options: Array of exactly 4 strings [A, B, C, D].
  Each option must be plausible. Wrong options should represent
  common misconceptions or calculation errors, not obvious nonsense.

correctIndex: 0-based integer (0=A, 1=B, 2=C, 3=D)

explanation: A detailed explanation (minimum 80 words) covering:
  - Why the correct answer is correct (with working/reasoning)
  - Why each wrong option is wrong (briefly but clearly)
  - The underlying concept being tested
  - A learning takeaway the student should remember

primaryTopic: The specific sub-topic within the article this
  question tests (2-6 words)

difficulty: One of: beginner | intermediate | advanced
  Aim for roughly: 5 beginner, 15 intermediate, 5 advanced

type: "multiple-choice"

QUESTION DISTRIBUTION:
- Cover the full breadth of the article — do not cluster all
  questions on one section
- Include calculation-based questions where the article
  contains numerical concepts
- Include scenario-based questions that apply concepts to
  realistic business situations
- Include conceptual questions that test understanding of
  principles, not just definitions

OUTPUT FORMAT:
Return ONLY valid JSON. No preamble, no explanation, no markdown
code fences. Return a single JSON object with this exact structure:

{
  "title": "${article.title} — Practice Questions",
  "slug": "${slug}-practice-questions",
  "excerpt": "25 exam-standard practice questions covering ${article.category_title} concepts from the article: ${article.title}. Tests understanding across beginner, intermediate and advanced levels.",
  "difficulty": "${article.difficulty}",
  "topic": "${article.category_title}",
  "questionType": "multiple-choice",
  "tags": ["${examBodyLower}", "${categoryLower}"],
  "cases": [],
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "questionText": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "...",
      "writingModelAnswer": null,
      "writingExplanation": null,
      "caseId": null,
      "primaryTopic": "...",
      "difficulty": "intermediate",
      "timeTargetMinutes": 2,
      "points": 2
    }
  ]
}

The JSON must be valid and importable directly into the platform.
The "questions" array must contain exactly 25 items.
Question ids must be sequential: "q1" through "q25".

AFTER IMPORTING:
When you import this JSON via the Questions Import page, enter
the Article ID ${article.content_id} in the "Linked Article ID"
field to automatically link the questions to this article.`
}

function buildArticlePrompt(mode: 'url' | 'topic' | 'idea', value: string): string {
  let inputContext: string
  if (mode === 'url') {
    inputContext = `REFERENCE SOURCE:\nURL: ${value}\n\nUsing this URL as\nthematic inspiration (do not reproduce its content), write an\noriginal educational article on the topic it covers.`
  } else if (mode === 'topic') {
    inputContext = `TOPIC:\n${value}\n\nWrite a comprehensive educational\narticle on this topic.`
  } else {
    inputContext = `ARTICLE IDEA:\n${value}\n\nWrite a comprehensive\neducational article based on this idea.`
  }

  return `You are an expert financial and accounting writer producing
professional educational content for accountingbody.com — a platform
serving accounting and finance professionals, students, and serious
learners at all levels.

${inputContext}

YOUR TASK:
Write a comprehensive, professionally crafted educational article
suitable for publication on a leading accounting and finance platform.

CONTENT REQUIREMENTS:
- Original — not a reproduction or paraphrase of any source
- Factually accurate — all accounting, finance, and business
  concepts must be technically correct
- Professionally written — clear, authoritative, engaging prose
- Beginner-accessible — sophisticated concepts explained so a
  first-year accounting student can understand them
- Professionally valuable — a qualified accountant or finance
  director should still find it insightful and worth reading
- Analytically deep — go beyond surface description; analyse,
  explain causation, discuss implications
- Structured logically — use clear headings and subheadings
- SEO-conscious — naturally incorporate relevant search terms
- Practically relevant — include real-world applications,
  examples, and implications

ARTICLE STRUCTURE:
The article must follow this structure:
1. Introduction (hook + why this matters)
2. Core concept explained (clear, thorough, beginner-friendly)
3. Key principles or components (with subheadings)
4. Real-world application or example
5. Common misconceptions or pitfalls
6. Implications for accounting/finance professionals
7. Key takeaways (3-5 bullet points)
8. Conclusion

TARGET LENGTH: 1,200-1,800 words

QUALITY BENCHMARK:
The article should sit at the intersection of:
Professional depth + Academic rigour + Beginner accessibility.

A final-year accounting student, a practising accountant, and
a business professional should all find genuine value in it.

OUTPUT FORMAT:
Return ONLY valid JSON. No preamble, no markdown, no explanation.
Return a single JSON object with this exact structure:

{
  "title": "Article title here",
  "slug": "url-friendly-slug-here",
  "excerpt": "One or two sentence summary (max 160 chars) describing
    what the article covers and why it matters.",
  "content": "<h2>Introduction</h2><p>...</p><h2>...</h2><p>...</p>",
  "category": "financial-accounting",
  "category_title": "Financial Accounting",
  "exam_body": ["acca"],
  "difficulty": "intermediate",
  "read_time": 8,
  "author_name": "Accounting Body Editorial Team",
  "seo_title": "SEO-optimised title (max 60 chars)",
  "seo_description": "SEO meta description (max 160 chars)",
  "status": "published",
  "show_on_sites": ["ab", "et"],
  "tags": ["relevant", "tags", "here"]
}

Content field must be valid HTML using only: h2, h3, p, ul, ol,
li, strong, em, blockquote. No divs, no classes, no inline styles.`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function mergePqTasks(articles: DailyArticle[], existing: PqTask[]): PqTask[] {
  return articles.map(a => {
    const found = existing.find(t => t.article_id === a.content_id)
    if (found) return found
    return {
      article_id: a.content_id ?? a.slug,
      article_title: a.title,
      article_slug: a.slug,
      prompt_built: false,
      prompt_copied: false,
      json_imported: false,
      published_at: null,
    }
  })
}

// ── Article PQ Card ──────────────────────────────────────────────────────

function ArticlePQCard({
  article, task, promptText, building,
  onBuildPrompt, onCopy, onMarkImported,
}: {
  article: DailyArticle
  task: PqTask
  promptText: string | undefined
  building: boolean
  onBuildPrompt: () => void
  onCopy: () => void
  onMarkImported: () => void
}) {
  const [copiedFlash, setCopiedFlash] = useState(false)
  const diff = article.difficulty ? DIFF_STYLE[article.difficulty] ?? DIFF_STYLE.intermediate : null
  const examBody = article.exam_body?.[0] ?? ''

  async function handleCopy() {
    if (!promptText) return
    const ok = await copyToClipboard(promptText)
    if (ok) {
      setCopiedFlash(true)
      onCopy()
      setTimeout(() => setCopiedFlash(false), 2000)
    }
  }

  return (
    <div className="rounded-2xl border p-5" style={C.card}>
      <p className="text-white font-bold text-sm mb-2">{article.title}</p>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {article.content_id && (
          <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1f2937', color: '#475569', fontFamily: 'monospace', fontSize: '10px', padding: '2px 6px', borderRadius: 6 }}>
            {article.content_id}
          </span>
        )}
        {(article.category_title || article.category) && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
            {article.category_title || article.category}
          </span>
        )}
        {examBody && (
          <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
            {examBody}
          </span>
        )}
        {diff && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
            style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
            {article.difficulty}
          </span>
        )}
        {article.read_time != null && (
          <span className="text-xs" style={{ color: '#475569' }}>{article.read_time} min read</span>
        )}
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-xs font-semibold flex items-center gap-1"
          style={{ color: task.prompt_built ? '#10b981' : '#334155' }}>
          <Check size={12} /> Prompt Built
        </span>
        <span className="text-xs font-semibold flex items-center gap-1"
          style={{ color: task.prompt_copied ? '#10b981' : '#334155' }}>
          <Check size={12} /> Prompt Copied
        </span>
        <span className="text-xs font-semibold flex items-center gap-1"
          style={{ color: task.json_imported ? '#10b981' : '#334155' }}>
          <Check size={12} /> Imported
        </span>
      </div>

      {!promptText && (
        <button onClick={onBuildPrompt} disabled={building}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
          style={{ background: '#D4A017', color: '#0C1A3D', opacity: building ? 0.6 : 1 }}>
          {building ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {building ? 'Building…' : 'Build Prompt'}
        </button>
      )}

      {promptText && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <button onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
              style={copiedFlash ? C.success : { background: '#D4A017', color: '#0C1A3D' }}>
              {copiedFlash ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Prompt</>}
            </button>
            {task.prompt_copied && !task.json_imported && (
              <button onClick={onMarkImported}
                className="text-xs font-bold px-4 py-2 rounded-xl"
                style={C.success}>
                Mark as Imported
              </button>
            )}
            {task.json_imported && (
              <span className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>Imported ✓</span>
            )}
          </div>
          <textarea readOnly value={promptText}
            className="w-full text-xs font-mono rounded-xl p-3 mb-2"
            style={{ ...C.input, height: 180, resize: 'vertical' }} />
          <a href="/roodber8/questions/import" target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold flex items-center gap-1 w-fit" style={{ color: '#2563eb' }}>
            → Import Questions <ExternalLink size={10} />
          </a>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function StudioPage() {
  const [sessionLoading, setSessionLoading] = useState(true)
  const [articlesLoading, setArticlesLoading] = useState(true)

  const [dailyArticles, setDailyArticles] = useState<DailyArticle[]>([])
  const [pqTasks, setPqTasks] = useState<PqTask[]>([])
  const [pqPromptText, setPqPromptText] = useState<Record<string, string>>({})
  const [pqBuilding, setPqBuilding] = useState<Record<string, boolean>>({})

  const [articleTask, setArticleTask] = useState<ArticleTaskState>(DEFAULT_ARTICLE_TASK)
  const [articleMode, setArticleMode] = useState<'url' | 'topic' | 'idea'>('url')
  const [articleInputValue, setArticleInputValue] = useState('')
  const [articlePromptText, setArticlePromptText] = useState<string | null>(null)
  const [articleCopiedFlash, setArticleCopiedFlash] = useState(false)

  const [socialTask, setSocialTask] = useState<SocialTaskState>(DEFAULT_SOCIAL_TASK)

  const [references, setReferences] = useState<ReferenceSource[]>([])
  const [refsLoading, setRefsLoading] = useState(true)
  const [showAddRef, setShowAddRef] = useState(false)
  const [refLabel, setRefLabel] = useState('')
  const [refUrl, setRefUrl] = useState('')
  const [refCategory, setRefCategory] = useState('news')
  const [refSaving, setRefSaving] = useState(false)

  async function patchSession(partial: Partial<{ pq_tasks: PqTask[]; article_task: ArticleTaskState; social_task: SocialTaskState }>) {
    try {
      await fetch('/api/roodber8/studio/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
    } catch {
      // best-effort persistence; UI state already updated optimistically
    }
  }

  async function loadDailyArticles() {
    setArticlesLoading(true)
    try {
      const res = await fetch('/api/roodber8/studio/daily-articles')
      const data = await res.json() as { articles?: DailyArticle[] }
      const articles = data.articles ?? []
      setDailyArticles(articles)
      setPqTasks(prev => {
        const merged = mergePqTasks(articles, prev)
        patchSession({ pq_tasks: merged })
        return merged
      })
      setPqPromptText({})
    } finally {
      setArticlesLoading(false)
    }
  }

  async function loadReferences() {
    setRefsLoading(true)
    try {
      const res = await fetch('/api/roodber8/studio/references')
      const data = await res.json() as { references?: ReferenceSource[] }
      setReferences(data.references ?? [])
    } finally {
      setRefsLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      setSessionLoading(true)
      try {
        const res = await fetch('/api/roodber8/studio/session')
        const data = await res.json() as { session?: StudioSession }
        if (data.session) {
          setArticleTask(data.session.article_task ?? DEFAULT_ARTICLE_TASK)
          setSocialTask(data.session.social_task ?? DEFAULT_SOCIAL_TASK)
          setPqTasks(data.session.pq_tasks ?? [])
        }
      } finally {
        setSessionLoading(false)
      }
    }
    init()
    loadDailyArticles()
    loadReferences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleBuildPqPrompt(article: DailyArticle) {
    const key = article.content_id ?? article.slug
    setPqBuilding(prev => ({ ...prev, [key]: true }))
    try {
      let fullContent = article.content_preview
      if (article.content_id) {
        const res = await fetch(`/api/roodber8/studio/article-content?id=${encodeURIComponent(article.content_id)}`)
        if (res.ok) {
          const data = await res.json() as { article?: { content?: string } }
          if (data.article?.content) fullContent = data.article.content
        }
      }
      const prompt = buildPqPrompt(article, fullContent)
      setPqPromptText(prev => ({ ...prev, [key]: prompt }))
      setPqTasks(prev => {
        const updated = prev.map(t => t.article_id === key ? { ...t, prompt_built: true } : t)
        patchSession({ pq_tasks: updated })
        return updated
      })
    } finally {
      setPqBuilding(prev => ({ ...prev, [key]: false }))
    }
  }

  function handlePqCopy(articleId: string) {
    setPqTasks(prev => {
      const updated = prev.map(t => t.article_id === articleId ? { ...t, prompt_copied: true } : t)
      patchSession({ pq_tasks: updated })
      return updated
    })
  }

  function handlePqMarkImported(articleId: string) {
    setPqTasks(prev => {
      const updated = prev.map(t => t.article_id === articleId
        ? { ...t, json_imported: true, published_at: new Date().toISOString() }
        : t)
      patchSession({ pq_tasks: updated })
      return updated
    })
  }

  function handleBuildArticlePrompt() {
    if (!articleInputValue.trim()) return
    const prompt = buildArticlePrompt(articleMode, articleInputValue.trim())
    setArticlePromptText(prompt)
    const updated: ArticleTaskState = {
      ...articleTask,
      input_type: articleMode,
      input_value: articleInputValue.trim(),
      prompt_built: true,
    }
    setArticleTask(updated)
    patchSession({ article_task: updated })
  }

  async function handleArticleCopy() {
    if (!articlePromptText) return
    const ok = await copyToClipboard(articlePromptText)
    if (ok) {
      setArticleCopiedFlash(true)
      const updated = { ...articleTask, prompt_copied: true }
      setArticleTask(updated)
      patchSession({ article_task: updated })
      setTimeout(() => setArticleCopiedFlash(false), 2000)
    }
  }

  function handleArticleMarkImported() {
    const updated: ArticleTaskState = { ...articleTask, json_imported: true, published_at: new Date().toISOString() }
    setArticleTask(updated)
    patchSession({ article_task: updated })
  }

  async function handleAddReference() {
    if (!refLabel.trim() || !refUrl.trim()) return
    setRefSaving(true)
    try {
      const res = await fetch('/api/roodber8/studio/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: refLabel.trim(), url: refUrl.trim(), category: refCategory }),
      })
      if (res.ok) {
        setRefLabel('')
        setRefUrl('')
        setRefCategory('news')
        setShowAddRef(false)
        await loadReferences()
      }
    } finally {
      setRefSaving(false)
    }
  }

  async function handleDeleteReference(id: string) {
    setReferences(prev => prev.filter(r => r.id !== id))
    try {
      await fetch(`/api/roodber8/studio/references?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {
      await loadReferences()
    }
  }

  function handleOpenAllSources() {
    references.forEach(r => window.open(r.url, '_blank', 'noopener,noreferrer'))
  }

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const pqDoneCount = pqTasks.filter(t => t.json_imported).length
  const pqTotal = dailyArticles.length || 4
  const pqDotColor = pqDoneCount >= pqTotal && pqTotal > 0 ? '#10b981' : pqDoneCount > 0 ? '#f59e0b' : '#ef4444'

  const articleStatusText = articleTask.json_imported ? 'Imported' : articleTask.prompt_built ? 'Prompt ready' : 'Not started'
  const articleDotColor = articleTask.json_imported ? '#10b981' : articleTask.prompt_built ? '#f59e0b' : '#ef4444'

  const totalTasks = pqTotal + 1
  const doneTasks = pqDoneCount + (articleTask.json_imported ? 1 : 0)
  const overallPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const loading = sessionLoading || articlesLoading

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(212,160,23,0.12)' }}>
          <Sparkles size={20} style={{ color: '#D4A017' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Content & Prompt Studio</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Daily content refresh — prompts, imports, and publishing.</p>
        </div>
      </div>
      <p className="text-sm font-semibold mb-8" style={{ color: '#D4A017' }}>{todayLabel}</p>

      {/* Section 1 — Daily Progress Board */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: loading ? '#334155' : pqDotColor }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Practice Questions</p>
            </div>
            <p className="text-lg font-black text-white">
              {loading ? '—' : `${pqDoneCount}/${pqTotal} articles done`}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: loading ? '#334155' : articleDotColor }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Today&apos;s Article</p>
            </div>
            <p className="text-lg font-black text-white">{loading ? '—' : articleStatusText}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#334155' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Social Update</p>
            </div>
            <p className="text-lg font-black text-white">Coming soon</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Today&apos;s Progress</p>
            <p className="text-3xl font-black" style={{ color: '#D4A017' }}>{loading ? '—' : `${overallPercent}%`}</p>
          </div>
        </div>
      </div>

      {/* Section 2 — Practice Questions */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} style={{ color: '#D4A017' }} />
            <h2 className="text-white font-bold text-sm">Practice Questions — 4 Articles</h2>
          </div>
          <button onClick={loadDailyArticles} disabled={articlesLoading}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
            style={C.idle}>
            {articlesLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh Selection
          </button>
        </div>

        {articlesLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: '#111827' }} />
            ))}
          </div>
        ) : dailyArticles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: '#334155' }}>No unlinked published articles found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {dailyArticles.map(article => {
              const key = article.content_id ?? article.slug
              const task = pqTasks.find(t => t.article_id === key) ?? {
                article_id: key, article_title: article.title, article_slug: article.slug,
                prompt_built: false, prompt_copied: false, json_imported: false, published_at: null,
              }
              return (
                <ArticlePQCard key={key}
                  article={article}
                  task={task}
                  promptText={pqPromptText[key]}
                  building={!!pqBuilding[key]}
                  onBuildPrompt={() => handleBuildPqPrompt(article)}
                  onCopy={() => handlePqCopy(key)}
                  onMarkImported={() => handlePqMarkImported(key)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Section 3 — Article Prompt Builder */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} style={{ color: '#D4A017' }} />
          <h2 className="text-white font-bold text-sm">Today&apos;s Article</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: '#475569' }}>Generate one professionally crafted article.</p>

        <div className="flex items-center gap-2 mb-4">
          {(['url', 'topic', 'idea'] as const).map(mode => (
            <button key={mode} onClick={() => setArticleMode(mode)}
              className="text-xs font-bold px-4 py-2 rounded-xl capitalize"
              style={articleMode === mode ? C.active : C.idle}>
              {mode}
            </button>
          ))}
        </div>

        {articleMode === 'url' && (
          <div className="mb-4">
            <input value={articleInputValue} onChange={e => setArticleInputValue(e.target.value)}
              placeholder="Paste article URL"
              className="w-full text-sm rounded-xl px-3 py-2.5 mb-2 focus:outline-none"
              style={C.input} />
            <p className="text-xs" style={{ color: '#334155' }}>
              Paste a URL from a reference source. The system will build a prompt based on the topic and theme.
            </p>
          </div>
        )}
        {articleMode === 'topic' && (
          <div className="mb-4">
            <input value={articleInputValue} onChange={e => setArticleInputValue(e.target.value)}
              placeholder="e.g. The impact of rising interest rates on corporate investment decisions"
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none"
              style={C.input} />
          </div>
        )}
        {articleMode === 'idea' && (
          <div className="mb-4">
            <textarea value={articleInputValue} onChange={e => setArticleInputValue(e.target.value)}
              placeholder="e.g. Explain why companies are currently holding unusually high cash reserves and what this means for investors"
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none"
              style={{ ...C.input, height: 90, resize: 'vertical' }} />
          </div>
        )}

        <button onClick={handleBuildArticlePrompt} disabled={!articleInputValue.trim()}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl mb-4"
          style={{ background: '#D4A017', color: '#0C1A3D', opacity: articleInputValue.trim() ? 1 : 0.4 }}>
          <Sparkles size={15} /> Build Article Prompt
        </button>

        {articlePromptText && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <button onClick={handleArticleCopy}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
                style={articleCopiedFlash ? C.success : { background: '#D4A017', color: '#0C1A3D' }}>
                {articleCopiedFlash ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Prompt</>}
              </button>
              {articleTask.prompt_copied && !articleTask.json_imported && (
                <button onClick={handleArticleMarkImported}
                  className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>
                  Mark as Imported
                </button>
              )}
              {articleTask.json_imported && (
                <span className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>Imported ✓</span>
              )}
            </div>
            <textarea readOnly value={articlePromptText}
              className="w-full text-xs font-mono rounded-xl p-3 mb-2"
              style={{ ...C.input, height: 220, resize: 'vertical' }} />
            <a href="/roodber8/articles/import" target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold flex items-center gap-1 w-fit" style={{ color: '#2563eb' }}>
              → Import Article <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>

      {/* Section 4 — Reference Library */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: '#D4A017' }} />
            <h2 className="text-white font-bold text-sm">Reference Sources</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleOpenAllSources} disabled={references.length === 0}
              className="text-xs font-bold px-4 py-2 rounded-xl"
              style={{ background: '#D4A017', color: '#0C1A3D', opacity: references.length === 0 ? 0.4 : 1 }}>
              Open All Sources
            </button>
            <button onClick={() => setShowAddRef(v => !v)}
              className="flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-xl" style={C.idle}>
              <Plus size={13} /> Add Source
            </button>
          </div>
        </div>

        {showAddRef && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-2 flex-wrap" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <input value={refLabel} onChange={e => setRefLabel(e.target.value)} placeholder="Label"
              className="text-sm rounded-lg px-3 py-2 focus:outline-none flex-1 min-w-32" style={C.input} />
            <input value={refUrl} onChange={e => setRefUrl(e.target.value)} placeholder="https://..."
              className="text-sm rounded-lg px-3 py-2 focus:outline-none flex-1 min-w-48" style={C.input} />
            <select value={refCategory} onChange={e => setRefCategory(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 focus:outline-none" style={C.input}>
              <option value="news">News</option>
              <option value="professional">Professional</option>
              <option value="academic">Academic</option>
            </select>
            <button onClick={handleAddReference} disabled={refSaving || !refLabel.trim() || !refUrl.trim()}
              className="text-xs font-bold px-4 py-2 rounded-xl"
              style={{ background: '#D4A017', color: '#0C1A3D', opacity: refSaving ? 0.6 : 1 }}>
              {refSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowAddRef(false)}
              className="text-xs font-bold px-4 py-2 rounded-xl" style={C.idle}>
              Cancel
            </button>
          </div>
        )}

        {refsLoading ? (
          <div className="py-8 text-center">
            <Loader2 size={18} className="animate-spin mx-auto" style={{ color: '#334155' }} />
          </div>
        ) : references.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: '#334155' }}>No reference sources yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {references.map(ref => (
              <div key={ref.id} className="py-3 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_DOT[ref.category] ?? '#64748b' }} />
                <p className="text-sm font-bold text-white shrink-0">{ref.label}</p>
                <a href={ref.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs truncate flex-1" style={{ color: '#475569' }}>
                  {ref.url}
                </a>
                <button onClick={() => handleDeleteReference(ref.id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 5 — Social (placeholder) */}
      <div className="rounded-2xl border p-8 text-center" style={C.card}>
        <Share2 size={28} className="mx-auto mb-3" style={{ color: '#334155' }} />
        <p className="text-white font-semibold mb-1">Social posting — coming soon</p>
        <p className="text-sm mb-5" style={{ color: '#475569' }}>
          Facebook and LinkedIn posting will be available here once platform accounts are configured.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button disabled className="text-sm font-bold px-5 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
            Post to Facebook {socialTask.facebook_published ? '✓' : ''}
          </button>
          <button disabled className="text-sm font-bold px-5 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
            Post to LinkedIn {socialTask.linkedin_published ? '✓' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
