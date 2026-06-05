import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { to, name, subject, message } = await req.json()
    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }
    await resend.emails.send({
      from: 'Accounting Body <info@accountingbody.com>',
      to,
      subject,
      replyTo: 'info@accountingbody.com',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#0C1A3D;padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">Accounting Body</p>
              <h1 style="color:#fff;font-size:20px;margin:0;line-height:1.3;">${subject}</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${name || 'there'},</p>
              <div style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 28px;white-space:pre-line;">${message}</div>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">Kind regards,<br/><strong>Accounting Body Team</strong></p>
            </div>
            <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Accounting Body · Professional Services Network</p>
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
