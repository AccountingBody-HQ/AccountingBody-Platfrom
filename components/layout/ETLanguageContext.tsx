'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'en' | 'am' | 'om'

export const translations = {
  en: {
    getHelp:            'Get Help',
    company:            'Company',
    search:             'Search articles, questions, glossary…',
    searchMobile:       'Search',
    openMenu:           'Open menu',
    closeMenu:          'Close menu',
    explore:            'Explore',
    featured:           'Featured',
    languageLabel:      'Language',
  },
  am: {
    getHelp:            'ሴል ይዘየቡ',
    company:            'ወገን',
    search:             'ወቃድን ይዳሽጉ…',
    searchMobile:       'ወቃድን',
    openMenu:           'ሜኒውን ይዘይ',
    closeMenu:          'ሜኒውን ይዘጉ',
    explore:            'አስሳሽፕ',
    featured:           'የተመረጠ',
    languageLabel:      'ንጭ ቀንድ',
  },
  om: {
    getHelp:            'Gargaarsa Argadhu',
    company:            'Dhaabbata',
    search:             'Barbaadi…',
    searchMobile:       'Barbaadi',
    openMenu:           'Filannoowwan Bani',
    closeMenu:          'Filannoowwan Cuf',
    explore:            'Qo\u2019adhu',
    featured:           'Filatamaa',
    languageLabel:      'Afaan',
  },
}

interface LanguageContextValue {
  language:    Language
  setLanguage: (lang: Language) => void
  t:           (key: keyof typeof translations['en']) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language:    'en',
  setLanguage: () => {},
  t:           (key) => translations['en'][key],
})

const COOKIE_NAME = 'et_language'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

export function ETLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME)
    if (saved === 'am' || saved === 'om' || saved === 'en') {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setCookie(COOKIE_NAME, lang)
  }

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] ?? translations['en'][key]
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useETLanguage() {
  return useContext(LanguageContext)
}
