import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { to, name, subject, message, platform } = await req.json() as {
      to?: string; name?: string; subject?: string; message?: string; platform?: string
    }
    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const effectivePlatform = (platform === 'et' || platform === 'ethiotax') ? 'et' : 'ab'
    const isET = effectivePlatform === 'et'

    const fromAddress    = isET ? 'EthioTax <info@ethiotax.com>' : 'Accounting Body <info@accountingbody.com>'
    const replyToAddress = isET ? 'info@ethiotax.com' : 'info@accountingbody.com'
    const brandName      = isET ? 'EthioTax' : 'Accounting Body'
    const primaryColour  = isET ? '#1A4731' : '#0C1A3D'
    const accentColour   = isET ? '#C9982A' : '#D4A017'
    const disclaimer     = isET
      ? 'EthioTax is an independent accounting, tax and business consulting platform serving the Ethiopian community in Ethiopia and worldwide. We are not affiliated with any government tax authority.'
      : 'Accounting Body · Professional Services Network'

    await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      replyTo: replyToAddress,
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
