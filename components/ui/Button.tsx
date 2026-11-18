// components/ui/Button.tsx
// AccountingBody Design System — Button Component
// Variants: primary, secondary, ghost, outline, gold, danger, link
// Sizes: xs, sm, md, lg, xl

import React from 'react'
import Link from 'next/link'

type ButtonVariant =
  | 'primary'     // Navy filled — main CTAs
  | 'secondary'   // Gold filled — accent CTAs
  | 'outline'     // Navy border, transparent fill
  | 'ghost'       // No border, subtle hover
  | 'gold'        // Gold filled with shadow — premium CTAs
  | 'danger'      // Crimson — destructive actions
  | 'navy-ghost'  // Inverse ghost — for use on dark backgrounds
  | 'link'        // Inline text link with arrow

type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface ButtonBaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  className?: string
  children?: React.ReactNode
}

type ButtonProps = ButtonBaseProps &
  (
    | (React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
    | ({ href: string; target?: string; rel?: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)
  )

// ── Variant styles ────────────────────────────────────────────────────────────
const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-navy-950 text-white border-transparent',
    'hover:bg-navy-900',
    'active:bg-navy-950',
    'shadow-sm hover:shadow-md',
  ].join(' '),

  secondary: [
    'bg-gold-500 text-navy-950 border-transparent font-semibold',
    'hover:bg-gold-400',
    'active:bg-gold-500',
    'shadow-sm hover:shadow-gold',
  ].join(' '),

  outline: [
    'bg-transparent text-navy-950 border-navy-950',
    'hover:bg-navy-950 hover:text-white',
    'active:bg-navy-900',
  ].join(' '),

  ghost: [
    'bg-transparent text-slate-700 border-transparent',
    'hover:bg-slate-100 hover:text-navy-950',
    'active:bg-slate-200',
  ].join(' '),

  gold: [
    'bg-gold-500 text-navy-950 border-transparent font-semibold',
    'hover:bg-gold-400',
    'active:bg-gold-500',
    'shadow-gold hover:shadow-gold-lg',
    'relative overflow-hidden',
  ].join(' '),

  danger: [
    'bg-crimson-600 text-white border-transparent',
    'hover:bg-crimson-700',
    'active:bg-crimson-800',
    'shadow-sm',
  ].join(' '),

  'navy-ghost': [
    'bg-transparent text-white border-white/30',
    'hover:bg-white/10 hover:border-white/50',
    'active:bg-white/20',
  ].join(' '),

  link: [
    'bg-transparent text-navy-700 border-transparent p-0 h-auto',
    'hover:text-gold-600 underline underline-offset-2',
    'active:text-gold-600',
  ].join(' '),
}

// ── Size styles ──────────────────────────────────────────────────────────────
const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-3 text-xs gap-1.5 rounded',
  sm: 'h-8 px-4 text-sm gap-1.5 rounded',
  md: 'h-10 px-5 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-lg',
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'xs' || size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  return (
    <svg
      className={`${dim} animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ── Arrow icon for "link" variant ─────────────────────────────────────────────
function ArrowRight() {
  return (
    <svg
      className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5"
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      children,
      ...rest
    } = props

    const isLink = variant === 'link'

    const baseStyles = [
      'inline-flex items-center justify-center font-medium',
      'border transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:pointer-events-none',
      'select-none whitespace-nowrap group',
      !isLink && sizeStyles[size],
      variantStyles[variant],
      fullWidth && 'w-full',
      className,
    ].filter(Boolean).join(' ')

    const content = (
      <>
        {loading && <Spinner size={size} />}
        {!loading && icon && iconPosition === 'left' && (
          <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && variant === 'link' && <ArrowRight />}
        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0">{icon}</span>
        )}
      </>
    )

    // Render as <Link> when href is provided
    if ('href' in rest && rest.href !== undefined) {
      const { href, ...linkRest } = rest as { href: string; target?: string; rel?: string }
      const isExternal = href.startsWith('http') || href.startsWith('//')

      return (
        <Link
          href={href}
          className={baseStyles}
          target={isExternal ? '_blank' : linkRest.target}
          rel={isExternal ? 'noopener noreferrer' : linkRest.rel}
          ref={ref as React.Ref<HTMLAnchorElement>}
          {...(linkRest as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)}
        >
          {content}
        </Link>
      )
    }

    const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>

    return (
      <button
        className={baseStyles}
        disabled={loading || buttonRest.disabled}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...buttonRest}
      >
        {content}
      </button>
    )
  }
)

Button.displayName = 'Button'

// ── Button Group ─────────────────────────────────────────────────────────────
interface ButtonGroupProps {
  children: React.ReactNode
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export function ButtonGroup({
  children,
  orientation = 'horizontal',
  className = '',
}: ButtonGroupProps) {
  return (
    <div
      className={[
        'flex',
        orientation === 'horizontal'
          ? 'flex-row items-center flex-wrap gap-3'
          : 'flex-col items-stretch gap-2',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

// ── Icon Button ───────────────────────────────────────────────────────────────
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string  // required for accessibility
  variant?: 'ghost' | 'outline' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: IconButtonProps) {
  const sizeMap = {
    sm: 'w-8 h-8 rounded',
    md: 'w-10 h-10 rounded-md',
    lg: 'w-12 h-12 rounded-lg',
  }

  const variantMap = {
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-navy-950 border-transparent',
    outline: 'bg-transparent text-navy-950 border-slate-300 hover:border-navy-950',
    primary: 'bg-navy-950 text-white border-transparent hover:bg-navy-900',
  }

  return (
    <button
      aria-label={label}
      className={[
        'inline-flex items-center justify-center',
        'border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        sizeMap[size],
        variantMap[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {icon}
    </button>
  )
}

export default Button
