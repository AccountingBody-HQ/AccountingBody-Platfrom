import { headers } from 'next/headers'
import PostAJobClient from './PostAJobClient'

// Server wrapper reading the platform header, mirroring the existing
// app/jobs/page.tsx + JobsHubClient.tsx split (isEthioTax can't be read
// from next/headers inside a 'use client' component).
export default async function PostAJobPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <PostAJobClient isEthioTax={isEthioTax} />
}
