import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

async function verifyTurnstile(token: string, ip: string, isEthioTax: boolean): Promise<boolean> {
  if (!token) return false
  const secret = isEthioTax
    ? process.env.TURNSTILE_SECRET_KEY
    : process.env.TURNSTILE_SECRET_KEY_AB
  if (!secret) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: ip,
    }),
  })
  const data = await res.json()
  return data.success === true
}

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const body = await req.json()
    const { email, _h } = body
    const turnstileToken = body['cf-turnstile-response'] ?? ''

    // Detect platform from Referer header
    const isEthioTax = req.headers.get('x-et-platform') === 'ethiotax'
    const brand = isEthioTax
      ? { name: 'EthioTax', domain: 'ethiotax.com', email: 'noreply@accountingbody.com', color: '#1A4731' }
      : { name: 'Accounting Body', domain: 'accountingbody.com', email: 'noreply@accountingbody.com', color: '#0C1A3D' }

    // Honeypot
    if (_h) return NextResponse.json({ success: true })

    // Turnstile verification
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? ''
    if (turnstileToken) {
      const turnstileValid = await verifyTurnstile(turnstileToken, ip, isEthioTax)
      if (!turnstileValid) return NextResponse.json({ success: true })
    }

    // Block disposable email domains
    const BLOCKED_DOMAINS = ['hardfer.com', 'mailinator.com', 'guerrillamail.com', 'trashmail.com', 'tempmail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc']
    const emailDomain = email?.split('@')[1]?.toLowerCase() ?? ''
    if (BLOCKED_DOMAINS.includes(emailDomain)) return NextResponse.json({ success: true })

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const confirmationToken = randomUUID()

    // Do NOT save to DB yet — only save after email confirmation to prevent spam
    const confirmUrl = `https://${brand.domain}/api/confirm-subscription?token=${confirmationToken}&email=${encodeURIComponent(email)}&platform=${isEthioTax ? 'et' : 'ab'}`

    await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: email,
      subject: `Confirm your subscription — ${brand.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">Confirm your email.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;">One last step — click below to confirm your subscription. No spam. Unsubscribe any time.</p>
              <a href="${confirmUrl}"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                Confirm subscription →
              </a>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
