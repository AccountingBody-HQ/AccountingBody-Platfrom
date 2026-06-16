import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const token = req.nextUrl.searchParams.get('token')
  const isEthioTax = req.headers.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax
    ? { name: 'EthioTax', domain: 'ethiotax.com', email: 'hello@accountingbody.com', color: '#1A4731' }
    : { name: 'Accounting Body', domain: 'accountingbody.com', email: 'hello@accountingbody.com', color: '#0C1A3D' }

  if (!token) {
    return NextResponse.redirect(`https://${brand.domain}/?confirmed=invalid`)
  }

  const { data: subscriber, error: findError } = await supabase
    .from('email_subscribers')
    .select('email, status')
    .eq('confirmation_token', token)
    .single()

  if (findError || !subscriber) {
    return NextResponse.redirect(`https://${brand.domain}/?confirmed=invalid`)
  }

  if (subscriber.status === 'subscribed') {
    return NextResponse.redirect(`https://${brand.domain}/?confirmed=already`)
  }

  const { error: updateError } = await supabase
    .from('email_subscribers')
    .update({ status: 'subscribed', subscribed_at: new Date().toISOString(), confirmation_token: null })
    .eq('confirmation_token', token)

  if (updateError) {
    console.error('Confirm subscription error:', updateError)
    return NextResponse.redirect(`https://${brand.domain}/?confirmed=error`)
  }

  try {
    await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: 'info@accountingbody.com',
      subject: 'New subscriber — ' + subscriber.email,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name} — Admin</p>
              <h1 style="color:#fff;font-size:24px;margin:0;line-height:1.3;">New confirmed subscriber.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;"><strong>Email:</strong> <span style="color:#475569;text-decoration:none;">` + subscriber.email + `</span></p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;"><strong>Source:</strong> Footer signup (confirmed)</p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 28px;"><strong>Time:</strong> ` + new Date().toUTCString() + `</p>
              <a href="https://accountingbody.com/roodber8"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                View all subscribers →
              </a>
            </div>
          </div>
        </body>
        </html>
      `,
    })
  } catch (emailError) {
    console.error('Admin notification email error:', emailError)
  }

  return NextResponse.redirect(`https://${brand.domain}/?confirmed=true`)
}
