import { PortableText, type PortableTextComponents, type PortableTextBlock } from '@portabletext/react'
import QuizBankEmbed from './QuizBankEmbed'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

function PortableLink({ value, children }: { value?: { href?: string }; children?: React.ReactNode }) {
  const href = value?.href ?? ''
  const isExternal = href.startsWith('http')
  return (
    <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined} className="text-navy-700 underline underline-offset-2 decoration-navy-300 hover:text-gold-600 hover:decoration-gold-400 transition-colors">
      {children}
    </a>
  )
}

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className="text-slate-700 leading-relaxed text-base mb-5">{children}</p>,
    h1: ({ children }) => <h1 className="font-display text-3xl text-navy-950 font-bold mt-10 mb-4 leading-tight">{children}</h1>,
    h2: ({ children }) => <h2 className="font-display text-2xl text-navy-950 font-bold mt-10 mb-4 leading-tight border-b border-slate-200 pb-3">{children}</h2>,
    h3: ({ children }) => <h3 className="font-display text-xl text-navy-950 font-semibold mt-8 mb-3 leading-snug">{children}</h3>,
    h4: ({ children }) => <h4 className="font-display text-lg text-navy-950 font-semibold mt-6 mb-2">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gold-500 pl-5 pr-4 py-1 my-6 bg-gold-50 rounded-r-lg">
        <p className="text-slate-700 italic leading-relaxed text-base m-0">{children}</p>
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-none space-y-2 mb-5 pl-0">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal list-outside space-y-2 mb-5 pl-6">{children}</ol>,
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex items-start gap-2.5 text-slate-700 text-base leading-relaxed">
        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => <li className="text-slate-700 text-base leading-relaxed pl-1">{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-navy-950">{children}</strong>,
    em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
    code: ({ children }) => <code className="font-mono text-sm bg-slate-100 text-navy-800 px-1.5 py-0.5 rounded border border-slate-200">{children}</code>,
    link: PortableLink,
  },
  types: {
    quizbankBlock: ({ value }: { value?: { quiz?: { _ref?: string } } }) => {
      const id = value?.quiz?._ref
      if (!id) return (
        <div className="my-8 p-5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-sm text-center">
          No quiz selected — edit this block in Sanity Studio.
        </div>
      )
      return <QuizBankEmbed quizId={id} />
    },

    image: ({ value }) => {
      if (!value?.asset?._ref || !PROJECT_ID) return null
      const parts = (value.asset._ref as string).split('-')
      const imageUrl = `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${parts[1]}-${parts[2]}.${parts[3]}`
      return (
        <figure className="my-8">
          <img src={imageUrl} alt={value.alt ?? ''} className="w-full rounded-xl border border-slate-200 shadow-sm" />
          {value.caption && <figcaption className="text-center text-sm text-slate-400 mt-3 italic">{value.caption}</figcaption>}
        </figure>
      )
    },
    code: ({ value }) => (
      <div className="my-6 rounded-xl overflow-hidden border border-slate-200">
        {value.filename && <div className="bg-slate-800 px-4 py-2 text-xs text-slate-400 font-mono border-b border-slate-700">{value.filename}</div>}
        <pre className="bg-slate-900 p-5 overflow-x-auto">
          <code className="text-sm text-slate-200 font-mono leading-relaxed">{value.code}</code>
        </pre>
      </div>
    ),
    tableBlock: ({ value }: { value?: { headers?: string[]; rows?: { cells?: string[] }[] } }) => {
      const headers = value?.headers ?? []
      const rows = value?.rows ?? []
      if (!headers.length && !rows.length) return null
      return (
        <div className="my-8 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm text-left border-collapse">
            {headers.length > 0 && (
              <thead className="bg-navy-950 text-white">
                <tr>
                  {headers.map((h: string, i: number) => (
                    <th key={i} className="px-4 py-3 font-semibold text-sm border-r border-white/10 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row: { cells?: string[] }, ri: number) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {(row.cells ?? []).map((cell: string, ci: number) => (
                    <td key={ci} className="px-4 py-3 text-slate-700 border-r border-slate-200 last:border-r-0 border-t border-slate-100">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
    callout: ({ value }) => (
      <div className="my-6 p-5 rounded-xl bg-navy-50 border border-navy-200">
        {value.title && <p className="font-semibold text-navy-950 text-sm mb-1">{value.title}</p>}
        <p className="text-navy-800 text-sm leading-relaxed m-0">{value.body}</p>
      </div>
    ),
  },
}

interface Props {
  value: unknown[]
}

export default function PortableTextRenderer({ value }: Props) {
  if (!value || value.length === 0) {
    return <p className="text-slate-400 italic">No content available yet.</p>
  }
  return (
    <div className="portable-text max-w-none">
      <PortableText value={value as PortableTextBlock[]} components={components} />
    </div>
  )
}
