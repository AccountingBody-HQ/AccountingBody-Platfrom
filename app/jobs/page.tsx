import { headers } from 'next/headers'
import JobsHubClient from './JobsHubClient'

export default async function JobsHubPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <JobsHubClient isEthioTax={isEthioTax} />
}
