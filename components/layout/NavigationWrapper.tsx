// components/layout/NavigationWrapper.tsx
// Server component — reads x-et-platform header and passes correct nav links to client Navigation
import { headers } from 'next/headers'
import Script from 'next/script'
import { Navigation } from './Navigation'
import { ETICPA_STUDY_LINKS, ICAEW_STUDY_LINKS, ET_GET_HELP_LINKS, ET_COMPANY_LINKS } from './nav-data'
import { ETLanguageProvider } from './ETLanguageContext'

export async function NavigationWrapper() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const studyQualificationLinks = isEthioTax ? ETICPA_STUDY_LINKS : ICAEW_STUDY_LINKS
  const etGetHelpLinks = isEthioTax ? ET_GET_HELP_LINKS : undefined
  const etCompanyLinks = isEthioTax ? ET_COMPANY_LINKS : undefined

  const nav = (
    <Navigation
      studyQualificationLinks={studyQualificationLinks}
      etGetHelpLinks={etGetHelpLinks}
      etCompanyLinks={etCompanyLinks}
    />
  )

  if (isEthioTax) {
    return (
      <ETLanguageProvider>
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
        {nav}
      </ETLanguageProvider>
    )
  }

  return nav
}
