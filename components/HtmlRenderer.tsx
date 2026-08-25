interface Props {
  html: string
  className?: string
}

export default function HtmlRenderer({ html, className = '' }: Props) {
  if (!html) {
    return <p className="text-slate-400 italic">No content available yet.</p>
  }
  return (
    <div
      className={`html-content max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
