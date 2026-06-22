import { headers } from 'next/headers'
import HireTalentManageClient from './HireTalentManageClient'

export const metadata = {
  title: 'Manage Your Hiring Brief | Accounting Body Recruitment',
  description: 'Update your employer hiring brief and role requirements.',
}

export default async function HireTalentManagePage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return <HireTalentManageClient isEthioTax={isEthioTax} />
}
