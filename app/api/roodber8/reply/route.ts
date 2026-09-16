import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getContactBrand, isEthioTaxPlatformValue } from '@/lib/contact-brand'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { to, name, subject, message, platform } = await req.json() as {
      to?: string; name?: string; subject?: string; message?: string; platform?: string
    }
    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // platform here is whatever the stored contact_submissions/help_requests
    // row's own platform column held at page-render time (see ReplyButton in
    // components/roodber8/AdminActions.tsx, which forwards item.platform) —
    // not an independent client choice. isEthioTaxPlatformValue also accepts
    // the header's 'ethiotax' spelling defensively, though this caller only
    // ever sends 'ab' or 'et'.
    const isET = isEthioTaxPlatformValue(platform)
    const brand = getContactBrand(isET)

    // Resend's free plan has exactly one verified sending domain
    // (accountingbody.com) — an EthioTax From/Reply-To on ethiotax.com
    // would silently fail to send. brand.email is always the verified
    // domain; only the display name changes. Matches the proven-good
    // pattern already used by the ET acknowledgement email in
    // app/api/contact/route.ts, which also sets no custom Reply-To.
    const fromAddress    = `${brand.name} <${brand.email}>`
    const replyToAddress = isET ? undefined : 'info@accountingbody.com'
    const brandName      = brand.name
    const primaryColour  = brand.color
    const accentColour   = isET ? '#C9982A' : '#D4A017'
    const disclaimer     = isET
      ? 'EthioTax is an independent accounting, tax and business consulting platform serving the Ethiopian community in Ethiopia and worldwide. We are not affiliated with any government tax authority.'
      : 'Accounting Body · Professional Services Network'

    await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      ...(replyToAddress ? { replyTo: replyToAddress } : {}),
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${primaryColour};padding:32px 40px;">
              <p style="color:${accentColour};font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brandName}</p>
              <h1 style="color:#fff;font-size:20px;margin:0;line-height:1.3;">${subject}</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${name || 'there'},</p>
              <div style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 28px;white-space:pre-line;">${message}</div>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">Kind regards,<br/><strong>${brandName} Team</strong></p>
            </div>
            <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${disclaimer}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply.' }, { status: 500 })
  }
}
