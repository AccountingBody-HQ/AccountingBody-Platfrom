import { headers } from 'next/headers'
import PostAJobClient from './PostAJobClient'

export const metadata = {
  title: 'Post a Job | Accounting & Finance Recruitment',
  description: 'Post a job on Accounting Body or EthioTax. Reach thousands of qualified accounting and finance professionals — your listing goes live within 24 hours.',
}

export default async function PostAJobPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <PostAJobClient isEthioTax={isEthioTax} />
}
