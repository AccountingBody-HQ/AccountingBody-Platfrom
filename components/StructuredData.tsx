// components/StructuredData.tsx
// Drop this component into any page to add JSON-LD structured data.
// Example usage on an article page:
//
//   import StructuredData  from '@/components/StructuredData'
//   import { articleSchema } from '@/lib/structured-data'
//
//   <StructuredData data={articleSchema({ title, description, url, datePublished })} />

type JSONLDObject = Record<string, unknown>

export default function StructuredData({
  data,
}: {
  data: JSONLDObject | JSONLDObject[]
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data, null, 0),
      }}
    />
  )
}