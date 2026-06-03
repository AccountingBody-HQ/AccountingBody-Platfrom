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

function triggerGoogleTranslate(langCode: string, attempts = 0) {
  if (typeof document === 'undefined') return

  // For English — restore original page
  if (langCode === 'en') {
    const frame = document.querySelector('.goog-te-banner-frame') as HTMLIFrameElement | null
    if (frame) {
      const btn = frame.contentDocument?.querySelector('.goog-te-banner-close') as HTMLElement | null
      if (btn) { btn.click(); return }
    }
    // Alternative: use the restore original link
    const restoreLink = document.querySelector('#\:1\.restore') as HTMLElement | null
    if (restoreLink) { restoreLink.click(); return }
    // Fallback: reload the page without translation cookie
    const url = new URL(window.location.href)
    url.searchParams.delete('googtrans')
    window.location.href = url.toString()
    return
  }

  const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null
  if (select) {
    select.value = langCode
    select.dispatchEvent(new Event('change'))
    return
  }

  // Retry up to 10 times with increasing delay
  if (attempts < 10) {
    setTimeout(() => triggerGoogleTranslate(langCode, attempts + 1), 300 * (attempts + 1))
  }
}

export function ETLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME)
    if (saved === 'am' || saved === 'om') {
      setLanguageState(saved as Language)
      setTimeout(() => triggerGoogleTranslate(GT_CODES[saved as Language]), 1500)
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
