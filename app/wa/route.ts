import { redirect } from 'next/navigation'

// A fixed redirect: keep it built once (Next 15 would otherwise run it per click).
export const dynamic = 'force-static'

export function GET() {
  redirect('https://wa.me/447825730440?text=Hello%20EthioTax%2C%20I%20would%20like%20to%20enquire%20about%20your%20services.')
}
