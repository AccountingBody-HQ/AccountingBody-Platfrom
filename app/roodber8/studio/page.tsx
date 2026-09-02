'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Sparkles, Share2, Copy, Check, RefreshCw, Loader2, X, Plus,
  FileText, HelpCircle, BookOpen, ExternalLink, AlertTriangle,
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
  const examBodyUpper = (article.exam_body?.[0] || 'ACCA').toUpperCase()
  const examBodyLower = examBodyUpper.toLowerCase()
  const categoryLower = (article.category || article.category_title || '').toLowerCase()
  const cleanContent = stripHtmlAndTruncate(fullContent, 4000)

  return `You are a senior examiner and question architect with 20+ years of experience
writing professional accounting and finance examinations for ACCA, CIMA, ICAEW,
and AAT. You have written questions that appear in live professional examinations
and understand exactly what separates a truly discriminating exam question from
a mediocre one.

Your task is to generate exactly 25 original, exam-standard multiple-choice
questions (MCQs) based on the article provided below.

═══════════════════════════════════════════════════════════
ARTICLE DETAILS
═══════════════════════════════════════════════════════════
Title: ${article.title}
Category: ${article.category_title || article.category || 'Accounting'}
Exam Body: ${examBodyUpper}
Difficulty: ${article.difficulty || 'intermediate'}
Topic Summary: ${article.excerpt || article.title}

ARTICLE CONTENT:
${cleanContent}

═══════════════════════════════════════════════════════════
SECTION 1 — QUESTION QUALITY STANDARDS (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════

Every question must meet ALL of the following standards without exception.
A question that fails any one of these standards must be rewritten before output.

1.1 ORIGINALITY
— Do not lift, paraphrase, or closely mirror any sentence from the article.
— Every question stem must be written from first principles.
— Scenarios must use original numbers, company names, and contexts.
— The article is source knowledge only — not raw material to copy from.

1.2 APPLICATION OVER RECALL
— Do not test whether a student can remember a definition.
— Every question must require the student to APPLY, ANALYSE, or EVALUATE
  a concept in a realistic professional context.
— If the correct answer could be found by scanning the article for a
  matching phrase, rewrite the question.
— Ask yourself: would a student who understood the concept but had never
  read this article be able to answer this question? They should be able to.

1.3 STEM QUALITY
— The stem must be self-contained and unambiguous.
— State all assumptions the student needs. Never leave implicit what
  should be explicit.
— For calculation questions: provide all figures, rates, and dates needed
  to reach a unique correct answer.
— For scenario questions: set a realistic business context (named entity,
  currency, transaction type, date) before asking the question.
— Stem length: sufficient to be precise, no longer. No padding.
— Never write negative stems ("Which of the following is NOT...") unless
  the concept genuinely requires elimination-based reasoning.

1.4 DISTRACTOR QUALITY (CRITICAL)
— Each wrong option must represent a specific, named misconception or
  error that a real exam candidate plausibly makes.
— Acceptable distractor types:
    (a) A common conceptual error
    (b) A correct calculation using the wrong rate or the wrong method
    (c) A correct statement about a different standard or a different scenario
    (d) A reversal of the correct relationship
— NEVER write distractors that are:
    (a) Obviously nonsensical or clearly unrelated
    (b) Slightly reworded versions of each other
    (c) Detectable as wrong by reading the stem alone, without accounting knowledge
— All four options must be the same type and approximately the same length.
— Options containing "All of the above", "None of the above", or
  "Both A and B" are PROHIBITED.

1.5 SINGLE CORRECT ANSWER
— There must be exactly one defensibly correct answer.
— Run a mental adversarial check: could a well-prepared candidate
  construct a reasonable argument for any wrong option being correct?
  If yes, revise the question or the distractor.

1.6 TECHNICAL ACCURACY
— Every calculation must be verified before output.
— Every standard reference (IAS 21, IFRS 9, etc.) must be cited correctly.
— Every accounting treatment must reflect current IFRS/UK GAAP as applicable
  to the exam body specified.

═══════════════════════════════════════════════════════════
SECTION 2 — QUESTION SET ARCHITECTURE
═══════════════════════════════════════════════════════════

2.1 DIFFICULTY DISTRIBUTION
Generate exactly:
— 4 BEGINNER questions — foundational understanding, one-step reasoning,
  no multi-part calculations
— 16 INTERMEDIATE questions — application in realistic single-entity
  scenarios, may include two-step calculations, standard rule application
— 5 ADVANCED questions — professional judgement across multiple concepts,
  multi-step calculations, edge cases within the standard, situations where
  two plausible treatments exist and the candidate must select the correct one

2.2 QUESTION TYPE DISTRIBUTION
Across the 25 questions, include:
— Minimum 8 CALCULATION questions: original numbers, compute a specific
  figure, show full working in the explanation
— Minimum 8 SCENARIO questions: named entity in a realistic business
  situation, identify correct treatment, classification, or measurement
— Minimum 5 CONCEPTUAL questions: understanding of principles or
  relationships between concepts — never pure definition recall
— Remaining: judgement questions requiring distinction between two or
  more plausible treatments

2.3 TOPIC COVERAGE
— Distribute questions proportionally across all major sections of the article.
— No single section may account for more than 35% of the 25 questions.
— At least one question must address each major section of the article.

2.4 PROGRESSION
— Order questions from beginner to advanced: q1–q4 beginner,
  q5–q20 intermediate, q21–q25 advanced.

═══════════════════════════════════════════════════════════
SECTION 3 — EXPLANATION STANDARDS
═══════════════════════════════════════════════════════════

Every explanation must contain ALL FIVE components. An explanation
missing any component must be completed before output.

COMPONENT 1 — CORRECT ANSWER REASONING (mandatory)
Precisely why the correct answer is correct. For calculations, show
full step-by-step working with intermediate figures labelled. For
conceptual questions, cite the specific rule or principle.

COMPONENT 2 — WRONG OPTION ANALYSIS (mandatory — all three)
For each wrong option in sequence: name the specific misconception it
represents, explain in one to three sentences why it is wrong, and if
numerically wrong, show where the calculation breaks down.

COMPONENT 3 — UNDERLYING CONCEPT (mandatory)
One to two sentences stating the broader accounting or finance principle
being tested, written as a teaching statement.

COMPONENT 4 — STANDARD REFERENCE (mandatory where applicable)
Cite the specific standard, paragraph, or rule (e.g. IAS 21.23). If no
specific standard applies, cite the conceptual framework principle.

COMPONENT 5 — LEARNING TAKEAWAY (mandatory)
One sentence beginning with "Remember:" giving the student a durable,
exam-applicable rule they can carry into any question on this topic.

Minimum explanation length: 120 words. Maximum: 300 words.
Prose paragraphs only — no bullet points inside explanations.

═══════════════════════════════════════════════════════════
SECTION 4 — SELF-AUDIT BEFORE OUTPUT
═══════════════════════════════════════════════════════════

Before producing the JSON, run these checks silently.
Do not output the audit — only output the corrected JSON.

□ Exactly 25 questions present, q1 through q25
□ Exactly 4 beginner, 16 intermediate, 5 advanced
□ At least 8 calculation questions with verified arithmetic
□ At least 8 scenario questions with named entities and contexts
□ No question stem lifted or closely paraphrased from the article
□ Every distractor represents a named, plausible misconception
□ No "All of the above", "None of the above", "Both A and B" options
□ Every explanation contains all 5 required components
□ Every explanation is minimum 120 words
□ All four options within each question are the same type and length
□ correctIndex verified against the options array (0-based)
□ All calculations independently verified
□ No single article section exceeds 35% of questions
□ JSON is valid and matches the required output structure exactly

═══════════════════════════════════════════════════════════
SECTION 5 — OUTPUT FORMAT
═══════════════════════════════════════════════════════════

Return ONLY valid JSON. No preamble. No explanation. No markdown fences.
No text before or after the JSON object.

{
  "title": "${article.title} — Practice Questions",
  "slug": "${article.slug}-practice-questions",
  "excerpt": "25 exam-standard practice questions covering ${article.category_title || article.category} concepts from the article: ${article.title}. Tests understanding across beginner, intermediate and advanced levels.",
  "difficulty": "${article.difficulty || 'intermediate'}",
  "topic": "${article.category_title || article.category || 'Accounting'}",
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
      "difficulty": "beginner",
      "timeTargetMinutes": 2,
      "points": 2
    }
  ]
}

The questions array must contain exactly 25 items.
Question ids must be sequential: "q1" through "q25".
difficulty per question must be one of: beginner | intermediate | advanced
correctIndex must be 0, 1, 2, or 3 (0-based integer, not a string).
All string values must use straight double quotes — no smart quotes.

AFTER IMPORTING:
When importing via the Questions Import page, enter the Article ID
${article.content_id ?? '(see articles list)'} in the "Linked Article ID"
field to link the questions to this article.`
}

