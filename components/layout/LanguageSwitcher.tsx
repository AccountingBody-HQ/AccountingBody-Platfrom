'use client'

import React from 'react'
import { useETLanguage, Language } from './ETLanguageContext'

const languages: { code: Language; label: string; full: string }[] = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'am', label: 'አማ', full: 'አማርኛ' },
  { code: 'om', label: 'OM', full: 'Afaan Oromoo' },
]

// ── Desktop switcher — pill toggle in nav bar ─────────────────────────────────
export function LanguageSwitcher() {
  const { language, setLanguage } = useETLanguage()

  return (
    <div
      className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 gap-0"
      aria-label="Select language"
      role="group"
    >
      {languages.map(({ code, label, full }) => (
        <button
          key={code}
          onClick={() => setLanguage(code)}
          title={full}
          aria-pressed={language === code}
          aria-label={`Switch to ${full}`}
          className={[
            'relative px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
            language === code
              ? 'bg-[#1A4731] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Mobile switcher — full-width segmented control in drawer ──────────────────
export function MobileLangSwitcher() {
  const { language, setLanguage } = useETLanguage()

  return (
    <div className="w-full px-5 py-3 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
        Language
      </p>
      <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
        {languages.map(({ code, label, full }, i) => (
          <button
            key={code}
            onClick={() => setLanguage(code)}
            aria-pressed={language === code}
            aria-label={`Switch to ${full}`}
            className={[
              'flex-1 flex flex-col items-center justify-center py-2.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500',
              i > 0 ? 'border-l border-slate-200' : '',
              language === code
                ? 'bg-[#1A4731] text-white'
                : 'text-slate-500 hover:bg-slate-100',
            ].join(' ')}
          >
            <span className="text-sm mb-0.5">{label}</span>
            <span className={[
              'text-[10px] font-medium',
              language === code ? 'text-white/70' : 'text-slate-400',
            ].join(' ')}>
              {full}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
