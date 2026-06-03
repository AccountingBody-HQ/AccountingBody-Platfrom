'use client'

import React from 'react'
import { useETLanguage, Language } from './ETLanguageContext'

const languages: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'am', label: 'አማ' },
  { code: 'om', label: 'OM' },
]

export function LanguageSwitcher() {
  const { language, setLanguage } = useETLanguage()

  return (
    <div className="flex items-center gap-0.5 ml-2" aria-label="Select language">
      {languages.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLanguage(code)}
          className={[
            'px-2 py-1 rounded text-xs font-semibold transition-colors duration-150',
            language === code
              ? 'bg-gold-500 text-white'
              : 'text-navy-950 hover:bg-slate-100',
          ].join(' ')}
          aria-pressed={language === code}
          aria-label={`Switch to ${code}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
