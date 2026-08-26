interface Props {
  html: string
  className?: string
  stripLeadingH1?: boolean
}

export default function HtmlRenderer({ html, className = '', stripLeadingH1 = false }: Props) {
  if (!html) {
    return <p className="text-slate-400 italic">No content available yet.</p>
  }
  const cleaned = stripLeadingH1
    ? html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '')
    : html
  return (
    <div
      className={`html-content max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: cleaned }}
    />
  )
}
