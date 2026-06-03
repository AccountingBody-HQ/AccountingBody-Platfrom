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
    const body = await req.json()

    // Detect platform from Referer header
    const referer = req.headers.get('referer') || ''
    const isEthioTax = referer.includes('ethiotax.com')
    const brand = isEthioTax
      ? { name: 'EthioTax', domain: 'ethiotax.com', email: 'info@accountingbody.com', color: '#1A4731' }
      : { name: 'Accounting Body', domain: 'accountingbody.com', email: 'info@accountingbody.com', color: '#0C1A3D' }
    const { name, email, phone, service_type, message, _h } = body

    // Honeypot — bots fill this, real users never do
    if (_h) return NextResponse.json({ success: true })

    // Spam filters — language agnostic, safe for all users
    const BLOCKED_DOMAINS = ['hardfer.com', 'mailinator.com', 'guerrillamail.com', 'trashmail.com', 'tempmail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc']
    const emailDomain = email?.split('@')[1]?.toLowerCase() ?? ''
    if (BLOCKED_DOMAINS.includes(emailDomain)) return NextResponse.json({ success: true })
    if (message && message.trim().length < 20) return NextResponse.json({ success: true })
    if (message && !message.trim().includes(' ')) return NextResponse.json({ success: true })

    if (!name || !email || !message || !service_type) {
      return NextResponse.json({ error: 'Name, email, service and message are required.' }, { status: 400 })
    }

    // Save to Supabase
    const { error: dbError } = await supabase
      .from('help_requests')
      .insert([{
        name,
        email,
        phone: phone || null,
        service_type,
        message,
        platform: 'ab',
        title: service_type,
        description: message,
      }])

    if (dbError) {
      console.error('Supabase error:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Send notification to team
    await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: 'info@accountingbody.com',
      subject: `New Service Brief — ${service_type}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">New Service Brief Received</h1>
            </div>
            <div style="padding:32px 40px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:35%;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Service</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;font-weight:600;">${service_type}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Name</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${name}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Email</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <a href="mailto:${email}" style="color:#0C1A3D;font-size:14px;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Phone</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${phone || 'Not provided'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Brief</span>
                  </td>
                  <td style="padding:10px 0;">
                    <span style="color:#0C1A3D;font-size:14px;line-height:1.6;">${message.split('\n').join('<br>')}</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;">
                <p style="margin:0;color:#475569;font-size:13px;">Reply directly to this email to respond to the enquiry, or log in to the admin panel to manage this brief.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      replyTo: email,
    })

    // Send acknowledgment to client
    await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: email,
      subject: `We have received your enquiry — ${service_type}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">We have received your enquiry.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${name},</p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Thank you for getting in touch. We have received your service brief for <strong style="color:#0C1A3D;">${service_type}</strong> and a member of our team will be in contact with you shortly.</p>
              <div style="background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0C1A3D;">Your message:</strong><br>${message.split('\n').join('<br>')}</p>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;">If you have any additional information to add, simply reply to this email.</p>
              <a href="https://${brand.domain}/get-help"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                View our services →
              </a>
            </div>
            <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${brand.name} · Professional Services Network</p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Help request error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
