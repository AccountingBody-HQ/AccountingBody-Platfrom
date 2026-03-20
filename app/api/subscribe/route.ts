import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const { error: dbError } = await supabase
      .from('email_subscribers')
      .upsert({ email, subscribed_at: new Date().toISOString() }, { onConflict: 'email' })

    if (dbError) console.error('Supabase error:', dbError)

    await resend.emails.send({
      from: 'AccountingBody <hello@accountingbody.com>',
      to: email,
      subject: 'You are subscribed — AccountingBody',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#0a0f2e;padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">AccountingBody</p>
              <h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">You are subscribed.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;">No spam. Unsubscribe any time.</p>
              <a href="https://accountingbody.com/study"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                Start studying free →
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
