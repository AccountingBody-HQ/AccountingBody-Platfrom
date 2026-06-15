'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type Language = 'en' | 'am' | 'om'

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

function setCookie(name: string, value: string) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

function setGoogTransCookie(langCode: string) {
  if (typeof document === 'undefined') return
  if (langCode === 'en') {
    // Remove googtrans cookie to restore English
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';'
  } else {
    const value = '/en/' + langCode
    document.cookie = 'googtrans=' + value + '; path=/;'
    document.cookie = 'googtrans=' + value + '; path=/; domain=' + window.location.hostname + ';'
  }
  // Show gold progress bar before reload (ET only — destroyed by reload)
  const bar = document.createElement('div')
  bar.style.cssText = 'position:fixed;top:0;left:0;width:0%;height:3px;background:#D4A017;z-index:9999;pointer-events:none;transition:width 0.4s ease;'
  document.body.appendChild(bar)
  void bar.offsetWidth
  bar.style.width = '80%'
  setTimeout(() => window.location.reload(), 50)
}

function detectCurrentLanguage(): Language {
  if (typeof document === 'undefined') return 'en'
  const match = document.cookie.match(/googtrans=\/en\/([a-z]+)/)
  if (match) {
    const code = match[1]
    if (code === 'am') return 'am'
    if (code === 'om') return 'om'
  }
  return 'en'
}

export function ETLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    // Detect language from googtrans cookie on load
    const current = detectCurrentLanguage()
    setLanguageState(current)
    // Also sync our own cookie
    setCookie(COOKIE_NAME, current)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    setCookie(COOKIE_NAME, lang)
    setGoogTransCookie(GT_CODES[lang])
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
