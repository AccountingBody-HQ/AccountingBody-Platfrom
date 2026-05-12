/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/admin/AutoRefresh'
import { BookOpen, Plus, Filter, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'
const API_VER    = '2023-05-03'

async function getPracticePosts() {
  noStore()
  try {
    const query = encodeURIComponent(
      '*[_type == "practicePost"] | order(_createdAt desc) { _id, _createdAt, title, slug, difficulty, questionType, topic, examBody, "questionCount": count(quizQuestions) }'
    )
    const token = process.env.SANITY_API_TOKEN ?? ''
    const res = await fetch(
      `https://${PROJECT_ID}.api.sanity.io/v${API_VER}/data/query/${DATASET}?query=${query}`,
      { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.result ?? []) as any[]
  } catch { return [] }
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

const TYPE_LABEL: Record<string, string> = {
  'multiple-choice': 'MCQ',
  scenario:          'Scenario',
  writing:           'Writing',
  mixed:             'Mixed',
}

export default async function QuestionsLibraryPage() {
  const posts = await getPracticePosts()
  const total         = posts.length
  const mcqCount      = posts.filter((p: any) => p.questionType === 'multiple-choice').length
  const scenarioCount = posts.filter((p: any) => p.questionType === 'scenario').length
  const totalQs       = posts.reduce((sum: number, p: any) => sum + (p.questionCount ?? 0), 0)

  return (
    <div className="p-8">
      <AutoRefresh />

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,160,23,0.12)' }}>
            <BookOpen size={20} style={{ color: '#D4A017' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Practice Questions</h1>
            <p className="text-sm" style={{ color: '#475569' }}>Generate, manage and publish exam-standard question sets</p>
          </div>
        </div>
        <Link href="/admin/questions/generate"
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
          style={{ background: '#D4A017', color: '#0C1A3D' }}>
          <Plus size={15} /> Generate Questions
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Question Sets',   value: total,         color: '#D4A017', bg: 'rgba(212,160,23,0.08)',  border: 'rgba(212,160,23,0.2)'  },
          { label: 'Total Questions', value: totalQs,       color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)'  },
          { label: 'MCQ Sets',        value: mcqCount,      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
          { label: 'Scenario Sets',   value: scenarioCount, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.2)'  },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border p-5"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: '#475569' }} />
            <h2 className="text-white font-bold text-sm">All Question Sets</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(212,160,23,0.12)', color: '#D4A017' }}>{total}</span>
          </div>
          <a href="/studio/structure/practicePost" target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold" style={{ color: '#475569' }}>
            Open in Sanity Studio →
          </a>
        </div>

        {posts.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <BookOpen size={32} style={{ color: '#1a2238' }} className="mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">No question sets yet</p>
            <p className="text-sm mb-6" style={{ color: '#334155' }}>Generate your first set using the button above.</p>
            <Link href="/admin/questions/generate"
              className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>
              <Plus size={14} /> Generate Questions
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            <div className="grid px-6 py-3"
              style={{ gridTemplateColumns: '1fr 100px 120px 90px 80px 120px', color: '#334155', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span>Title</span><span>Type</span><span>Difficulty</span><span>Questions</span><span>Body</span><span style={{ textAlign: 'right' }}>Created</span>
            </div>
            {posts.map((post: any) => {
              const diff  = DIFF_STYLE[post.difficulty ?? ''] ?? DIFF_STYLE.intermediate
              const qtype = TYPE_LABEL[post.questionType ?? ''] ?? post.questionType ?? '—'
              const slug  = post.slug?.current ?? ''
              return (
                <div key={post._id} className="grid px-6 py-4 items-center hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '1fr 100px 120px 90px 80px 120px' }}>
                  <div className="min-w-0 pr-4">
                    <p className="text-white text-sm font-semibold truncate">{post.title ?? 'Untitled'}</p>
                    {post.topic && <p className="text-xs truncate mt-0.5" style={{ color: '#475569' }}>{post.topic}</p>}
                    {slug && (
                      <a href={`/practice-questions/${slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium mt-1 inline-block" style={{ color: '#2563eb' }}>
                        View live →
                      </a>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                      {qtype}
                    </span>
                  </div>
                  <div>
                    {post.difficulty ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                        style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                        {post.difficulty}
                      </span>
                    ) : <span style={{ color: '#334155' }}>—</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                    <span className="text-sm font-semibold text-white">{post.questionCount ?? 0}</span>
                  </div>
                  <div>
                    {post.examBody ? (
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                        style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                        {post.examBody}
                      </span>
                    ) : <span style={{ color: '#334155' }}>—</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="text-xs" style={{ color: '#475569' }}>
                      {post._createdAt ? new Date(post._createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
