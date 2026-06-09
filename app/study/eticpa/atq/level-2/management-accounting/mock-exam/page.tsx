import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import MockExamClient from '@/components/course/MockExamClient'
export const dynamic = 'force-dynamic'
export default async function ManagementAccountingMockExamPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/study')
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="container-site py-4">
          <nav className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
            <a href="/study/eticpa" className="hover:text-slate-600 transition-colors">ETICPA</a>
            <span>/</span>
            <a href="/study/eticpa/atq/level-2" className="hover:text-slate-600 transition-colors">ATQ Level 2</a>
            <span>/</span>
            <a href="/study/eticpa/atq/level-2/management-accounting" className="hover:text-slate-600 transition-colors">Management Accounting</a>
            <span>/</span>
            <span className="text-slate-600">Mock Exam</span>
          </nav>
        </div>
      </div>
      <div className="container-site py-10 md:py-16">
        <MockExamClient
          level="level-2"
          module="management-accounting"
          moduleName="Management Accounting"
          backHref="/study/eticpa/atq/level-2/management-accounting"
        />
      </div>
    </div>
  )
}
