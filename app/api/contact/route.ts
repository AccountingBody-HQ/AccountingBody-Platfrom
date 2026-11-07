import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getServerSupabase } from '@/lib/supabase-server'
import { getContactBrand, contactPlatformValue } from '@/lib/contact-brand'
import { checkEmailSend } from '@/lib/email-check'
import { HUMAN_CHECK_FAILED_TEXT, SERVER_PROBLEM_TEXT, isMessageTooShort, messageTooShortText } from '@/lib/message-rules'
import { verifyHumanCheck } from '@/lib/turnstile-verify'
import { escapeHtml, withoutLineBreaks } from '@/lib/html-escape'
import { reportServerError } from '@/lib/report-error'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = getServerSupabase('publicWrite')

  try {
    const body = await req.json()
    const { name, email, subject, message, subscribe, subscribeOnly, _h } = body
    const turnstileToken = body['cf-turnstile-response'] ?? ''

    // Detect platform from Referer header
    const isEthioTax = req.headers.get('x-et-platform') === 'ethiotax'
    const brand = getContactBrand(isEthioTax)

    // Person check (Cloudflare Turnstile), verified on the server first.
    // Nothing is saved or sent unless it passed.
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? ''
    const humanCheck = await verifyHumanCheck(turnstileToken, ip, isEthioTax, 'contact')
    if (!humanCheck.ok) {
      return NextResponse.json({ error: HUMAN_CHECK_FAILED_TEXT }, { status: 400 })
    }

    // Honeypot — bots fill this, real users never do
    if (_h) return NextResponse.json({ success: true })

    // Spam filters
    const BLOCKED_DOMAINS = ['hardfer.com', 'mailinator.com', 'guerrillamail.com', 'trashmail.com', 'tempmail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc']
    const emailDomain = email?.split('@')[1]?.toLowerCase() ?? ''
    if (BLOCKED_DOMAINS.includes(emailDomain)) return NextResponse.json({ success: true })
    if (message && !message.trim().includes(' ')) return NextResponse.json({ success: true })

    if (message && isMessageTooShort(message)) {
      return NextResponse.json({ error: messageTooShortText() }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    // Newsletter-only path (footer subscribe form)
    if (subscribeOnly) {
      const BLOCKED_DOMAINS_SUB = ['hardfer.com', 'mailinator.com', 'guerrillamail.com', 'trashmail.com', 'tempmail.com', 'yopmail.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc']
      const subEmailDomain = email?.split('@')[1]?.toLowerCase() ?? ''
      if (BLOCKED_DOMAINS_SUB.includes(subEmailDomain)) return NextResponse.json({ success: true })
      const { error: subError } = await supabase
        .from('email_subscribers')
        .upsert({ email, platform: contactPlatformValue(isEthioTax), status: 'subscribed', source: 'contact_form' }, { onConflict: 'email,platform' })
      if (subError) {
        console.error('contact: newsletter save failed', subError.code || 'no-code')
        return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // Full contact form path
    if (!name || !message) {
      return NextResponse.json({ error: 'Name, email and message are required.' }, { status: 400 })
    }

    const { error: dbError } = await supabase
      .from('contact_submissions')
      .insert({ name, email, subject: subject ?? 'General Enquiry', message, platform: contactPlatformValue(isEthioTax) })

    if (dbError) {
      console.error('contact: save failed', dbError.code || 'no-code')
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }

    // Also subscribe if checkbox was ticked
    if (subscribe) {
      const { error: subError } = await supabase
        .from('email_subscribers')
        .upsert({ email, platform: contactPlatformValue(isEthioTax), status: 'subscribed', source: 'contact_form' }, { onConflict: 'email,platform' })
      if (subError) {
        console.error('Subscribe error (non-fatal):', subError)
      }
    }

    // Notify team. The message is saved, so a failed send is logged and the
    // visitor still sees success.
    const teamResult = await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: 'info@accountingbody.com',
      subject: `New Contact Submission — ${withoutLineBreaks(subject ?? 'General Enquiry')}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">New Contact Submission</h1>
            </div>
            <div style="padding:32px 40px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:35%;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Name</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(name)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Email</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <a href="mailto:${escapeHtml(email)}" style="color:#0C1A3D;font-size:14px;">${escapeHtml(email)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Subject</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(subject ?? 'General Enquiry')}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Message</span>
                  </td>
                  <td style="padding:10px 0;">
                    <span style="color:#0C1A3D;font-size:14px;line-height:1.6;">${escapeHtml(message).split('\n').join('<br>')}</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;">
                <p style="margin:0;color:#475569;font-size:13px;">Reply directly to this email to respond, or log in to the admin panel to manage this submission.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      replyTo: email,
    })
    checkEmailSend(teamResult, 'contact team notification')

    // Send acknowledgment to client (logged on failure, as above)
    const ackResult = await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: email,
      subject: `We have received your message — ${brand.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">We have received your message.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${escapeHtml(name)},</p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Thank you for contacting us. We have received your message and will get back to you as soon as possible.</p>
              <div style="background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#0C1A3D;font-size:13px;font-weight:600;">Your message:</p>
                <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">${escapeHtml(message).split('\n').join('<br>')}</p>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;">If you have anything to add, simply reply to this email.</p>
              <a href="https://${brand.domain}"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                Visit ${brand.name} \u2192
              </a>
            </div>
            <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${brand.name} \u00b7 Professional Services Network</p>
            </div>
          </div>
        </body>
        </html>
      `,
    })
    checkEmailSend(ackResult, 'contact acknowledgement')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact route error:', error)
    reportServerError('contact submit failed', error, { area: 'public' })
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
