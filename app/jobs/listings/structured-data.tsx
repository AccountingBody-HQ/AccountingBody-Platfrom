export function JobListingsStructuredData({ total }: { total?: number }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Accounting & Finance Jobs | Accounting Body',
    description: 'Find accounting and finance jobs globally. Roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals.',
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
