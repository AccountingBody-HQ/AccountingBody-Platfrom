// components/ui/QuestionTypeButtons.tsx
// AccountingBody Design System — Question Type Buttons
// The four interactive content modes for every article:
//   MCQ | Learn More | Short Writing | Scenario

'use client'

import React, { useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType = 'mcq' | 'learn' | 'writing' | 'scenario'

interface QuestionTypeConfig {
  id:          QuestionType
  label:       string
  sublabel:    string
  description: string
  icon:        React.ReactNode
  accent:      string  // Tailwind border-color class
  bg:          string  // hover background
  text:        string  // text color
  countLabel:  string  // "X questions" / "X articles"
}

// ── Icon components ────────────────────────────────────────────────────────────

function MCQIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2"/>
      <path strokeLinecap="round" strokeWidth="2" d="M17.5 14l-2 2.5 1 1.5 3-4"/>
    </svg>
  )
}

function LearnIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  )
}

function WritingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}

function ScenarioIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2"
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────

const questionTypeConfig: QuestionTypeConfig[] = [
  {
    id:          'mcq',
    label:       'MCQ',
    sublabel:    'Multiple Choice',
    description: 'Test your knowledge with exam-style multiple choice questions',
    icon:        <MCQIcon />,
    accent:      'border-navy-500',
    bg:          'hover:bg-navy-50',
    text:        'text-navy-700',
    countLabel:  'questions',
  },
  {
    id:          'learn',
    label:       'Learn More',
    sublabel:    'Study Notes',
    description: 'Deep-dive study notes, worked examples and explanations',
    icon:        <LearnIcon />,
    accent:      'border-teal-500',
    bg:          'hover:bg-teal-50',
    text:        'text-teal-700',
    countLabel:  'articles',
  },
  {
    id:          'writing',
    label:       'Short Writing',
    sublabel:    'Written Answer',
    description: 'Practise constructed response and short-form written answers',
    icon:        <WritingIcon />,
    accent:      'border-gold-500',
    bg:          'hover:bg-gold-50',
    text:        'text-gold-600',
    countLabel:  'tasks',
  },
  {
    id:          'scenario',
    label:       'Scenario',
    sublabel:    'Case Study',
    description: 'Apply your knowledge to realistic professional scenarios',
    icon:        <ScenarioIcon />,
    accent:      'border-slate-400',
    bg:          'hover:bg-slate-50',
    text:        'text-slate-700',
    countLabel:  'scenarios',
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuestionTypeButtonsProps {
  /** Slug for the current topic/article — used to build href */
  topicSlug: string
  /** Counts per type — optional */
  counts?: Partial<Record<QuestionType, number>>
  /** Available types — defaults to all four */
  availableTypes?: QuestionType[]
  /** Active/selected type — controlled */
  activeType?: QuestionType | null
  /** Callback when a type is selected */
  onSelect?: (type: QuestionType) => void
  /** Layout variant */
  layout?: 'row' | 'grid' | 'compact'
  /** Show descriptions */
  showDescriptions?: boolean
  className?: string
}

// ── Inline (article-level) row — default ──────────────────────────────────────
export function QuestionTypeButtons({
  topicSlug,
  counts,
  availableTypes,
  activeType,
  onSelect,
  layout = 'row',
  //showDescriptions = false,
  className = '',
}: QuestionTypeButtonsProps) {
  const available = availableTypes ?? ['mcq', 'learn', 'writing', 'scenario']
  const configs = questionTypeConfig.filter(c => available.includes(c.id))

  const gridClass = {
    row:     'flex flex-wrap gap-2',
    grid:    'grid grid-cols-2 sm:grid-cols-4 gap-3',
    compact: 'flex flex-wrap gap-1.5',
  }[layout]

  return (
    <div className={`${gridClass} ${className}`} role="group" aria-label="Practice this topic">
      {configs.map(config => {
        const count = counts?.[config.id]
        const isActive = activeType === config.id
        const isCompact = layout === 'compact'

        const button = (
          <button
            key={config.id}
            onClick={() => onSelect?.(config.id)}
            className={[
              'group flex items-center gap-2 rounded-lg border-2 transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
              isCompact ? 'px-3 py-1.5' : layout === 'grid' ? 'flex-col px-3 py-4' : 'px-3 py-2',
              isActive
                ? `${config.accent} bg-opacity-5 ${config.bg.replace('hover:', '')} shadow-sm`
                : `border-slate-200 bg-white ${config.bg}`,
            ].join(' ')}
            aria-pressed={isActive}
          >
            {/* Icon */}
            <span className={[
              'shrink-0 transition-colors duration-150',
              isActive ? config.text : 'text-slate-400 group-hover:' + config.text.replace('text-', 'text-'),
            ].join(' ')}>
              {config.icon}
            </span>

            {/* Text */}
            <span className={`flex ${layout === 'grid' ? 'flex-col items-center text-center' : 'flex-col'}`}>
              <span className={[
                'font-semibold leading-none',
                isCompact ? 'text-xs' : 'text-sm',
                isActive ? config.text : 'text-navy-950',
              ].join(' ')}>
                {config.label}
              </span>
              {!isCompact && (
                <span className="text-2xs text-slate-400 mt-0.5 leading-none">
                  {config.sublabel}
                  {count !== undefined && ` · ${count}`}
                </span>
              )}
            </span>

            {/* Active indicator pip */}
            {isActive && !isCompact && (
              <span className={`ml-auto w-1.5 h-1.5 rounded-full ${config.text.replace('text-', 'bg-')}`} />
            )}
          </button>
        )

        // If no onSelect, render as links
        if (!onSelect) {
          return (
            <Link
              key={config.id}
              href={`/articles/${topicSlug}/${config.id}`}
              className={[
                'group flex items-center gap-2 rounded-lg border-2 transition-all duration-150 no-underline',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1',
                isCompact ? 'px-3 py-1.5' : layout === 'grid' ? 'flex-col items-center px-3 py-4' : 'px-3 py-2',
                isActive
                  ? `${config.accent} shadow-sm`
                  : `border-slate-200 bg-white ${config.bg}`,
              ].join(' ')}
            >
              <span className={`shrink-0 ${isActive ? config.text : 'text-slate-400'}`}>
                {config.icon}
              </span>
              <span className={`flex ${layout === 'grid' ? 'flex-col items-center text-center' : 'flex-col'}`}>
                <span className={[
                  'font-semibold leading-none',
                  isCompact ? 'text-xs' : 'text-sm',
                  isActive ? config.text : 'text-navy-950',
                ].join(' ')}>
                  {config.label}
                </span>
                {!isCompact && (
                  <span className="text-2xs text-slate-400 mt-0.5 leading-none">
                    {config.sublabel}
                    {count !== undefined && ` · ${count}`}
                  </span>
                )}
              </span>
            </Link>
          )
        }

        return button
      })}
    </div>
  )
}

// ── Full-width grid variant with descriptions ─────────────────────────────────
export function QuestionTypeGrid({
  topicSlug,
  counts,
  activeType,
  onSelect,
  className = '',
}: Omit<QuestionTypeButtonsProps, 'layout' | 'showDescriptions'>) {
  const [hovered, setHovered] = useState<QuestionType | null>(null)

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {questionTypeConfig.map(config => {
        const count = counts?.[config.id]
        const isActive = activeType === config.id
        const isHovered = hovered === config.id

        const href = `/articles/${topicSlug}/${config.id}`

        const inner = (
          <>
            {/* Top: Icon + count */}
            <div className="flex items-start justify-between mb-3">
              <div className={[
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150',
                isActive || isHovered
                  ? `${config.text.replace('text-', 'bg-').replace('-700', '-100').replace('-600', '-100')}`
                  : 'bg-slate-100',
              ].join(' ')}>
                <span className={isActive || isHovered ? config.text : 'text-slate-500'}>
                  {config.icon}
                </span>
              </div>
              {count !== undefined && (
                <span className="text-xs font-mono font-semibold text-slate-400">
                  {count}
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className={[
              'font-semibold text-sm mb-1 transition-colors duration-150',
              isActive ? config.text : 'text-navy-950',
            ].join(' ')}>
              {config.label}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {config.sublabel}
            </p>
            <p className="text-xs text-slate-400 line-clamp-2">
              {config.description}
            </p>

            {/* Hover/active arrow */}
            <div className={[
              'mt-3 flex items-center gap-1 text-xs font-medium transition-all duration-150',
              isActive || isHovered ? config.text : 'text-transparent',
            ].join(' ')}>
              <span>Start practising</span>
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </>
        )

        if (onSelect) {
          return (
            <button
              key={config.id}
              onClick={() => onSelect(config.id)}
              onMouseEnter={() => setHovered(config.id)}
              onMouseLeave={() => setHovered(null)}
              className={[
                'group relative text-left p-5 rounded-xl border-2 transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
                isActive
                  ? `${config.accent} bg-white shadow-md`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
              ].join(' ')}
              aria-pressed={isActive}
            >
              {inner}
            </button>
          )
        }

        return (
          <Link
            key={config.id}
            href={href}
            onMouseEnter={() => setHovered(config.id)}
            onMouseLeave={() => setHovered(null)}
            className={[
              'group relative block p-5 rounded-xl border-2 transition-all duration-200 no-underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
              isActive
                ? `${config.accent} bg-white shadow-md`
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
            ].join(' ')}
          >
            {inner}
          </Link>
        )
      })}
    </div>
  )
}

// ── Standalone tab-style switcher ─────────────────────────────────────────────
interface QuestionTypeTabsProps {
  activeType: QuestionType
  onSelect: (type: QuestionType) => void
  counts?: Partial<Record<QuestionType, number>>
  className?: string
}

export function QuestionTypeTabs({
  activeType,
  onSelect,
  counts,
  className = '',
}: QuestionTypeTabsProps) {
  return (
    <div
      className={`inline-flex items-center bg-slate-100 rounded-lg p-1 gap-0.5 ${className}`}
      role="tablist"
    >
      {questionTypeConfig.map(config => {
        const isActive = activeType === config.id
        const count = counts?.[config.id]
        return (
          <button
            key={config.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(config.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
              isActive
                ? 'bg-white text-navy-950 shadow-xs'
                : 'text-slate-500 hover:text-navy-950',
            ].join(' ')}
          >
            <span className={isActive ? config.text : ''}>{config.icon}</span>
            <span>{config.label}</span>
            {count !== undefined && (
              <span className={`text-2xs rounded-full px-1.5 py-0.5 font-mono ${
                isActive ? 'bg-navy-100 text-navy-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default QuestionTypeButtons
