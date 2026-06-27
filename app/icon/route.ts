// app/icon/route.ts
// Dynamic favicon — serves ET green shield for ethiotax.com, AB navy mark for accountingbody.com
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const AB_ICON = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="#ffffff"/>
  <rect x="6" y="6" width="8" height="20" fill="#1e3a7a"/>
  <rect x="18" y="6" width="8" height="9" fill="#1e3a7a"/>
  <rect x="18" y="18" width="8" height="8" fill="#1e3a7a"/>
</svg>`

const ET_ICON = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="#1A4731"/>
  <path d="M16 4L6 8v10c0 5 4 8 10 10 6-2 10-5 10-10V8Z" fill="#C9982A"/>
  <polygon points="16,10 17.5,14 21.5,14.3 18.5,17 19.5,21 16,19 12.5,21 13.5,17 10.5,14.3 14.5,14" fill="#1A4731"/>
</svg>`

export async function GET() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const svg = isEthioTax ? ET_ICON : AB_ICON

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
