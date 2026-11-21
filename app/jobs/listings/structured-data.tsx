import { brandName } from '@/lib/brand'
import { brandText } from '@/lib/et-wording'

export function JobListingsStructuredData({ total, isEthioTax = false }: { total?: number; isEthioTax?: boolean }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Accounting & Finance Jobs | ${brandName(isEthioTax)}`,
    description: brandText(isEthioTax, 'Find accounting and finance jobs globally. Roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals.'),
    url: 'https://accountingbody.com/jobs/listings',
    ...(total != null ? {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: total,
        itemListElement: [],
      }
    } : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
