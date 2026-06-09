import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import MockExamClient from '@/components/course/MockExamClient'

export default async function FinancialAccountingMockExamPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/study')

  return (
    <MockExamClient
      level="level-2"
      module="financial-accounting"
      moduleName="Financial Accounting"
      backHref="/study/eticpa/atq/level-2/financial-accounting"
    />
  )
}
