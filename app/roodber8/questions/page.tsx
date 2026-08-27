import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { BookOpen, Plus, ExternalLink, CheckCircle2, FileText, Layers, PenLine, FileJson } from 'lucide-react'
import { getAllQuestionSetsForAdmin, type QuestionSet } from '@/lib/db'

export const dynamic = 'force-dynamic'

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

const TYPE_LABEL: Record<string, string> = {
  'multiple-choice': 'MCQ',
  scenario:           'Scenario',
  writing:            'Writing',
  mixed:              'Mixed',
}

export default async function QuestionsLibraryPage() {
  noStore()
  const posts = await getAllQuestionSetsForAdmin()

  const total         = posts.length
  const totalQs       = posts.reduce((sum: number, p: QuestionSet) => sum + (p.question_count ?? 0), 0)
  const mcqCount      = posts.filter((p: QuestionSet) => p.question_type === 'multiple-choice').length
  const scenarioCount = posts.filter((p: QuestionSet) => p.question_type === 'scenario').length
  const writingCount  = posts.filter((p: QuestionSet) => p.question_type === 'writing').length
  const recentPosts   = posts.slice(0, 5)

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
            <p className="text-sm" style={{ color: '#475569' }}>Generate and publish exam-standard question sets</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/roodber8/questions/import"
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
            style={{ background: 'rgba(212,160,23,0.12)', color: '#D4A017', border: '1px solid #D4A017' }}>
            <FileJson size={15} /> Import JSON
          </Link>
          <Link href="/roodber8/questions/generate"
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
            style={{ background: '#D4A017', color: '#0C1A3D' }}>
            <Plus size={15} /> Generate Questions
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Question Sets',   value: total,         color: '#D4A017', bg: 'rgba(212,160,23,0.08)',  border: 'rgba(212,160,23,0.2)',  icon: BookOpen   },
          { label: 'Total Questions', value: totalQs,       color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  icon: CheckCircle2 },
          { label: 'MCQ Sets',        value: mcqCount,      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  icon: FileText   },
          { label: 'Scenario Sets',   value: scenarioCount, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.2)',  icon: Layers     },
          { label: 'Writing Sets',    value: writingCount,  color: '#ec4899', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.2)',  icon: PenLine    },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border p-5"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">Recently Generated</h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>
            {total} sets total
          </span>
        </div>

        {recentPosts.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <BookOpen size={32} style={{ color: '#1a2238' }} className="mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">No question sets yet</p>
            <p className="text-sm mb-6" style={{ color: '#334155' }}>Generate your first set using the button above.</p>
            <Link href="/roodber8/questions/generate"
              className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>
              <Plus size={14} /> Generate Questions
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {recentPosts.map((post: QuestionSet) => {
              const diff  = DIFF_STYLE[post.difficulty ?? ''] ?? DIFF_STYLE.intermediate
              const qtype = TYPE_LABEL[post.question_type ?? ''] ?? post.question_type ?? '—'
              const slug  = post.slug ?? ''
              const examBody = post.exam_body?.[0] ?? ''
              return (
                <div key={post.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{post.title ?? 'Untitled'}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {post.topic && <span className="text-xs" style={{ color: '#475569' }}>{post.topic}</span>}
                      {examBody && (
                        <span className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                          style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                          {examBody}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
                      {qtype}
                    </span>
                    {post.difficulty && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                        style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                        {post.difficulty}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                      <span className="text-sm font-semibold text-white">{post.question_count ?? 0}</span>
                    </div>
                    <Link href={`/roodber8/questions/${post.id}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.2)' }}>
                      Manage
                    </Link>
                    {slug && (
                      <a href={`/practice-questions/${slug}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563eb' }}>
                        View <ExternalLink size={10} />
                      </a>
                    )}
                    <span className="text-xs" style={{ color: '#334155' }}>
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
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
