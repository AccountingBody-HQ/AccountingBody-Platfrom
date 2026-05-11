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
    const { practice_name, contact_name, email, phone, website, practice_type, location, specialisms, about } = body

    if (!contact_name || !email || !practice_type || !location || !about) {
      return NextResponse.json({ error: 'Required fields are missing.' }, { status: 400 })
    }

    // Save to Supabase
    const { error: dbError } = await supabase
      .from('firms_applications')
      .insert([{
        practice_name: practice_name || contact_name,
        contact_name,
        email,
        phone: phone || null,
        website: website || null,
        practice_type,
        location,
        specialisms: specialisms || null,
        about,
        platform: 'ab',
      }])

    if (dbError) {
      console.error('Supabase error:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Parse applicant type from about field prefix
    const applicantType = about.startsWith('[FIRM]') ? 'Firm' : 'Independent Professional'

    // Send notification to team
    await resend.emails.send({
      from: 'AccountingBody <info@accountingbody.com>',
      to: 'info@accountingbody.com',
      subject: `New Network Application — ${applicantType}: ${practice_name || contact_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
          <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <div style="background:#0C1A3D;padding:32px 40px;">
              <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">AccountingBody</p>
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
                    <span style="color:#0C1A3D;font-size:14px;">${practice_name}</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Contact</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${contact_name}</span>
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
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Role / Type</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${practice_type}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Location</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${location}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Specialisms</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#0C1A3D;font-size:14px;">${specialisms || 'Not specified'}</span>
                  </td>
                </tr>
                ${website ? `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Website</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                    <a href="${website}" style="color:#0C1A3D;font-size:14px;">${website}</a>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">About</span>
                  </td>
                  <td style="padding:10px 0;">
                    <span style="color:#0C1A3D;font-size:14px;line-height:1.6;">${about.replace(/\n/g, '<br>')}</span>
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
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Firms application error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
