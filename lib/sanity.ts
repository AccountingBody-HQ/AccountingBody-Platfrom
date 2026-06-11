import { createClient } from "next-sanity"
import imageUrlBuilder from "@sanity/image-url"

export const client = createClient({
  projectId: "4rllejq1",
  dataset: "production",
  apiVersion: "2026-03-16",
  useCdn: true,
  token: process.env.SANITY_API_TOKEN,
})

const builder = imageUrlBuilder(client)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function urlFor(source: any) {
  return builder.image(source)
}

export async function sanityFetch<T>({
  query,
  params = {},
  revalidate = 3600,
}: {
  query: string
  params?: Record<string, unknown>
  revalidate?: number
}): Promise<T> {
  return client.fetch<T>(query, params, {
    next: { revalidate },
  })
}