function buildArticlePrompt(mode: 'url' | 'topic' | 'idea', value: string): string {
  let inputContext: string
  if (mode === 'url') {
    inputContext = `REFERENCE SOURCE:\nURL: ${value}\n\nUsing this URL as thematic inspiration only — do not reproduce, paraphrase, or mirror its content. Write a fully original educational article on the topic it covers.`
  } else if (mode === 'topic') {
    inputContext = `TOPIC:\n${value}\n\nWrite a comprehensive, fully original educational article on this topic.`
  } else {
    inputContext = `ARTICLE IDEA:\n${value}\n\nWrite a comprehensive, fully original educational article based on this idea.`
  }

  return `You are a senior financial and accounting writer and editor with 20+ years of experience
producing authoritative educational content for professional accounting bodies,
leading publishers, and examination institutions. You write at the standard of
content published by ICAEW, ACCA, and the Financial Times. You understand exactly
what separates genuinely insightful professional content from generic filler.

Your task is to write one original, publication-ready educational article for
accountingbody.com — a platform serving accounting and finance professionals,
students, and serious learners at all levels.

${inputContext}

═══════════════════════════════════════════════════════════
SECTION 1 — CONTENT QUALITY STANDARDS (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════

Every article must meet ALL of the following standards without exception.

1.1 ORIGINALITY
— Every sentence must be written from first principles.
— Do not reproduce, paraphrase, or closely mirror any source material.
— All examples, numbers, scenarios, and company names must be original.
— The reference source or topic is inspiration only — not raw material.

1.2 ANALYTICAL DEPTH
— Go beyond surface description at every point.
— For every concept introduced, explain: what it is, why it matters,
  how it works in practice, and what goes wrong when it is misunderstood.
— Never state a fact without explaining its implication.
— A qualified accountant or finance director must find genuine insight,
  not just a recap of what they already know.

1.3 BEGINNER ACCESSIBILITY WITHOUT DUMBING DOWN
— Explain every technical term the first time it appears.
— Use concrete analogies for abstract concepts.
— Never assume prior knowledge beyond GCSE-level maths.
— Sophistication comes from clarity of explanation, not complexity of language.

1.4 PROFESSIONAL TONE
— Authoritative, clear, and engaging. Never condescending.
— Active voice preferred. Short paragraphs (3-5 sentences maximum).
— No filler phrases: "In conclusion", "It is worth noting", "As we can see".
— No padding. Every sentence must earn its place.

1.5 TECHNICAL ACCURACY
— All accounting treatments must reflect current IFRS/UK GAAP as applicable.
— All standard references must be cited correctly (e.g. IAS 1, IFRS 15).
— All calculations must be verified before output.
— All regulatory or legal references must be current and accurate.

1.6 SEO QUALITY
— Naturally incorporate the primary topic phrase and 3-5 closely related
  search terms throughout the article.
— Never force keywords. Integration must be invisible to the reader.
— The title, first paragraph, and at least two subheadings should contain
  the primary topic phrase or a close variant.

═══════════════════════════════════════════════════════════
SECTION 2 — ARTICLE STRUCTURE AND SECTION STANDARDS
═══════════════════════════════════════════════════════════

The article must follow this exact structure. Each section has a minimum
standard — do not produce a section that fails its standard.

2.1 INTRODUCTION (150-200 words)
— Open with a hook: a striking fact, a common misconception, or a
  professional scenario that makes the reader want to continue.
— State clearly what the article covers and why it matters.
— Do not begin with "In this article" or "This article will cover".
— The first sentence must compel the reader to read the second.

2.2 CORE CONCEPT EXPLAINED (200-300 words)
— Define the central concept with precision.
— Explain it from first principles — assume zero prior knowledge.
— Include one concrete, original worked example or analogy.
— By the end of this section, a first-year accounting student must
  understand the concept well enough to explain it to someone else.

2.3 KEY PRINCIPLES OR COMPONENTS (300-400 words)
— Use H3 subheadings for each principle or component.
— Minimum 3 subheadings, maximum 5.
— Each subheading section: 60-100 words.
— Each principle must be actionable or applicable — not just descriptive.

2.4 REAL-WORLD APPLICATION OR EXAMPLE (150-200 words)
— A realistic, original scenario involving a named fictional entity.
— Show the concept in action with specific figures where relevant.
— Draw an explicit lesson from the example.

2.5 COMMON MISCONCEPTIONS OR PITFALLS (150-200 words)
— Identify 2-3 specific, named misconceptions that professionals actually hold.
— Explain precisely why each is wrong.
— This section must be specific — no generic "be careful" warnings.

2.6 IMPLICATIONS FOR PROFESSIONALS (150-200 words)
— What does this mean for a practising accountant, finance director,
  or exam candidate right now?
— Actionable insight, not general commentary.

2.7 KEY TAKEAWAYS (exactly 4 bullet points)
— Each bullet: one crisp, complete sentence.
— Each bullet must stand alone as a useful piece of knowledge.
— No bullet may begin with the same word as another.

2.8 CONCLUSION (100-150 words)
— Synthesise — do not summarise. Connect the concept to the bigger picture.
— End with a forward-looking or thought-provoking closing sentence.
— No "In conclusion" or "To summarise".

═══════════════════════════════════════════════════════════
SECTION 3 — HTML FORMATTING STANDARDS
═══════════════════════════════════════════════════════════

3.1 PERMITTED TAGS ONLY
Use only: h2, h3, p, ul, ol, li, strong, em, blockquote.
No divs, no spans, no classes, no inline styles, no data attributes.

3.2 HEADING HIERARCHY
— H2 for main section headings (Introduction, Core Concept, etc.).
— H3 for subheadings within sections only.
— Never skip heading levels.

3.3 PARAGRAPH DISCIPLINE
— Maximum 5 sentences per paragraph.
— Never a wall of text. Break at natural thought boundaries.
— Every new idea gets a new paragraph.

3.4 LISTS
— Use ul for unordered conceptual lists (3-6 items maximum).
— Use ol for sequential steps or ranked items only.
— Never use a list as a substitute for analytical prose.

3.5 EMPHASIS
— Use strong for genuinely critical terms or figures only.
— Use em for titles of standards, publications, or introduced technical terms.
— Never bold entire sentences for emphasis.

3.6 BLOCKQUOTE
— Use only for a direct standard definition or a verbatim regulatory excerpt.
— Maximum one blockquote per article.

═══════════════════════════════════════════════════════════
SECTION 4 — SELF-AUDIT BEFORE OUTPUT
═══════════════════════════════════════════════════════════

Before producing the JSON, run these checks silently.
Do not output the audit — only output the corrected JSON.

□ Title contains the primary topic phrase or a close variant
□ First paragraph opens with a compelling hook — not "In this article"
□ Every technical term is defined on first use
□ At least one original worked example with specific figures
□ 2-3 named, specific misconceptions identified and refuted
□ Exactly 4 key takeaway bullet points
□ No filler phrases present anywhere
□ All accounting treatments technically accurate and current
□ All standard references correctly cited
□ All calculations verified
□ HTML uses only permitted tags — no divs, spans, classes, or styles
□ No paragraph exceeds 5 sentences
□ Total word count between 1,200 and 1,800 words
□ JSON is valid and matches the required output structure exactly
□ Content field contains no unescaped double quotes that break JSON

═══════════════════════════════════════════════════════════
SECTION 5 — OUTPUT FORMAT
═══════════════════════════════════════════════════════════

Return ONLY valid JSON. No preamble. No explanation. No markdown fences.
No text before or after the JSON object.

{
  "title": "Article title here",
  "slug": "url-friendly-slug-here",
  "excerpt": "One or two sentence summary (max 160 chars).",
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

category must be one of: financial-accounting | management-accounting |
financial-management | audit-assurance | taxation | business-management |
economics | financial-market | cryptocurrency | tools-templates

difficulty must be one of: beginner | intermediate | advanced

read_time: estimated reading time in minutes (integer). Calculate as
total word count divided by 200, rounded to nearest whole number.

tags: 3-6 lowercase hyphenated strings relevant to the article topic.

All string values must use straight double quotes — no smart quotes.
The content field must be a single string with no unescaped characters
that would invalidate the JSON.`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function makeFreshTask(article: DailyArticle): PqTask {
  return {
    article_id: article.content_id ?? article.slug,
    article_title: article.title,
    article_slug: article.slug,
    prompt_built: false,
    prompt_copied: false,
    json_imported: false,
    published_at: null,
  }
}

function mergePqTasks(articles: DailyArticle[], existing: PqTask[]): PqTask[] {
  return articles.map(a => {
    const key = a.content_id ?? a.slug
    return existing.find(t => t.article_id === key) ?? makeFreshTask(a)
  })
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────

function Skeleton({ h = 'h-5', w = 'w-24' }: { h?: string; w?: string }) {
  return (
    <div className={`${h} ${w} rounded animate-pulse`}
      style={{ background: '#1a2238' }} />
  )
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
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={C.card}>

      {/* No content_id warning */}
      {!article.content_id && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={C.warning}>
          <AlertTriangle size={12} />
          <p className="text-xs">No Article ID — prompt uses preview content only</p>
        </div>
      )}

      <p className="text-white font-bold text-sm leading-snug">{article.title}</p>

      <div className="flex items-center gap-2 flex-wrap">
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
      <div className="flex items-center gap-4">
        {[
          { label: 'Prompt Built', done: task.prompt_built },
          { label: 'Copied',       done: task.prompt_copied },
          { label: 'Imported',     done: task.json_imported },
        ].map(s => (
          <span key={s.label} className="text-xs font-semibold flex items-center gap-1"
            style={{ color: s.done ? '#10b981' : '#334155' }}>
            <Check size={12} /> {s.label}
          </span>
        ))}
      </div>

      {/* Build prompt button */}
      {!promptText && (
        <button onClick={onBuildPrompt} disabled={building}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl w-fit"
          style={{ background: '#D4A017', color: '#0C1A3D', opacity: building ? 0.6 : 1 }}>
          {building
            ? <><Loader2 size={15} className="animate-spin" /> Building…</>
            : <><Sparkles size={15} /> Build Prompt</>}
        </button>
      )}

      {/* Prompt area */}
      {promptText && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
              style={copiedFlash ? C.success : { background: '#D4A017', color: '#0C1A3D' }}>
              {copiedFlash ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Prompt</>}
            </button>
            {task.prompt_copied && !task.json_imported && (
              <button onClick={onMarkImported}
                className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>
                Mark as Imported
              </button>
            )}
            {task.json_imported && (
              <span className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>
                ✓ Imported
              </span>
            )}
          </div>
          <textarea readOnly value={promptText}
            className="w-full text-xs font-mono rounded-xl p-3"
            style={{ ...C.input, height: 160, resize: 'vertical' }} />
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
  const [articlesError, setArticlesError] = useState<string | null>(null)
  const [refsError, setRefsError] = useState<string | null>(null)

  const [dailyArticles, setDailyArticles] = useState<DailyArticle[]>([])
  const [pqTasks, setPqTasks] = useState<PqTask[]>([])
  const [pqPromptText, setPqPromptText] = useState<Record<string, string>>({})
  const [pqBuilding, setPqBuilding] = useState<Record<string, boolean>>({})
  const [manualArticleId, setManualArticleId] = useState('')
  const [manualArticleAdding, setManualArticleAdding] = useState(false)
  const [manualArticleError, setManualArticleError] = useState<string | null>(null)
  const [manualArticles, setManualArticles] = useState<DailyArticle[]>([])

  const [articleTask, setArticleTask] = useState<ArticleTaskState>(DEFAULT_ARTICLE_TASK)
  const [articleMode, setArticleMode] = useState<'url' | 'topic' | 'idea'>('url')
  const [articleInputValue, setArticleInputValue] = useState('')
  const [articlePromptText, setArticlePromptText] = useState<string | null>(null)
  const [articleCopiedFlash, setArticleCopiedFlash] = useState(false)
  const [articlePromptStale, setArticlePromptStale] = useState(false)

  const [socialTask, setSocialTask] = useState<SocialTaskState>(DEFAULT_SOCIAL_TASK)

  const [references, setReferences] = useState<ReferenceSource[]>([])
  const [refsLoading, setRefsLoading] = useState(true)
  const [showAddRef, setShowAddRef] = useState(false)
  const [refLabel, setRefLabel] = useState('')
  const [refUrl, setRefUrl] = useState('')
  const [refCategory, setRefCategory] = useState('news')
  const [refSaving, setRefSaving] = useState(false)

  // Sequential open-sources state
  const [openSourceIndex, setOpenSourceIndex] = useState(-1)

  const patchSession = useCallback(async (
    partial: Partial<{ pq_tasks: PqTask[]; article_task: ArticleTaskState; social_task: SocialTaskState }>
  ) => {
    try {
      await fetch('/api/roodber8/studio/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
    } catch {
      // best-effort — UI state already updated
    }
  }, [])

  // Load articles with explicit saved tasks (avoids stale state closure)
  async function loadDailyArticlesWithTasks(savedTasks: PqTask[], clearPrompts: boolean) {
    setArticlesLoading(true)
    setArticlesError(null)
    try {
      const res = await fetch('/api/roodber8/studio/daily-articles')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json() as { articles?: DailyArticle[] }
      const articles = data.articles ?? []
      setDailyArticles(articles)
      const merged = clearPrompts
        ? articles.map(a => makeFreshTask(a))
        : mergePqTasks(articles, savedTasks)
      setPqTasks(merged)
      if (clearPrompts) {
        setPqPromptText({})
        patchSession({ pq_tasks: merged })
      }
    } catch {
      setArticlesError('Failed to load articles. Click retry to try again.')
    } finally {
      setArticlesLoading(false)
    }
  }

  async function loadReferences() {
    setRefsLoading(true)
    setRefsError(null)
    try {
      const res = await fetch('/api/roodber8/studio/references')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json() as { references?: ReferenceSource[] }
      setReferences(data.references ?? [])
    } catch {
      setRefsError('Failed to load reference sources.')
    } finally {
      setRefsLoading(false)
    }
  }

  // Sequential init: session first, then articles with session data
  useEffect(() => {
    async function init() {
      setSessionLoading(true)
      let savedPqTasks: PqTask[] = []
      try {
        const res = await fetch('/api/roodber8/studio/session')
        if (res.ok) {
          const data = await res.json() as { session?: StudioSession }
          if (data.session) {
            savedPqTasks = data.session.pq_tasks ?? []
            const savedArticleTask = data.session.article_task ?? DEFAULT_ARTICLE_TASK
            setArticleTask(savedArticleTask)
            setSocialTask(data.session.social_task ?? DEFAULT_SOCIAL_TASK)
            // Restore article input from session
            if (savedArticleTask.input_value) {
              setArticleInputValue(savedArticleTask.input_value)
            }
            if (savedArticleTask.input_type) {
              setArticleMode(savedArticleTask.input_type)
            }
            // If prompt was built before but we don't have it in memory, flag as stale
            if (savedArticleTask.prompt_built && !savedArticleTask.json_imported) {
              setArticlePromptStale(true)
            }
          }
        }
      } finally {
        setSessionLoading(false)
      }
      // Load articles AFTER session resolves, passing saved tasks directly
      await loadDailyArticlesWithTasks(savedPqTasks, false)
      loadReferences()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddManualArticle() {
    const id = manualArticleId.trim().toUpperCase()
    if (!id.startsWith('AB-ART-')) {
      setManualArticleError('Please enter a valid Article ID (e.g. AB-ART-02013)')
      return
    }
    // Check not already in auto or manual list
    const allArticles = [...dailyArticles, ...manualArticles]
    if (allArticles.some(a => a.content_id === id)) {
      setManualArticleError('This article is already in the list')
      return
    }
    setManualArticleAdding(true)
    setManualArticleError(null)
    try {
      const res = await fetch(
        `/api/roodber8/articles/lookup?id=${encodeURIComponent(id)}`
      )
      if (!res.ok) {
        setManualArticleError('Article ID not found — check and try again')
        return
      }
      const data = await res.json() as { article?: { title: string; slug: string; excerpt: string; category: string; category_title: string; exam_body: string[]; difficulty: string; content_id: string } }
      if (!data.article) {
        setManualArticleError('Article ID not found — check and try again')
        return
      }
      const art = data.article
      const newArticle: DailyArticle = {
        id: art.content_id,
        title: art.title,
        slug: art.slug,
        content_id: art.content_id,
        category: art.category,
        category_title: art.category_title,
        exam_body: art.exam_body,
        difficulty: art.difficulty,
        read_time: null,
        excerpt: art.excerpt,
        content_preview: '',
      }
      setManualArticles(prev => [...prev, newArticle])
      // Add a fresh task for this article
      const newTask = makeFreshTask(newArticle)
      setPqTasks(prev => {
        const updated = [...prev, newTask]
        patchSession({ pq_tasks: updated })
        return updated
      })
      setManualArticleId('')
      setManualArticleError(null)
    } catch {
      setManualArticleError('Failed to fetch article. Please try again.')
    } finally {
      setManualArticleAdding(false)
    }
  }

  // Manual refresh — clear everything and fetch fresh articles
  function handleRefreshSelection() {
    setPqPromptText({})
    setManualArticles([])
    setManualArticleId('')
    setManualArticleError(null)
    loadDailyArticlesWithTasks([], true)
  }

  async function handleBuildPqPrompt(article: DailyArticle) {
    const key = article.content_id ?? article.slug
    setPqBuilding(prev => ({ ...prev, [key]: true }))
    try {
      let fullContent = article.content_preview
      if (article.content_id) {
        const res = await fetch(
          `/api/roodber8/studio/article-content?id=${encodeURIComponent(article.content_id)}`
        )
        if (res.ok) {
          const data = await res.json() as { article?: { content?: string } }
          if (data.article?.content) fullContent = data.article.content
        }
      }
      const prompt = buildPqPrompt(article, fullContent)
      setPqPromptText(prev => ({ ...prev, [key]: prompt }))
      setPqTasks(prev => {
        const updated = prev.map(t =>
          t.article_id === key ? { ...t, prompt_built: true } : t
        )
        patchSession({ pq_tasks: updated })
        return updated
      })
    } finally {
      setPqBuilding(prev => ({ ...prev, [key]: false }))
    }
  }

  function handlePqCopy(articleId: string) {
    setPqTasks(prev => {
      const updated = prev.map(t =>
        t.article_id === articleId ? { ...t, prompt_copied: true } : t
      )
      patchSession({ pq_tasks: updated })
      return updated
    })
  }

  function handlePqMarkImported(articleId: string) {
    setPqTasks(prev => {
      const updated = prev.map(t =>
        t.article_id === articleId
          ? { ...t, json_imported: true, published_at: new Date().toISOString() }
          : t
      )
      patchSession({ pq_tasks: updated })
      return updated
    })
  }

  function handleBuildArticlePrompt() {
    if (!articleInputValue.trim()) return
    const prompt = buildArticlePrompt(articleMode, articleInputValue.trim())
    setArticlePromptText(prompt)
    setArticlePromptStale(false)
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
    const updated: ArticleTaskState = {
      ...articleTask,
      json_imported: true,
      published_at: new Date().toISOString(),
    }
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
      await fetch(
        `/api/roodber8/studio/references?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
    } catch {
      await loadReferences()
    }
  }

  // Sequential source opener — each call is a direct user gesture so
  // window.open() is never blocked by popup blockers.
  function handleStartOpenSources() {
    if (references.length === 0) return
    window.open(references[0].url, '_blank', 'noopener,noreferrer')
    setOpenSourceIndex(0)
  }

  function handleOpenNextSource() {
    const next = openSourceIndex + 1
    if (next >= references.length) {
      setOpenSourceIndex(-1)
      return
    }
    window.open(references[next].url, '_blank', 'noopener,noreferrer')
    setOpenSourceIndex(next)
  }

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const pqDoneCount = pqTasks.filter(t => t.json_imported).length
  const pqDotColor = pqDoneCount >= 4 ? '#10b981' : pqDoneCount > 0 ? '#f59e0b' : '#ef4444'
  const articleStatusText = articleTask.json_imported ? 'Imported ✓' : articleTask.prompt_built ? 'Prompt ready' : 'Not started'
  const articleDotColor = articleTask.json_imported ? '#10b981' : articleTask.prompt_built ? '#f59e0b' : '#ef4444'
  const totalTasks = 5 // 4 PQ + 1 article
  const doneTasks = pqDoneCount + (articleTask.json_imported ? 1 : 0)
  const overallPercent = Math.round((doneTasks / totalTasks) * 100)

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
          <p className="text-sm" style={{ color: '#475569' }}>
            Daily content refresh — prompts, imports, and publishing.
          </p>
        </div>
      </div>
      <p className="text-sm font-semibold mb-8" style={{ color: '#D4A017' }}>{todayLabel}</p>

      {/* ── Section 1: Daily Progress Board ────────────────────────────── */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: sessionLoading ? '#334155' : pqDotColor }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Practice Questions
              </p>
            </div>
            {sessionLoading
              ? <Skeleton h="h-6" w="w-28" />
              : <p className="text-lg font-black text-white">{pqDoneCount}/4 articles done</p>}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: sessionLoading ? '#334155' : articleDotColor }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Today&apos;s Article
              </p>
            </div>
            {sessionLoading
              ? <Skeleton h="h-6" w="w-24" />
              : <p className="text-lg font-black text-white">{articleStatusText}</p>}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#334155' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Social Update
              </p>
            </div>
            <p className="text-lg font-black text-white">Coming soon</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
              Today&apos;s Progress
            </p>
            {sessionLoading
              ? <Skeleton h="h-9" w="w-16" />
              : (
                <p className="text-3xl font-black" style={{ color: '#D4A017' }}>
                  {overallPercent}%
                </p>
              )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Practice Questions ──────────────────────────────── */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} style={{ color: '#D4A017' }} />
            <h2 className="text-white font-bold text-sm">Practice Questions — 4 Articles</h2>
          </div>
          <button
            onClick={handleRefreshSelection}
            disabled={articlesLoading}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
            style={C.idle}>
            {articlesLoading
              ? <><Loader2 size={13} className="animate-spin" /> Loading…</>
              : <><RefreshCw size={13} /> Refresh Selection</>}
          </button>
        </div>

        {/* Manual article ID override */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <input
            value={manualArticleId}
            onChange={e => { setManualArticleId(e.target.value); setManualArticleError(null) }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddManualArticle() }}
            placeholder="Add any article by ID — e.g. AB-ART-02013"
            className="text-sm rounded-xl px-3 py-2 focus:outline-none flex-1 min-w-48"
            style={C.input}
          />
          <button
            onClick={handleAddManualArticle}
            disabled={manualArticleAdding || !manualArticleId.trim()}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
            style={{ background: 'rgba(212,160,23,0.12)', color: '#D4A017', border: '1px solid #D4A017', opacity: manualArticleId.trim() ? 1 : 0.5 }}>
            {manualArticleAdding
              ? <><Loader2 size={13} className="animate-spin" /> Adding…</>
              : <><Plus size={13} /> Add Article</>}
          </button>
          {manualArticleError && (
            <p className="text-xs w-full" style={{ color: '#ef4444' }}>
              ✗ {manualArticleError}
            </p>
          )}
        </div>

        {articlesError && (
          <div className="rounded-xl p-4 flex items-center gap-3 mb-4" style={C.danger}>
            <AlertTriangle size={14} className="shrink-0" />
            <p className="text-sm flex-1">{articlesError}</p>
            <button
              onClick={() => { setArticlesError(null); handleRefreshSelection() }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0"
              style={C.danger}>
              Retry
            </button>
          </div>
        )}

        {articlesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl animate-pulse"
                style={{ background: '#111827' }} />
            ))}
          </div>
        ) : dailyArticles.length === 0 && !articlesError ? (
          <div className="py-12 text-center">
            <p className="text-sm mb-2" style={{ color: '#475569' }}>
              All published articles have linked practice questions.
            </p>
            <p className="text-xs" style={{ color: '#334155' }}>
              Great work! Add more articles or check the articles list.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...dailyArticles, ...manualArticles].map(article => {
              const key = article.content_id ?? article.slug
              const task = pqTasks.find(t => t.article_id === key) ?? makeFreshTask(article)
              return (
                <ArticlePQCard
                  key={key}
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

      {/* ── Section 3: Article Prompt Builder ──────────────────────────── */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} style={{ color: '#D4A017' }} />
          <h2 className="text-white font-bold text-sm">Today&apos;s Article</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: '#475569' }}>
          Generate one professionally crafted article.
        </p>

        {/* Stale prompt notice */}
        {articlePromptStale && !articlePromptText && (
          <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={C.warning}>
            <AlertTriangle size={13} className="shrink-0" />
            <p className="text-xs">
              A prompt was built earlier today. Re-enter your input below and rebuild to get a fresh copy.
            </p>
          </div>
        )}

        {/* Mode tabs */}
        <div className="flex items-center gap-2 mb-4">
          {(['url', 'topic', 'idea'] as const).map(mode => (
            <button key={mode}
              onClick={() => { setArticleMode(mode); setArticleInputValue('') }}
              className="text-xs font-bold px-4 py-2 rounded-xl capitalize"
              style={articleMode === mode ? C.active : C.idle}>
              {mode}
            </button>
          ))}
        </div>

        {articleMode === 'url' && (
          <div className="mb-4">
            <input
              value={articleInputValue}
              onChange={e => setArticleInputValue(e.target.value)}
              placeholder="Paste article URL from a reference source"
              className="w-full text-sm rounded-xl px-3 py-2.5 mb-2 focus:outline-none"
              style={C.input}
            />
            <p className="text-xs" style={{ color: '#334155' }}>
              The system uses the URL as context for the prompt — it does not fetch the page content.
            </p>
          </div>
        )}

        {articleMode === 'topic' && (
          <div className="mb-4">
            <input
              value={articleInputValue}
              onChange={e => setArticleInputValue(e.target.value)}
              placeholder="e.g. The impact of rising interest rates on corporate investment decisions"
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none"
              style={C.input}
            />
          </div>
        )}

        {articleMode === 'idea' && (
          <div className="mb-4">
            <textarea
              value={articleInputValue}
              onChange={e => setArticleInputValue(e.target.value)}
              placeholder="e.g. Explain why companies are currently holding unusually high cash reserves and what this means for investors"
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none"
              style={{ ...C.input, height: 90, resize: 'vertical' }}
            />
          </div>
        )}

        <button
          onClick={handleBuildArticlePrompt}
          disabled={!articleInputValue.trim()}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl mb-4"
          style={{ background: '#D4A017', color: '#0C1A3D', opacity: articleInputValue.trim() ? 1 : 0.4 }}>
          <Sparkles size={15} /> Build Article Prompt
        </button>

        {articlePromptText && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleArticleCopy}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl"
                style={articleCopiedFlash ? C.success : { background: '#D4A017', color: '#0C1A3D' }}>
                {articleCopiedFlash
                  ? <><Check size={13} /> Copied!</>
                  : <><Copy size={13} /> Copy Prompt</>}
              </button>
              {articleTask.prompt_copied && !articleTask.json_imported && (
                <button onClick={handleArticleMarkImported}
                  className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>
                  Mark as Imported
                </button>
              )}
              {articleTask.json_imported && (
                <span className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>
                  ✓ Imported
                </span>
              )}
            </div>
            <textarea readOnly value={articlePromptText}
              className="w-full text-xs font-mono rounded-xl p-3"
              style={{ ...C.input, height: 220, resize: 'vertical' }} />
            <a href="/roodber8/articles/import" target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold flex items-center gap-1 w-fit" style={{ color: '#2563eb' }}>
              → Import Article <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>

      {/* ── Section 4: Reference Library ───────────────────────────────── */}
      <div className="rounded-2xl border p-6 mb-6" style={C.card}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: '#D4A017' }} />
            <h2 className="text-white font-bold text-sm">Reference Sources</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Sequential open — each click is a direct user gesture, never blocked */}
            {openSourceIndex === -1 ? (
              <button
                onClick={handleStartOpenSources}
                disabled={references.length === 0}
                className="text-xs font-bold px-4 py-2 rounded-xl"
                style={{ background: '#D4A017', color: '#0C1A3D', opacity: references.length === 0 ? 0.4 : 1 }}>
                Open Sources
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: '#D4A017' }}>
                  {openSourceIndex + 1} of {references.length} opened
                </span>
                {openSourceIndex + 1 < references.length ? (
                  <button onClick={handleOpenNextSource}
                    className="text-xs font-bold px-4 py-2 rounded-xl"
                    style={{ background: '#D4A017', color: '#0C1A3D' }}>
                    Open Next →
                  </button>
                ) : (
                  <button onClick={() => setOpenSourceIndex(-1)}
                    className="text-xs font-bold px-4 py-2 rounded-xl" style={C.success}>
                    ✓ All opened
                  </button>
                )}
              </div>
            )}
            <button onClick={() => setShowAddRef(v => !v)}
              className="flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-xl"
              style={C.idle}>
              <Plus size={13} /> Add Source
            </button>
          </div>
        </div>

        {showAddRef && (
          <div className="rounded-xl p-4 mb-4 flex items-center gap-2 flex-wrap"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <input value={refLabel} onChange={e => setRefLabel(e.target.value)}
              placeholder="Label (e.g. BBC Business)"
              className="text-sm rounded-lg px-3 py-2 focus:outline-none flex-1 min-w-32"
              style={C.input} />
            <input value={refUrl} onChange={e => setRefUrl(e.target.value)}
              placeholder="https://..."
              className="text-sm rounded-lg px-3 py-2 focus:outline-none flex-1 min-w-48"
              style={C.input} />
            <select value={refCategory} onChange={e => setRefCategory(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 focus:outline-none" style={C.input}>
              <option value="news">News</option>
              <option value="professional">Professional</option>
              <option value="academic">Academic</option>
            </select>
            <button onClick={handleAddReference}
              disabled={refSaving || !refLabel.trim() || !refUrl.trim()}
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

        {refsError && (
          <div className="rounded-xl p-4 flex items-center gap-3 mb-4" style={C.danger}>
            <AlertTriangle size={14} className="shrink-0" />
            <p className="text-sm flex-1">{refsError}</p>
            <button onClick={() => { setRefsError(null); loadReferences() }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0" style={C.danger}>
              Retry
            </button>
          </div>
        )}

        {refsLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 size={18} className="animate-spin" style={{ color: '#334155' }} />
          </div>
        ) : references.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: '#334155' }}>
              No reference sources yet. Add one above.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {references.map((ref, idx) => (
              <div key={ref.id}
                className="py-3 flex items-center gap-3"
                style={openSourceIndex === idx
                  ? { borderLeft: '2px solid #D4A017', paddingLeft: 8, marginLeft: -8 }
                  : {}}>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CATEGORY_DOT[ref.category] ?? '#64748b' }} />
                <p className="text-sm font-bold text-white shrink-0 min-w-32">{ref.label}</p>
                <a href={ref.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs truncate flex-1 hover:underline" style={{ color: '#475569' }}>
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

      {/* ── Section 5: Social (placeholder) ────────────────────────────── */}
      <div className="rounded-2xl border p-8 text-center" style={C.card}>
        <Share2 size={28} className="mx-auto mb-3" style={{ color: '#334155' }} />
        <p className="text-white font-semibold mb-1">Social posting — coming soon</p>
        <p className="text-sm mb-5" style={{ color: '#475569' }}>
          Facebook and LinkedIn posting will be available here
          once platform accounts are configured.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button disabled
            className="text-sm font-bold px-5 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
            Post to Facebook {socialTask.facebook_published ? '✓' : ''}
          </button>
          <button disabled
            className="text-sm font-bold px-5 py-2.5 rounded-xl opacity-40 cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
            Post to LinkedIn {socialTask.linkedin_published ? '✓' : ''}
          </button>
        </div>
      </div>

    </div>
  )
}
