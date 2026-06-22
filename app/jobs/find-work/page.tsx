import { headers } from 'next/headers'
import FindWorkClient from './FindWorkClient'

export const metadata = {
  title: 'Find Work | Accounting & Finance Recruitment',
  description: 'Register as a candidate with Accounting Body or EthioTax. We place accounting and finance professionals in permanent and contract roles.',
}

export default async function FindWorkPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <FindWorkClient isEthioTax={isEthioTax} />
}
