import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email and message are required.' }, { status: 400 })
    }

    // 1. Save to Supabase
    await supabase.from('contact_submissions').insert({
      name,
      email,
      subject: subject ?? 'General enquiry',
      message,
      submitted_at: new Date().toISOString(),
    })

    // 2. Notify admin
    await resend.emails.send({
      from: 'AccountingBody Contact <hello@accountingbody.com>',
      to: 'hello@accountingbody.com',
      replyTo: email,
      subject: `New contact: ${subject ?? 'General enquiry'} — ${name}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:40px auto;">
          <h2 style="color:#0a0f2e;">New contact form submission</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:100px;">Name</td><td style="padding:8px 0;font-size:14px;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px;">Subject</td><td style="padding:8px 0;font-size:14px;">${subject ?? '—'}</td></tr>
          </table>
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-top:16px;border:1px solid #e2e8f0;">
            <p style="margin:0;font-size:15px;line-height:1.7;color:#1e293b;">${message.replace(/\n/g, '<br/>')}</p>
          </div>
        </div>
      `,
    })

    // 3. Confirm to user
    await resend.emails.send({
      from: 'AccountingBody <hello@accountingbody.com>',
      to: email,
      subject: 'We received your message — AccountingBody',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#0a0f2e;padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">AccountingBody</p>
              <h1 style="color:#fff;font-size:24px;margin:0;">Message received.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
                Hi ${name}, thank you for getting in touch. We have received your message and will respond within 1–2 working days.
              </p>
              <a href="https://accountingbody.com"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                Back to AccountingBody
              </a>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
