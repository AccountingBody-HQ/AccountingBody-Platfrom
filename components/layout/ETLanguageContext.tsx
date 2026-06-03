'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'en' | 'am' | 'om'

// Google Translate language codes
const GT_CODES: Record<Language, string> = {
  en: 'en',
  am: 'am',
  om: 'om',
}

interface LanguageContextValue {
  language:    Language
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  language:    'en',
  setLanguage: () => {},
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

function triggerGoogleTranslate(langCode: string) {
  if (typeof document === 'undefined') return

  // Find the Google Translate select element
  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null
  if (select) {
    select.value = langCode
    select.dispatchEvent(new Event('change'))
    return
  }

  // If select not ready yet, retry after a short delay
  setTimeout(() => {
    const retrySelect = document.querySelector('.goog-te-combo') as HTMLSelectElement | null
    if (retrySelect) {
      retrySelect.value = langCode
      retrySelect.dispatchEvent(new Event('change'))
    }
  }, 800)
}

export function ETLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME)
    if (saved === 'am' || saved === 'om') {
      setLanguageState(saved as Language)
      // Apply saved language after Google Translate loads
      setTimeout(() => triggerGoogleTranslate(GT_CODES[saved as Language]), 1200)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setCookie(COOKIE_NAME, lang)
    triggerGoogleTranslate(GT_CODES[lang])
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useETLanguage() {
  return useContext(LanguageContext)
}
