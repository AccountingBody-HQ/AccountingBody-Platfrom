// Metadata for the /get-help index page moved to ./page.tsx — this layout
// also wraps /get-help/[slug], and metadata defined here was cascading,
// unchanged, to every dynamic slug under it too.

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
