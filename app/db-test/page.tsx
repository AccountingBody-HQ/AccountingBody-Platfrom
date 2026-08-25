import { getArticleBySlug, getQuestionSetBySlug, getQuestionsBySetId, getCategoryCounts, getQuestionSetCount } from '@/lib/db'
import HtmlRenderer from '@/components/HtmlRenderer'

export default async function DbTestPage() {
  const article = await getArticleBySlug('business-transactions')
  const counts  = await getCategoryCounts()
  const pqCount = await getQuestionSetCount()
  const qset    = await getQuestionSetBySlug('types-of-business-transactions-practice-questions')
  const questions = qset ? await getQuestionsBySetId(qset.id) : []

  return (
    <div className="container-site py-12 space-y-12">
      <div className="p-6 bg-teal-50 border border-teal-200 rounded-xl">
        <h1 className="font-display text-2xl text-navy-950 mb-2">Supabase DB Test Page</h1>
        <p className="text-sm text-slate-500">Temporary test page — remove after verification</p>
      </div>

      <div>
        <h2 className="font-display text-xl text-navy-950 mb-4">Category Counts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(counts).map(([cat, count]) => (
            <div key={cat} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-400 mb-1">{cat}</p>
              <p className="font-display text-2xl text-navy-950">{count}</p>
            </div>
          ))}
          <div className="p-4 bg-gold-50 rounded-xl border border-gold-200">
            <p className="text-xs text-slate-400 mb-1">question sets</p>
            <p className="font-display text-2xl text-navy-950">{pqCount}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl text-navy-950 mb-4">Sample Article — Business Transactions</h2>
        {article ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
              <p><strong>Title:</strong> {article.title}</p>
              <p><strong>Slug:</strong> {article.slug}</p>
              <p><strong>Category:</strong> {article.category_title}</p>
              <p><strong>WP ID:</strong> {article.wp_id}</p>
              <p><strong>Content ID:</strong> {article.content_id}</p>
              <p><strong>Excerpt:</strong> {article.excerpt?.slice(0, 100)}...</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-xl">
              <HtmlRenderer html={article.content?.slice(0, 2000) + '...'} />
            </div>
          </div>
        ) : (
          <p className="text-red-600">Article not found — check slug</p>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl text-navy-950 mb-4">Sample Question Set — {qset?.title}</h2>
        {qset ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
              <p><strong>Title:</strong> {qset.title}</p>
              <p><strong>Difficulty:</strong> {qset.difficulty}</p>
              <p><strong>Article slug:</strong> {qset.article_slug}</p>
              <p><strong>Questions loaded:</strong> {questions.length}</p>
            </div>
            <div className="space-y-3">
              {questions.slice(0, 3).map((q, i) => (
                <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl text-sm">
                  <p className="font-semibold text-navy-950 mb-2">Q{i + 1}: {q.question_text.slice(0, 150)}...</p>
                  <p className="text-slate-500">A: {q.option_a?.slice(0, 60)}</p>
                  <p className="text-slate-500">B: {q.option_b?.slice(0, 60)}</p>
                  <p className="text-teal-700 font-medium">Correct index: {q.correct_index}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-red-600">Question set not found</p>
        )}
      </div>
    </div>
  )
}
