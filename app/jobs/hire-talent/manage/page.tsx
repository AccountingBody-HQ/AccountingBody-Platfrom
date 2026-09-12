import { headers } from 'next/headers'
import HireTalentManageClient from './HireTalentManageClient'

export const metadata = {
  title: 'Manage Your Hiring Brief | Accounting Body Recruitment',
  description: 'Update your employer hiring brief and role requirements.',
  // Private, token-gated self-service page (token read client-side from the
  // URL) with no outbound content links — nothing for a crawler to index or
  // follow onward.
  robots: { index: false, follow: false },
}

export default async function HireTalentManagePage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <HireTalentManageClient isEthioTax={isEthioTax} />
}
