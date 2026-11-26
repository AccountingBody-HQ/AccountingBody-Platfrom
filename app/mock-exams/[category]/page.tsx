// app/mock-exams/[category]/page.tsx
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import MockExamClient from '@/components/course/MockExamClient'
import type { Metadata } from 'next'
import { ownerCanonical, ownerUrl } from '@/lib/canonical'
import StructuredData from '@/components/StructuredData'
import { breadcrumbSchema, webPageSchema } from '@/lib/structured-data'
import { findMockExamSubject, isMockExamSubjectOpen } from '@/lib/mock-exam-subjects'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const cat = findMockExamSubject(category)
  const title = cat?.title ?? 'Mock Exam'
  return {
    title: `${title} Mock Exam`,
    description: `Free timed mock exam for ${title}. 50 questions, 75 minutes, 60% pass mark. Unlimited attempts.`,
    ...ownerCanonical('accountingbody', `/mock-exams/${category}`),
  }
}

export default async function CategoryMockExamPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params

  const headersList = await headers()
  const isEthioTax  = headersList.get('x-et-platform') === 'ethiotax'

  // ET users stay on their own mock exams
  if (isEthioTax) redirect('/study/mock-exams')

  // An unknown subject goes back to the hub; a subject whose bank is under
  // 50 questions keeps its address and says it is not open yet.
  const cat = findMockExamSubject(category)
  if (!cat) redirect('/mock-exams')
  const open = await isMockExamSubjectOpen(cat)

  // Hidden labels: the breadcrumb as shown (Accounting Body only; EthioTax redirects above).
  const pageUrl = ownerUrl('accountingbody', `/mock-exams/${category}`)

  return (
    <div className="min-h-screen bg-slate-50">
      <StructuredData data={[
        webPageSchema({ type: 'WebPage', name: cat.title, url: pageUrl }),
        breadcrumbSchema([
          { name: 'Home', url: ownerUrl('accountingbody', '/') },
          { name: 'Study', url: ownerUrl('accountingbody', '/study') },
          { name: 'Mock Exams', url: ownerUrl('accountingbody', '/mock-exams') },
          { name: cat.title, url: pageUrl },
        ]),
      ]} />
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200">
        <div className="container-site py-4">
          <nav className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
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
          notOpen={!open}
        />
      </div>
    </div>
  )
}
