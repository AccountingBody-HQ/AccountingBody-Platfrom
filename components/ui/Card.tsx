// components/ui/Card.tsx
// AccountingBody Design System — Card Components
// Exports: ArticleCard, CourseCard, PracticeCard, StatCard, BaseCard

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Badge, ExamBodyBadge } from './Badge'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ArticleCardProps {
  title: string
  excerpt?: string
  slug: string
  category?: string
  examBody?: string
  readTime?: number
  publishedAt?: string
  author?: { name: string; avatar?: string }
  coverImage?: string
  featured?: boolean
  questionTypes?: ('mcq' | 'learn' | 'writing' | 'scenario')[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export interface CourseCardProps {
  title: string
  description?: string
  slug: string
  examBody?: string
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional'
  lessonCount?: number
  questionCount?: number
  duration?: string
  progress?: number   // 0-100
  enrolled?: boolean
  image?: string
  tags?: string[]
  className?: string
}

export interface PracticeCardProps {
  title: string
  description?: string
  slug: string
  examBody?: string
  subject?: string
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Exam Standard'
  questionCount?: number
  timeLimit?: number   // minutes
  attempts?: number
  bestScore?: number   // percentage
  type?: 'mcq-bank' | 'mock-exam' | 'topic-test' | 'past-paper'
  className?: string
}

// ── Helper: Reading time display ───────────────────────────────────────────────
function ReadTime({ minutes }: { minutes: number }) {
  return (
    <span className="flex items-center gap-1 text-slate-500 text-xs">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
      {minutes} min read
    </span>
  )
}

// ── Helper: Question type icon pills ──────────────────────────────────────────
const qTypeConfig = {
  mcq:      { label: 'MCQ',      bg: 'bg-navy-50   text-navy-700   border-navy-200' },
  learn:    { label: 'Learn',    bg: 'bg-teal-50   text-teal-700   border-teal-200' },
  writing:  { label: 'Writing',  bg: 'bg-gold-50   text-gold-600   border-gold-200' },
  scenario: { label: 'Scenario', bg: 'bg-slate-100 text-slate-700  border-slate-300' },
}

function QuestionTypePills({ types }: { types: ArticleCardProps['questionTypes'] }) {
  if (!types?.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {types.map(t => (
        <span
          key={t}
          className={`text-2xs font-medium px-2 py-0.5 rounded-full border ${qTypeConfig[t].bg}`}
        >
          {qTypeConfig[t].label}
        </span>
      ))}
    </div>
  )
}

// ── Helper: Progress bar ──────────────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  const color =
    clamped === 100 ? 'bg-teal-500' :
    clamped > 50    ? 'bg-gold-500'  :
                      'bg-navy-400'
  return (
    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

// ── ARTICLE CARD ──────────────────────────────────────────────────────────────
export function ArticleCard({
  title,
  excerpt,
  slug,
  category,
  examBody,
  readTime,
  publishedAt,
  author,
  coverImage,
  featured = false,
  questionTypes,
  className = '',
  size = 'md',
}: ArticleCardProps) {
  const isFeatured = featured && size === 'lg'

  return (
    <article
      className={[
        'group card-base flex flex-col bg-white',
        isFeatured && 'md:flex-row md:col-span-2',
        className,
      ].join(' ')}
    >
      {/* Cover image */}
      {coverImage && (
        <Link
          href={`/articles/${slug}`}
          className={[
            'block overflow-hidden bg-slate-100 shrink-0',
            isFeatured ? 'md:w-96 aspect-article md:aspect-auto' : 'aspect-article',
          ].join(' ')}
          tabIndex={-1}
        >
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </Link>
      )}

      {/* Content */}
      <div className={[
        'flex flex-col flex-1 p-5',
        size === 'lg' && 'p-6',
        size === 'sm' && 'p-4',
      ].join(' ')}>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {category && <Badge variant="category">{category}</Badge>}
          {examBody && <ExamBodyBadge body={examBody} />}
        </div>

        {/* Title */}
        <Link href={`/articles/${slug}`} className="block group/title mb-2">
          <h3 className={[
            'font-display text-navy-950 leading-snug',
            'group-hover/title:text-navy-700 transition-colors duration-150',
            size === 'sm' && 'text-base',
            size === 'md' && 'text-lg',
            size === 'lg' && 'text-2xl',
          ].join(' ')}>
            {title}
          </h3>
        </Link>

        {/* Excerpt */}
        {excerpt && size !== 'sm' && (
          <p className="text-sm text-slate-600 line-clamp-2 mb-3 flex-1">
            {excerpt}
          </p>
        )}

        {/* Question type pills */}
        <QuestionTypePills types={questionTypes} />

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {author?.avatar ? (
              <Image
                src={author.avatar}
                alt={author.name}
                width={24} height={24}
                className="rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-navy-100 flex items-center justify-center">
                <span className="text-2xs font-semibold text-navy-700">
                  {author?.name?.[0] ?? 'A'}
                </span>
              </div>
            )}
            {author && (
              <span className="text-xs text-slate-600 font-medium">{author.name}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {readTime && <ReadTime minutes={readTime} />}
            {publishedAt && (
              <span className="text-xs text-slate-400">{publishedAt}</span>
            )}
          </div>
        </div>
      </div>

      {/* Featured accent bar */}
      {featured && (
        <div className="h-1 bg-gradient-gold rounded-b-xl" />
      )}
    </article>
  )
}

// ── COURSE CARD ───────────────────────────────────────────────────────────────
export function CourseCard({
  title,
  description,
  slug,
  examBody,
  level,
  lessonCount,
  questionCount,
  duration,
  progress,
  enrolled = false,
  image,
  tags,
  className = '',
}: CourseCardProps) {
  const levelColour = {
    Beginner:     'bg-teal-50  text-teal-700  border-teal-200',
    Intermediate: 'bg-gold-50  text-gold-600  border-gold-200',
    Advanced:     'bg-navy-50  text-navy-700  border-navy-200',
    Professional: 'bg-navy-950 text-white      border-navy-900',
  }

  return (
    <article className={`group card-base bg-white flex flex-col ${className}`}>
      {/* Course image / colour block */}
      <Link
        href={`/courses/${slug}`}
        className="block aspect-[16/7] overflow-hidden bg-gradient-navy relative"
        tabIndex={-1}
      >
        {image ? (
          <Image
            src={image} alt={title} fill
            className="object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          /* Decorative pattern for courses without images */
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="absolute inset-0 opacity-10">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full border border-white/30"
                  style={{
                    width: `${(i + 1) * 20}%`,
                    height: `${(i + 1) * 20}%`,
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
            </div>
            {examBody && (
              <span className="relative z-10 text-white/80 text-xs font-mono font-semibold tracking-widest uppercase">
                {examBody}
              </span>
            )}
          </div>
        )}
        {/* Level pill — overlaid */}
        {level && (
          <div className="absolute top-3 left-3">
            <span className={`pill border text-2xs font-semibold ${levelColour[level]}`}>
              {level}
            </span>
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5">
        {/* Exam body */}
        {examBody && (
          <div className="mb-2">
            <ExamBodyBadge body={examBody} />
          </div>
        )}

        {/* Title */}
        <Link href={`/courses/${slug}`} className="block mb-2">
          <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
            {title}
          </h3>
        </Link>

        {/* Description */}
        {description && (
          <p className="text-sm text-slate-600 line-clamp-2 mb-4 flex-1">
            {description}
          </p>
        )}

        {/* Tags */}
        {tags?.length && (
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Progress bar (enrolled courses) */}
        {enrolled && progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Progress</span>
              <span className="font-medium text-navy-700">{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
          {lessonCount !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {lessonCount} lessons
            </span>
          )}
          {questionCount !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {questionCount} Qs
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1 ml-auto">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
              </svg>
              {duration}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

// ── PRACTICE CARD ─────────────────────────────────────────────────────────────
export function PracticeCard({
  title,
  description,
  slug,
  examBody,
  subject,
  difficulty,
  questionCount,
  timeLimit,
  attempts,
  bestScore,
  type = 'mcq-bank',
  className = '',
}: PracticeCardProps) {
  const difficultyConfig = {
    Easy:          { dot: 'bg-teal-500',   text: 'text-teal-700',   bg: 'bg-teal-50'  },
    Medium:        { dot: 'bg-gold-500',   text: 'text-gold-600',   bg: 'bg-gold-50'  },
    Hard:          { dot: 'bg-crimson-500',text: 'text-crimson-700',bg: 'bg-crimson-50'},
    'Exam Standard':{ dot: 'bg-navy-700',  text: 'text-navy-700',   bg: 'bg-navy-50'  },
  }

  const typeConfig = {
    'mcq-bank':   { label: 'Question Bank', icon: '≡',    accent: 'border-l-navy-500' },
    'mock-exam':  { label: 'Mock Exam',      icon: '✦',    accent: 'border-l-gold-500' },
    'topic-test': { label: 'Topic Test',     icon: '◎',    accent: 'border-l-teal-500' },
    'past-paper': { label: 'Past Paper',     icon: '◷',    accent: 'border-l-navy-300' },
  }

  const tc = typeConfig[type]
  const dc = difficulty ? difficultyConfig[difficulty] : null

  return (
    <article
      className={[
        'group card-base bg-white flex flex-col',
        'border-l-4', tc.accent,
        className,
      ].join(' ')}
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {examBody && <ExamBodyBadge body={examBody} />}
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {tc.icon} {tc.label}
            </span>
          </div>
          {dc && (
            <span className={`flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full ${dc.bg} ${dc.text} shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dc.dot}`} />
              {difficulty}
            </span>
          )}
        </div>

        {/* Subject */}
        {subject && (
          <p className="text-2xs font-semibold text-gold-600 uppercase tracking-widest mb-1">
            {subject}
          </p>
        )}

        {/* Title */}
        <Link href={`/practice/${slug}`} className="block mb-2">
          <h3 className="font-display text-base text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
            {title}
          </h3>
        </Link>

        {description && (
          <p className="text-sm text-slate-600 line-clamp-2 mb-4 flex-1">
            {description}
          </p>
        )}

        {/* Best score */}
        {bestScore !== undefined && (
          <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500">Best score</span>
              <span className={`font-bold text-sm ${
                bestScore >= 70 ? 'text-teal-600' :
                bestScore >= 50 ? 'text-gold-600' :
                'text-crimson-600'
              }`}>
                {bestScore}%
              </span>
            </div>
            <ProgressBar value={bestScore} />
          </div>
        )}

        {/* Stats footer */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500 mt-auto">
          {questionCount !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {questionCount} questions
            </span>
          )}
          {timeLimit !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
              </svg>
              {timeLimit} min
            </span>
          )}
          {attempts !== undefined && (
            <span className="ml-auto text-2xs">
              {attempts} attempt{attempts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  value: string
  label: string
  sublabel?: string
  icon?: React.ReactNode
  variant?: 'default' | 'navy' | 'gold'
  className?: string
}

export function StatCard({
  value,
  label,
  sublabel,
  icon,
  variant = 'default',
  className = '',
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-white border border-slate-200',
    navy:    'bg-navy-950 text-white border-navy-900',
    gold:    'bg-gold-500 text-navy-950 border-gold-400',
  }

  return (
    <div className={`rounded-xl p-6 ${variantStyles[variant]} ${className}`}>
      {icon && (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
          variant === 'navy' ? 'bg-white/10' :
          variant === 'gold' ? 'bg-navy-950/10' :
          'bg-navy-50'
        }`}>
          {icon}
        </div>
      )}
      <div className={`stat-number mb-1 ${
        variant === 'navy' ? 'text-white' :
        variant === 'gold' ? 'text-navy-950' :
        ''
      }`}>
        {value}
      </div>
      <p className={`text-sm font-medium ${
        variant === 'navy' ? 'text-white/80' :
        variant === 'gold' ? 'text-navy-800' :
        'text-slate-700'
      }`}>
        {label}
      </p>
      {sublabel && (
        <p className={`text-xs mt-1 ${
          variant === 'navy' ? 'text-white/70' :
          variant === 'gold' ? 'text-navy-600' :
          'text-slate-400'
        }`}>
          {sublabel}
        </p>
      )}
    </div>
  )
}

// ── BASE CARD ─────────────────────────────────────────────────────────────────
interface BaseCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export function BaseCard({
  children,
  className = '',
  padding = 'md',
  hover = true,
}: BaseCardProps) {
  const paddingMap = {
    none: '',
    sm:   'p-4',
    md:   'p-5',
    lg:   'p-6 md:p-8',
  }

  return (
    <div
      className={[
        'bg-white border border-slate-200 rounded-xl',
        hover && 'hover-lift',
        paddingMap[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export default ArticleCard
