// components/ui/Badge.tsx
// AccountingBody Design System — Badge Component
// Variants: category, difficulty, examBody, status, count, tag

import React from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'category'      // Content category: Tax, Audit, Financial Reporting…
  | 'difficulty'    // Easy / Medium / Hard / Exam Standard
  | 'status'        // New / Updated / Premium / Free / Coming Soon
  | 'exam-body'     // ACCA / CIMA / AAT etc — uses brand colours
  | 'tag'           // Generic tag — neutral
  | 'count'         // Number count (e.g. question count)
  | 'subject'       // Paper / subject code: F3, P1, AAT-L3…
  | 'outline'       // Outline/border only

type BadgeSize = 'xs' | 'sm' | 'md'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean         // Show coloured dot before text
  icon?: React.ReactNode
  className?: string
  onClick?: () => void
}

// ── Size styles ───────────────────────────────────────────────────────────────
const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-2xs px-1.5 py-0.5 gap-1',
  sm: 'text-xs  px-2   py-0.5 gap-1.5',
  md: 'text-xs  px-2.5 py-1   gap-1.5',
}

// ── Variant styles ────────────────────────────────────────────────────────────
const variantStyles: Record<BadgeVariant, string> = {
  category:   'bg-navy-50    text-navy-700   border border-navy-200',
  difficulty: 'bg-slate-100  text-slate-700  border border-slate-200',
  status:     'bg-teal-50    text-teal-700   border border-teal-200',
  'exam-body':'bg-navy-950   text-white       border border-navy-900',
  tag:        'bg-slate-100  text-slate-600  border border-slate-200',
  count:      'bg-navy-100   text-navy-800   border border-navy-200  tabular-nums',
  subject:    'bg-gold-50    text-gold-600   border border-gold-200  font-mono',
  outline:    'bg-transparent text-navy-700  border border-navy-300',
}

// ── Main Badge ────────────────────────────────────────────────────────────────
export function Badge({
  children,
  variant = 'tag',
  size = 'sm',
  dot,
  icon,
  className = '',
  onClick,
}: BadgeProps) {
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      className={[
        'inline-flex items-center justify-center rounded-full font-medium leading-none whitespace-nowrap',
        sizeStyles[size],
        variantStyles[variant],
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className,
      ].join(' ')}
      onClick={onClick}
    >
      {dot && (
        <span className={[
          'rounded-full shrink-0',
          size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2',
          'bg-current opacity-70',
        ].join(' ')} />
      )}
      {icon && <span className="shrink-0 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>}
      {children}
    </Tag>
  )
}

// ── Exam Body Badge ───────────────────────────────────────────────────────────
// Each professional body gets its exact brand colour

const examBodyConfig: Record<string, { bg: string; text: string; border: string; abbr: string }> = {
  ACCA:  { bg: '#004B8D', text: '#ffffff', border: '#003d75', abbr: 'ACCA'  },
  CIMA:  { bg: '#0081C6', text: '#ffffff', border: '#006daa', abbr: 'CIMA'  },
  AAT:   { bg: '#00857A', text: '#ffffff', border: '#006d65', abbr: 'AAT'   },
  ICAEW: { bg: '#003087', text: '#ffffff', border: '#00256b', abbr: 'ICAEW' },
  ACA:   { bg: '#003087', text: '#ffffff', border: '#00256b', abbr: 'ACA'   },
  CFAB:  { bg: '#4a2885', text: '#ffffff', border: '#3a1e6e', abbr: 'CFAB'  },
  ACCA_F:{ bg: '#004B8D', text: '#ffffff', border: '#003d75', abbr: 'ACCA Foundation' },
}

interface ExamBodyBadgeProps {
  body: string
  size?: BadgeSize
  showDot?: boolean
  className?: string
}

export function ExamBodyBadge({
  body,
  size = 'sm',
  className = '',
}: ExamBodyBadgeProps) {
  const config = examBodyConfig[body.toUpperCase()]

  if (config) {
    return (
      <span
        className={[
          'inline-flex items-center justify-center rounded-full font-semibold leading-none whitespace-nowrap',
          sizeStyles[size],
          className,
        ].join(' ')}
        style={{
          backgroundColor: config.bg,
          color: config.text,
          border: `1px solid ${config.border}`,
        }}
      >
        {config.abbr}
      </span>
    )
  }

  // Fallback for unknown exam bodies
  return (
    <Badge variant="exam-body" size={size} className={className}>
      {body}
    </Badge>
  )
}

