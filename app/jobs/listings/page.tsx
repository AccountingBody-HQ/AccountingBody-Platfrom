import { headers } from 'next/headers'
import JobListingsClient from './JobListingsClient'

export default async function JobListingsPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <JobListingsClient isEthioTax={isEthioTax} />
}
