// app/mock-exams/[category]/page.tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPracticeFilters } from '@/lib/practice-queries'
import MockExamClient from '@/components/course/MockExamClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const filters = await getPracticeFilters()
  const cat = filters.categories.find(c => c.slug === category)
  const title = cat?.title ?? 'Mock Exam'
  return {
    title: `${title} Mock Exam | Accounting Body`,
    description: `Free timed mock exam for ${title}. 50 questions, 75 minutes, 60% pass mark. Unlimited attempts.`,
  }
}

export default async function CategoryMockExamPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params

  const headersList = await headers()
  const isEthioTax  = headersList.get('x-et-platform') === 'ethiotax'

  // ET users stay on their own mock exams
  if (isEthioTax) redirect('/study/mock-exams')

  // Validate the category exists and has questions
  const filters = await getPracticeFilters()
  const cat = filters.categories.find(c => c.slug === category)
  if (!cat) redirect('/mock-exams')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200">
        <div className="container-site py-4">
          <nav className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
            <a href="/" className="hover:text-slate-600 transition-colors">Home</a>
            <span>/</span>
            <a href="/study" className="hover:text-slate-600 transition-colors">Study</a>
            <span>/</span>
            <a href="/mock-exams" className="hover:text-slate-600 transition-colors">Mock Exams</a>
            <span>/</span>
            <span className="text-slate-600">{cat.title}</span>
          </nav>
        </div>
      </div>

      {/* EXAM */}
      <div className="container-site py-10 md:py-16">
        <MockExamClient
          level="ab"
          module={category}
          moduleName={cat.title}
          backHref="/mock-exams"
          apiPath="/api/mock-exam"
        />
      </div>
    </div>
  )
}
