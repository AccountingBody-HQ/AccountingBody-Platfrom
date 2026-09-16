import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary: Deep Navy ─────────────────────────────────────
        // Authority, trust, gravitas — inspired by the Financial Times
        navy: {
          50:  '#f0f3fa',
          100: '#dde4f2',
          200: '#c3cfe8',
          300: '#9aafda',
          400: '#6b87c7',
          500: '#4c67b6',
          600: '#3a4f9a',
          700: '#30407e',
          800: '#2b3768',
          900: '#1a2346',
          950: '#0C1A3D',  // PRIMARY — the brand anchor
        },

        // ── Accent: Warm Gold ──────────────────────────────────────
        // Premium CTAs, highlights, exam badges, progress indicators
        gold: {
          50:  '#fdf9ec',
          100: '#faf1cc',
          200: '#f5e095',
          300: '#efc85d',
          400: '#e8b030',
          500: '#D4A017',  // PRIMARY ACCENT
          600: '#b87d10',
          700: '#935c11',
          800: '#794915',
          900: '#663c15',
          950: '#3b1f07',
        },

        // ── Neutral: Warm Slate ────────────────────────────────────
        // Body text, borders, surfaces — warm white, never clinical
        slate: {
          50:  '#F8F7F4',  // Page background — warm off-white
          100: '#f1f0ec',
          200: '#e4e2db',
          300: '#ccc9bf',
          400: '#b0ac9f',
          500: '#928e80',
          600: '#787367',
          700: '#615d53',
          800: '#504d46',
          900: '#433f38',
          950: '#24211c',
        },

        // ── Supporting: Teal ───────────────────────────────────────
        // Progress, success, "verified", study completion
        teal: {
          50:  '#f0fdfb',
          100: '#ccfbf4',
          200: '#99f5e8',
          300: '#5be8d6',
          400: '#2dd0bc',
          500: '#14b4a3',
          600: '#0d9185',
          700: '#10736b',
          800: '#125c57',
          900: '#134c47',
          950: '#042f2c',
        },

        // ── Supporting: Crimson ────────────────────────────────────
        // Errors, warnings, "incorrect answer" states
        crimson: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },

        // ── Semantic aliases ───────────────────────────────────────
        brand:   '#0C1A3D',
        accent:  '#D4A017',
        surface: '#F8F7F4',
      },

      fontFamily: {
        // Display: DM Serif Display — editorial gravitas for headings
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        // Body: DM Sans — clean, modern, highly legible, pairs with DM Serif
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        // Mono: JetBrains Mono — for code, formulas, accounting figures
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '0.875rem', letterSpacing: '0.04em' }],
        xs:   ['0.75rem',   { lineHeight: '1.125rem' }],
        sm:   ['0.875rem',  { lineHeight: '1.375rem' }],
        base: ['1rem',      { lineHeight: '1.7rem' }],
        lg:   ['1.125rem',  { lineHeight: '1.8rem' }],
        xl:   ['1.25rem',   { lineHeight: '1.875rem' }],
        '2xl':['1.5rem',    { lineHeight: '2.1rem' }],
        '3xl':['1.875rem',  { lineHeight: '2.4rem',  letterSpacing: '-0.01em' }],
        '4xl':['2.25rem',   { lineHeight: '2.75rem', letterSpacing: '-0.015em' }],
        '5xl':['3rem',      { lineHeight: '3.5rem',  letterSpacing: '-0.02em' }],
        '6xl':['3.75rem',   { lineHeight: '4.25rem', letterSpacing: '-0.025em' }],
        '7xl':['4.5rem',    { lineHeight: '5rem',    letterSpacing: '-0.03em' }],
        '8xl':['6rem',      { lineHeight: '6.5rem',  letterSpacing: '-0.04em' }],
      },

      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
        '34':  '8.5rem',
        '38':  '9.5rem',
        '42':  '10.5rem',
        '50':  '12.5rem',
        '54':  '13.5rem',
        '58':  '14.5rem',
        '68':  '17rem',
        '76':  '19rem',
        '84':  '21rem',
        '88':  '22rem',
        '92':  '23rem',
        '100': '25rem',
        '104': '26rem',
        '112': '28rem',
        '120': '30rem',
        '128': '32rem',
        '136': '34rem',
        '144': '36rem',
      },

      borderRadius: {
        none: '0',
        xs:   '0.1875rem',
        sm:   '0.25rem',
        DEFAULT:'0.375rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '1rem',
        '2xl':'1.25rem',
        '3xl':'1.5rem',
        '4xl':'2rem',
        full: '9999px',
      },

      boxShadow: {
        xs:    '0 1px 2px 0 rgb(12 26 61 / 0.05)',
        sm:    '0 1px 3px 0 rgb(12 26 61 / 0.08), 0 1px 2px -1px rgb(12 26 61 / 0.06)',
        DEFAULT:'0 4px 6px -1px rgb(12 26 61 / 0.08), 0 2px 4px -2px rgb(12 26 61 / 0.06)',
        md:    '0 6px 14px -2px rgb(12 26 61 / 0.1), 0 3px 6px -3px rgb(12 26 61 / 0.07)',
        lg:    '0 12px 28px -4px rgb(12 26 61 / 0.12), 0 6px 12px -4px rgb(12 26 61 / 0.06)',
        xl:    '0 20px 40px -8px rgb(12 26 61 / 0.15), 0 8px 20px -6px rgb(12 26 61 / 0.08)',
        '2xl': '0 32px 64px -12px rgb(12 26 61 / 0.18)',
        '3xl': '0 48px 96px -16px rgb(12 26 61 / 0.22)',
        gold:  '0 4px 14px 0 rgb(212 160 23 / 0.35)',
        'gold-lg':'0 8px 30px 0 rgb(212 160 23 / 0.28)',
        teal:  '0 4px 14px 0 rgb(20 180 163 / 0.3)',
        inner: 'inset 0 2px 4px 0 rgb(12 26 61 / 0.06)',
        'inner-lg':'inset 0 4px 8px 0 rgb(12 26 61 / 0.1)',
        none:  'none',
      },

      backgroundImage: {
        'gradient-navy':   'linear-gradient(135deg, #0C1A3D 0%, #1a2e5a 50%, #0d2060 100%)',
        'gradient-gold':   'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)',
        'gradient-surface':'linear-gradient(180deg, #F8F7F4 0%, #ffffff 60%, #F8F7F4 100%)',
        'gradient-hero':   'linear-gradient(135deg, #0C1A3D 0%, #1e3a7a 65%, #0a1e50 100%)',
        'gradient-card':   'linear-gradient(180deg, rgba(248,247,244,0) 0%, rgba(12,26,61,0.04) 100%)',
        'gradient-gold-subtle':'linear-gradient(135deg, rgba(212,160,23,0.08) 0%, rgba(212,160,23,0.02) 100%)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-from), var(--tw-gradient-to))',
        // Subtle noise texture overlay (no external files)
        'noise': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
      },

      animation: {
        'ticker':   'ticker 50s linear infinite',
        'fade-in':  'fadeIn 0.5s ease-out forwards',
        'fade-up':  'fadeUp 0.5s cubic-bezier(0,0,0.2,1) forwards',
        'slide-down':'slideDown 0.25s cubic-bezier(0,0,0.2,1) forwards',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'shimmer':  'shimmer 2.5s ease-in-out infinite',
        'pulse-soft':'pulseSoft 3s ease-in-out infinite',
      },

      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(1.02)', opacity: '0.9' },
        },
      },

      screens: {
        xs:   '480px',
        sm:   '640px',
        md:   '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl':'1440px',
        '3xl':'1600px',
      },

      transitionTimingFunction: {
        smooth:     'cubic-bezier(0.4, 0, 0.2, 1)',
        spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
        decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp:      'cubic-bezier(0.4, 0, 0.6, 1)',
      },

      maxWidth: {
        '8xl':  '88rem',
        '9xl':  '96rem',
        '10xl': '104rem',
      },

      zIndex: {
        'ticker': '10',
        'nav':    '50',
        'overlay':'60',
        'modal':  '70',
        'toast':  '80',
      },
    },
  },
  plugins: [],
}

export default config
