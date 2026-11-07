import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getServerSupabase } from '@/lib/supabase-server'
import { checkEmailSend } from '@/lib/email-check'
import { HUMAN_CHECK_FAILED_TEXT, SERVER_PROBLEM_TEXT } from '@/lib/message-rules'
import { verifyHumanCheck } from '@/lib/turnstile-verify'
import { escapeHtml, withoutLineBreaks } from '@/lib/html-escape'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = getServerSupabase('publicWrite')

  try {
    const body = await req.json()

    // Detect platform from Referer header
    const isEthioTax = req.headers.get('x-et-platform') === 'ethiotax'
    const brand = isEthioTax
      ? { name: 'EthioTax', domain: 'ethiotax.com', email: 'info@accountingbody.com', color: '#1A4731' }
      : { name: 'Accounting Body', domain: 'accountingbody.com', email: 'info@accountingbody.com', color: '#0C1A3D' }
    const { practice_name, contact_name, email, phone, website, practice_type, location, years_of_experience, languages, specialisms, about, _h } = body
    const turnstileToken = body['cf-turnstile-response'] ?? ''
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? ''
    const humanCheck = await verifyHumanCheck(turnstileToken, ip, isEthioTax, 'firms application')

    // Honeypot — bots fill this, real users never do
    if (_h) return NextResponse.json({ success: true })

    // Nothing is saved or sent unless the person check passed.
    if (!humanCheck.ok) {
      return NextResponse.json({ error: HUMAN_CHECK_FAILED_TEXT }, { status: 400 })
    }

    if (!contact_name || !email || !practice_type || !location || !about) {
      return NextResponse.json({ error: 'Required fields are missing.' }, { status: 400 })
    }

    // Save to Supabase
    const messageBody = [
      location ? `Location: ${location}` : '',
      specialisms ? `Specialisms: ${specialisms}` : '',
      about || '',
    ].filter(Boolean).join('\n')

    const { error: dbError } = await supabase
      .from('firms_applications')
      .insert([{
        firm_name: (practice_name || contact_name) ?? 'Unknown',
        contact_name,
        contact_email: email,
        contact_phone: phone || null,
        website: website || null,
        firm_type: practice_type || null,
        years_of_experience: years_of_experience || null,
        languages: languages || null,
        message: messageBody,
        platform: isEthioTax ? 'et' : 'ab',
      }])

    if (dbError) {
      console.error('firms application: save failed', dbError.code || 'no-code')
      return NextResponse.json({ error: SERVER_PROBLEM_TEXT }, { status: 500 })
    }

    // Parse applicant type from about field prefix
    const applicantType = about.startsWith('[FIRM]') ? 'Firm' : 'Independent Professional'

    // Send notification to team — non-blocking: the application is saved, so
    // a failed send is logged and the visitor still sees success.
    try { checkEmailSend(await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: 'info@accountingbody.com',
      subject: `New Network Application — ${applicantType}: ${withoutLineBreaks(practice_name || contact_name)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">New Network Application</h1>
            </div>
            <div style="padding:32px 40px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:35%;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Type</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;font-weight:600;">${applicantType}</span>
                  </td>
                </tr>
                ${practice_name ? `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Firm Name</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(practice_name)}</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Contact</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(contact_name)}</span>
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
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Phone</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(phone || 'Not provided')}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Role / Type</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(practice_type)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Location</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(location)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Years of Experience</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(years_of_experience || 'Not specified')}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Languages</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(languages || 'Not specified')}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Specialisms</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${escapeHtml(specialisms || 'Not specified')}</span>
                  </td>
                </tr>
                ${website ? `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Website</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <a href="${escapeHtml(website)}" style="color:#0C1A3D;font-size:14px;">${escapeHtml(website)}</a>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">About</span>
                  </td>
                  <td style="padding:10px 0;">
                    <span style="color:#0C1A3D;font-size:14px;line-height:1.6;">${escapeHtml(about).split('\n').join('<br>')}</span>
                  </td>
                </tr>
              </table>
              <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;">
                <p style="margin:0;color:#475569;font-size:13px;">Reply directly to this email to respond to the applicant, or log in to the admin panel to manage this application.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      replyTo: email,
    }), 'firms application team notification') } catch (emailErr) { console.error('Notification email error:', emailErr) }

    // Send acknowledgment to applicant — non-blocking (logged on failure)
    try { checkEmailSend(await resend.emails.send({
      from: `${brand.name} <${brand.email}>`,
      to: email,
      subject: `We have received your application — ${brand.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:${brand.color};padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
              <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">Application received.</h1>
            </div>
            <div style="padding:32px 40px;">
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${escapeHtml(contact_name)},</p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Thank you for applying to join the ${brand.name} professional network. We have received your application and our team will review it carefully.</p>
              <div style="background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;padding:16px 20px;margin:0 0 24px;">
                <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">We aim to review all applications within 5 working days. You will hear from us once your application has been assessed.</p>
              </div>
              <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;">If you have any questions in the meantime, simply reply to this email.</p>
              <a href="https://${brand.domain}/firms-freelancers"
                style="display:inline-block;background:#D4A017;color:#0a0f2e;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
                Learn more →
              </a>
            </div>
            <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${brand.name} · Professional Services Network</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }), 'firms application acknowledgement') } catch (emailErr) { console.error('Acknowledgment email error:', emailErr) }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Firms application error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
