'use client'

// ExplanationRenderer — parses and renders structured question explanations
// Handles two formats:
//   Calculation: OVERVIEW / DATA / METHOD / SOLUTION / WHY OTHERS WRONG / KEY TAKEAWAY
//   Theory:      OVERVIEW / WHY CORRECT / WHY OTHERS WRONG / PROFESSIONAL CONTEXT / KEY TAKEAWAY

interface Props {
  explanation: string
  dark?: boolean
}

const SECTION_HEADINGS = [
  'OVERVIEW:',
  'DATA (INPUTS & ASSUMPTIONS):',
  'DATA:',
  'METHOD:',
  'SOLUTION (STEP-BY-STEP):',
  'SOLUTION:',
  'WHY THE OTHER OPTIONS ARE WRONG:',
  'WHY THE CORRECT ANSWER IS RIGHT:',
  'WHY CORRECT:',
  'PROFESSIONAL CONTEXT:',
  'KEY TAKEAWAY:',
  'APPLY TO THIS CASE:',
  'RESULT:',
  'PITFALL NOTE:',
]

interface Section {
  heading: string
  content: string
}

function parseSections(text: string): Section[] {
  if (!text?.trim()) return []

  // Build a regex that matches any known section heading
  // Handles both inline format (single line) and newline-separated format
  const escapedHeadings = SECTION_HEADINGS.map(h =>
    h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  const headingPattern = new RegExp(
    '(?:^|\\s)(' + escapedHeadings.join('|') + ')',
    'gi'
  )

  // Find all heading matches and their positions
  const matches: { index: number; heading: string }[] = []
  let m: RegExpExecArray | null
  while ((m = headingPattern.exec(text)) !== null) {
    const heading = m[1]
    // index of the heading itself (skip leading whitespace)
    const headingIndex = m.index + m[0].length - m[1].length
    matches.push({ index: headingIndex, heading: heading.trim() })
  }

  // If no headings found, return empty (fallback will handle)
  if (matches.length === 0) return []

  const sections: Section[] = []

  // If there is content before the first heading, treat as OVERVIEW
  const beforeFirst = text.slice(0, matches[0].index).trim()
  if (beforeFirst) {
    sections.push({ heading: 'OVERVIEW', content: beforeFirst })
  }

  for (let i = 0; i < matches.length; i++) {
    const { index, heading } = matches[i]
    const headingKey = heading.replace(/:$/, '').trim().toUpperCase()
    const contentStart = index + heading.length
    const contentEnd = i + 1 < matches.length ? matches[i + 1].index : text.length
    const content = text.slice(contentStart, contentEnd).trim()
    if (content) {
      sections.push({ heading: headingKey, content })
    }
  }

  return sections.filter(s => s.content.trim())
}

function renderStepLines(content: string, dark: boolean): React.ReactNode[] {
  return content.split('\n').filter(l => l.trim()).map((line, i) => {
    const isStep = /^step\s*\d+:/i.test(line.trim())
    const isOptionLine = /^option\s+[a-d]:/i.test(line.trim())
    const isDrCr = /^(dr|cr)\s+/i.test(line.trim())

    if (isStep) {
      const colonIdx = line.indexOf(':')+1
      const label = line.slice(0, colonIdx)
      const calc  = line.slice(colonIdx)
      return (
        <div key={i} className="flex items-start gap-2 py-1">
          <span className="shrink-0 font-bold text-xs mt-0.5 min-w-[52px]"
            style={{ color: dark ? '#D4A017' : '#0C1A3D' }}>{label}</span>
          <span className="text-sm font-mono" style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{calc}</span>
        </div>
      )
    }

    if (isOptionLine) {
      const colonIdx = line.indexOf(':')+1
      const label = line.slice(0, colonIdx)
      const reason = line.slice(colonIdx)
      return (
        <div key={i} className="flex items-start gap-2 py-1.5 border-t" style={{ borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }}>
          <span className="shrink-0 font-bold text-xs mt-0.5 min-w-[64px]"
            style={{ color: dark ? '#f87171' : '#dc2626' }}>{label}</span>
          <span className="text-sm leading-relaxed" style={{ color: dark ? 'rgba(255,255,255,0.65)' : '#475569' }}>{reason.trim()}</span>
        </div>
      )
    }

    if (isDrCr) {
      const isDr = /^dr/i.test(line.trim())
      return (
        <div key={i} className="flex items-center gap-3 py-0.5 font-mono text-sm">
          <span className="w-6 font-bold text-xs shrink-0" style={{ color: isDr ? '#2563eb' : '#16a34a' }}>
            {isDr ? 'Dr' : 'Cr'}
          </span>
          <span style={{ color: dark ? '#e2e8f0' : '#1e293b' }}>{line.replace(/^(dr|cr)\s+/i, '').trim()}</span>
        </div>
      )
    }

    if (line.trim()) {
      return (
        <p key={i} className="text-sm leading-relaxed py-0.5" style={{ color: dark ? 'rgba(255,255,255,0.7)' : '#374151' }}>
          {line.trim()}
        </p>
      )
    }
    return null
  }).filter(Boolean) as React.ReactNode[]
}

const SECTION_CONFIG: Record<string, { label: string; accent: string; accentDark: string; bg: string; bgDark: string }> = {
  'OVERVIEW':                    { label: 'Overview',             accent: '#0C1A3D', accentDark: '#93c5fd', bg: 'rgba(12,26,61,0.04)',   bgDark: 'rgba(147,197,253,0.06)' },
  'DATA (INPUTS & ASSUMPTIONS)': { label: 'Data & Assumptions',   accent: '#2563eb', accentDark: '#93c5fd', bg: 'rgba(37,99,235,0.05)',  bgDark: 'rgba(37,99,235,0.08)'  },
  'DATA':                        { label: 'Data & Assumptions',   accent: '#2563eb', accentDark: '#93c5fd', bg: 'rgba(37,99,235,0.05)',  bgDark: 'rgba(37,99,235,0.08)'  },
  'METHOD':                      { label: 'Method',               accent: '#7c3aed', accentDark: '#c4b5fd', bg: 'rgba(124,58,237,0.05)', bgDark: 'rgba(124,58,237,0.08)' },
  'SOLUTION (STEP-BY-STEP)':     { label: 'Solution',             accent: '#059669', accentDark: '#6ee7b7', bg: 'rgba(5,150,105,0.05)',  bgDark: 'rgba(5,150,105,0.08)'  },
  'SOLUTION':                    { label: 'Solution',             accent: '#059669', accentDark: '#6ee7b7', bg: 'rgba(5,150,105,0.05)',  bgDark: 'rgba(5,150,105,0.08)'  },
  'WHY THE OTHER OPTIONS ARE WRONG': { label: 'Why Others Are Wrong', accent: '#dc2626', accentDark: '#fca5a5', bg: 'rgba(220,38,38,0.04)', bgDark: 'rgba(220,38,38,0.08)' },
  'WHY THE CORRECT ANSWER IS RIGHT': { label: 'Why This Is Correct', accent: '#059669', accentDark: '#6ee7b7', bg: 'rgba(5,150,105,0.05)', bgDark: 'rgba(5,150,105,0.08)' },
  'WHY CORRECT':                 { label: 'Why This Is Correct', accent: '#059669', accentDark: '#6ee7b7', bg: 'rgba(5,150,105,0.05)',  bgDark: 'rgba(5,150,105,0.08)'  },
  'PROFESSIONAL CONTEXT':        { label: 'Professional Context', accent: '#0891b2', accentDark: '#67e8f9', bg: 'rgba(8,145,178,0.05)',  bgDark: 'rgba(8,145,178,0.08)'  },
  'APPLY TO THIS CASE':          { label: 'Applied to This Case', accent: '#7c3aed', accentDark: '#c4b5fd', bg: 'rgba(124,58,237,0.05)', bgDark: 'rgba(124,58,237,0.08)' },
  'RESULT':                      { label: 'Result',               accent: '#059669', accentDark: '#6ee7b7', bg: 'rgba(5,150,105,0.05)',  bgDark: 'rgba(5,150,105,0.08)'  },
  'PITFALL NOTE':                { label: 'Pitfall Note',          accent: '#dc2626', accentDark: '#fca5a5', bg: 'rgba(220,38,38,0.04)',  bgDark: 'rgba(220,38,38,0.08)'  },
  'KEY TAKEAWAY':                { label: 'Key Takeaway',         accent: '#D4A017', accentDark: '#D4A017', bg: 'rgba(212,160,23,0.08)',  bgDark: 'rgba(212,160,23,0.12)' },
}

export default function ExplanationRenderer({ explanation, dark = false }: Props) {
  if (!explanation?.trim()) return null

  const sections = parseSections(explanation)

  // Fallback: if no sections parsed, render as plain text
  if (sections.length === 0) {
    return (
      <div className="mt-3 p-4 rounded-xl border"
        style={{
          background: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
          borderColor: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
        }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: dark ? 'rgba(255,255,255,0.35)' : '#94a3b8' }}>Explanation</p>
        <p className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: dark ? 'rgba(255,255,255,0.7)' : '#374151' }}>{explanation}</p>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {sections.map((section, i) => {
        const cfg = SECTION_CONFIG[section.heading.toUpperCase()] ?? SECTION_CONFIG['OVERVIEW']
        const isKeyTakeaway = section.heading.toUpperCase() === 'KEY TAKEAWAY'
        const isWrongOptions = section.heading.toUpperCase().includes('WRONG')
        const isSolution = section.heading.toUpperCase().startsWith('SOLUTION')
        const accentColor = dark ? cfg.accentDark : cfg.accent
        const bgColor = dark ? cfg.bgDark : cfg.bg

        return (
          <div key={i}
            className={`rounded-xl border overflow-hidden ${isKeyTakeaway ? 'ring-1' : ''}`}
            style={{
              background: bgColor,
              borderColor: dark ? `${accentColor}25` : `${accentColor}20`,
              ...(isKeyTakeaway ? { ringColor: accentColor } : {})
            }}>
            <div className="px-4 py-2 border-b flex items-center gap-2"
              style={{ borderColor: dark ? `${accentColor}20` : `${accentColor}15` }}>
              {isKeyTakeaway && (
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"
                  style={{ color: accentColor }}>
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              <span className="text-[0.65rem] font-bold uppercase tracking-widest"
                style={{ color: accentColor }}>{cfg.label}</span>
            </div>
            <div className="px-4 py-3">
              {(isSolution || isWrongOptions)
                ? <div className="space-y-0.5">{renderStepLines(section.content, dark)}</div>
                : <p className={`text-sm leading-relaxed ${isKeyTakeaway ? 'font-semibold' : ''}`}
                    style={{ color: dark ? (isKeyTakeaway ? '#fcd34d' : 'rgba(255,255,255,0.75)') : (isKeyTakeaway ? '#92400e' : '#374151') }}>
                    {section.content.trim()}
                  </p>
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
