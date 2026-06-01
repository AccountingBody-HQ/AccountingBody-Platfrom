// components/layout/NavigationWrapper.tsx
// Server component — reads x-et-platform header and passes correct nav links to client Navigation

import { headers } from 'next/headers'
import { Navigation } from './Navigation'
import { ETICPA_STUDY_LINKS, ICAEW_STUDY_LINKS, ET_GET_HELP_LINKS, ET_COMPANY_LINKS } from './nav-data'

export async function NavigationWrapper() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const studyQualificationLinks = isEthioTax ? ETICPA_STUDY_LINKS : ICAEW_STUDY_LINKS
  const etGetHelpLinks = isEthioTax ? ET_GET_HELP_LINKS : undefined
  const etCompanyLinks = isEthioTax ? ET_COMPANY_LINKS : undefined
  return <Navigation studyQualificationLinks={studyQualificationLinks} etGetHelpLinks={etGetHelpLinks} etCompanyLinks={etCompanyLinks} />
}
