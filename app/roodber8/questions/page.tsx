import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import {
  BookOpen, Plus, ExternalLink, CheckCircle2, FileText,
  Layers, PenLine, FileJson, Search
} from 'lucide-react'

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

interface QuestionSetRow {
  id:             string
  title:          string
  slug?:          string
  difficulty?:    string
  topic?:         string
  exam_body?:     string[]
  question_type?: string
  created_at?:    string
  question_count?: number
}

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

async function getQuestionSets(safeSearch: string, letter: string): Promise<QuestionSetRow[]> {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  let query = supabase
    .from('question_sets')
    .select('id, title, slug, difficulty, topic, exam_body, question_type, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (safeSearch) query = query.ilike('title', `%${safeSearch}%`)
  if (letter)     query = query.ilike('title', `${letter}%`)

  const { data: setsData } = await query
  const sets = (setsData ?? []) as QuestionSetRow[]

  if (sets.length === 0) return []
  const setIds = sets.map(s => s.id)
  const { data: questionsData } = await supabase
    .from('questions')
    .select('id, set_id')
    .in('set_id', setIds)

  const countsBySetId = new Map<string, number>()
  for (const q of (questionsData ?? []) as { id: string; set_id: string }[]) {
    countsBySetId.set(q.set_id, (countsBySetId.get(q.set_id) ?? 0) + 1)
  }

  return sets.map(s => ({ ...s, question_count: countsBySetId.get(s.id) ?? 0 }))
}

export default async function QuestionsLibraryPage({
  searchParams,
}: {
  searchParams?: { search?: string; letter?: string }
}) {
  noStore()
  const search = searchParams?.search ?? ''
  const letter = searchParams?.letter ?? ''
  const safeSearch = search.replace(/[,()%]/g, '')
  const safeLetter = letter.replace(/[,()%]/g, '').slice(0, 1).toUpperCase()

  const supabaseForCount = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const [posts, { count: totalSets }] = await Promise.all([
    getQuestionSets(safeSearch, safeLetter),
    supabaseForCount.from('question_sets')
      .select('*', { count: 'exact', head: true }),
  ])

  const total         = totalSets ?? 0
  const totalQs       = posts.reduce((sum, p) => sum + (p.question_count ?? 0), 0)
  const mcqCount      = posts.filter(p => p.question_type === 'multiple-choice').length
  const scenarioCount = posts.filter(p => p.question_type === 'scenario').length
  const writingCount  = posts.filter(p => p.question_type === 'writing').length

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

      {/* A–Z Filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link href="/roodber8/questions"
          className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
          style={!safeLetter
            ? { background: '#D4A017', color: '#0C1A3D' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#475569' }}>
          All
        </Link>
        {ALPHABET.map(l => (
          <Link key={l} href={`/roodber8/questions?letter=${l}`}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
            style={safeLetter === l
              ? { background: '#D4A017', color: '#0C1A3D' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#475569' }}>
            {l}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-2xl border p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-3 py-2"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input name="search" defaultValue={safeSearch} placeholder="Search by title..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Search
          </button>
          {(safeSearch || safeLetter) && (
            <Link href="/roodber8/questions" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</Link>
          )}
        </form>
      </div>

      {/* Question sets list */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">
            {safeLetter ? `Sets starting with '${safeLetter}'` : safeSearch ? `Search results for '${safeSearch}'` : 'Recently Generated'}
          </h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>
            {posts.length} sets
          </span>
        </div>

        {posts.length === 0 ? (
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
            {posts.map((post) => {
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
