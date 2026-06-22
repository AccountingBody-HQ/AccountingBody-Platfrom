import { headers } from 'next/headers'
import HireTalentClient from './HireTalentClient'

export const metadata = {
  title: 'Hire Talent | Accounting & Finance Recruitment',
  description: 'Tell us your hiring need. We find vetted accounting and finance professionals for permanent and contract roles. 90-day guarantee on every placement.',
}

export default async function HireTalentPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <HireTalentClient isEthioTax={isEthioTax} />
}
