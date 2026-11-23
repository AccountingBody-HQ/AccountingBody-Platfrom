// The site fonts (DM Serif Display, DM Sans, JetBrains Mono). Loaded by a <link> in the two files
// that render <html> (app/layout.tsx and app/global-error.tsx), never by @import in app/globals.css:
// when an imported stylesheet cannot load, the browser marks the whole importing stylesheet as failed,
// and React rejects its own promise for that stylesheet with an Event when it inserts it itself (the
// not-found page). A plain <link> that cannot load only leaves the fallback fonts.
export const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&family=JetBrains+Mono:wght@400;500&display=swap'
