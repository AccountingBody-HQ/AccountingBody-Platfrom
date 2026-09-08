import { headers } from 'next/headers'
import JobListingsClient from './JobListingsClient'
import { JobListingsStructuredData } from './structured-data'

export const metadata = {
  title: 'Accounting & Finance Jobs | Accounting Body',
  description: 'Find accounting and finance jobs globally. Search roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals across UK, US, Australia, Canada, Singapore and Africa.',
}

export default async function JobListingsPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return (
    <>
      <JobListingsStructuredData />
      <JobListingsClient isEthioTax={isEthioTax} />
    </>
  )
}