// ── Difficulty Badge ──────────────────────────────────────────────────────────
const difficultyConfig = {
  Easy:           { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',   dot: 'bg-teal-500'    },
  Medium:         { bg: 'bg-gold-50',    text: 'text-gold-600',    border: 'border-gold-200',   dot: 'bg-gold-500'    },
  Hard:           { bg: 'bg-crimson-50', text: 'text-crimson-700', border: 'border-crimson-200',dot: 'bg-crimson-500' },
  'Exam Standard':{ bg: 'bg-navy-950',   text: 'text-white',       border: 'border-navy-900',   dot: 'bg-gold-500'    },
}

interface DifficultyBadgeProps {
  level: 'Easy' | 'Medium' | 'Hard' | 'Exam Standard'
  size?: BadgeSize
  className?: string
}

export function DifficultyBadge({ level, size = 'sm', className = '' }: DifficultyBadgeProps) {
  const config = difficultyConfig[level]
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap border',
        sizeStyles[size],
        config.bg, config.text, config.border,
        className,
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {level}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
const statusConfig = {
  New:           { bg: 'bg-teal-500',   text: 'text-white',       border: 'border-teal-600'    },
  Updated:       { bg: 'bg-gold-50',    text: 'text-gold-700',    border: 'border-gold-300'    },
  Premium:       { bg: 'bg-gold-500',   text: 'text-navy-950',    border: 'border-gold-400'    },
  Free:          { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
  'Coming Soon': { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-300'   },
  Pro:           { bg: 'bg-navy-950',   text: 'text-white',       border: 'border-navy-800'    },
  Live:          { bg: 'bg-teal-500',   text: 'text-white',       border: 'border-teal-600'    },
  Draft:         { bg: 'bg-slate-200',  text: 'text-slate-600',   border: 'border-slate-300'   },
}

type StatusType = keyof typeof statusConfig

interface StatusBadgeProps {
  status: StatusType
  size?: BadgeSize
  animate?: boolean   // Pulsing dot for Live
  className?: string
}

export function StatusBadge({ status, size = 'sm', animate = false, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status]
  const isLive = status === 'Live' && animate

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap border',
        sizeStyles[size],
        config.bg, config.text, config.border,
        className,
      ].join(' ')}
    >
      {isLive && (
        <span className="relative flex w-2 h-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
          <span className="relative inline-flex rounded-full w-2 h-2 bg-white" />
        </span>
      )}
      {status}
    </span>
  )
}

// ── Category Badge ────────────────────────────────────────────────────────────
// Specific category colours for accounting/finance topics
const categoryColours: Record<string, string> = {
  'Financial Reporting':   'bg-navy-50  text-navy-700  border-navy-200',
  'Taxation':              'bg-gold-50  text-gold-600  border-gold-200',
  'Audit & Assurance':     'bg-teal-50  text-teal-700  border-teal-200',
  'Management Accounting': 'bg-slate-100 text-slate-700 border-slate-300',
  'Corporate Finance':     'bg-navy-100 text-navy-800  border-navy-300',
  'Business Law':          'bg-crimson-50 text-crimson-700 border-crimson-200',
  'Ethics':                'bg-teal-50  text-teal-700  border-teal-100',
  'Performance Management':'bg-gold-50  text-gold-700  border-gold-200',
  'Business Strategy':     'bg-navy-50  text-navy-700  border-navy-200',
  'Bookkeeping':           'bg-slate-50 text-slate-600  border-slate-200',
}

interface CategoryBadgeProps {
  category: string
  size?: BadgeSize
  className?: string
  onClick?: () => void
}

export function CategoryBadge({ category, size = 'sm', className = '', onClick }: CategoryBadgeProps) {
  const colours = categoryColours[category] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      className={[
        'inline-flex items-center justify-center rounded-full font-medium leading-none whitespace-nowrap border',
        sizeStyles[size],
        colours,
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        className,
      ].join(' ')}
      onClick={onClick}
    >
      {category}
    </Tag>
  )
}

// ── Subject Code Badge ────────────────────────────────────────────────────────
// For specific paper codes: F3, P1, AAT Level 3, etc.
interface SubjectBadgeProps {
  code: string
  examBody?: string
  size?: BadgeSize
  className?: string
}

export function SubjectBadge({ code, examBody, size = 'sm', className = '' }: SubjectBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded font-mono font-semibold leading-none whitespace-nowrap',
        'bg-navy-950 text-gold-400 border border-navy-800 px-2 py-0.5',
        size === 'xs' ? 'text-2xs' : 'text-xs',
        className,
      ].join(' ')}
    >
      {examBody && <span className="text-white/50">{examBody}</span>}
      {examBody && <span className="text-white/30">·</span>}
      {code}
    </span>
  )
}

// ── Badge Group ───────────────────────────────────────────────────────────────
interface BadgeGroupProps {
  children: React.ReactNode
  className?: string
  wrap?: boolean
}

export function BadgeGroup({ children, className = '', wrap = true }: BadgeGroupProps) {
  return (
    <div
      className={[
        'flex items-center gap-1.5',
        wrap ? 'flex-wrap' : 'overflow-hidden',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export default Badge
