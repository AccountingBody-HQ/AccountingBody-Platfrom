'use client'

// EthioTax only: the Google Translate widget loads only after the visitor has picked Amharic or Oromo
// (owner decision D266). The language comes from the googtrans cookie, read after mount by
// ETLanguageProvider, so the server render and the first client render never include the scripts.
import Script from 'next/script'
import { useETLanguage } from './ETLanguageContext'

export function ETTranslateLoader() {
  const { language } = useETLanguage()
  if (language === 'en') return null
  return (
    <>
      <div id="google_translate_element" style={{ display: 'none' }} />
      <Script id="gt-init" strategy="afterInteractive">
        {`
          function googleTranslateElementInit() {
            new google.translate.TranslateElement({
              pageLanguage: 'en',
              includedLanguages: 'am,om,en',
              autoDisplay: false,
              layout: google.translate.TranslateElement.InlineLayout.SIMPLE
            }, 'google_translate_element');
          }
        `}
      </Script>
      <Script
        src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  )
}
