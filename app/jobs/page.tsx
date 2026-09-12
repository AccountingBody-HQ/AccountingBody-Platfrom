import { headers } from 'next/headers'
import JobsHubClient from './JobsHubClient'
import { getCachedBrowsableJobsCount } from '@/lib/jobs'

export default async function JobsHubPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const jobCount = await getCachedBrowsableJobsCount(isEthioTax ? 'et' : 'ab')
  return <JobsHubClient isEthioTax={isEthioTax} jobCount={jobCount} />
}
