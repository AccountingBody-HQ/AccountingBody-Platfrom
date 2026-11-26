// components/StructuredData.tsx
// Renders hidden labels (JSON-LD) built by lib/structured-data.ts:
//
//   import StructuredData  from '@/components/StructuredData'
//   import { articleSchema } from '@/lib/structured-data'
//
//   <StructuredData data={articleSchema({ title, url, isEthioTax })} />

type JSONLDObject = Record<string, unknown>

// Escaping '<' stops a literal `</script>` inside page text from closing this
// tag early; JSON readers see the identical string either way (the same rule
// as app/jobs/[slug]/structured-data.tsx).
export function structuredDataJson(data: JSONLDObject | JSONLDObject[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default function StructuredData({
  data,
}: {
  data: JSONLDObject | JSONLDObject[]
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: structuredDataJson(data) }}
    />
  )
}
