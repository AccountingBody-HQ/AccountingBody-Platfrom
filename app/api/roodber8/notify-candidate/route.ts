import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { status, email, name, platform } = await req.json()
    const isET = platform === 'et'
    const platformName = isET ? 'EthioTax' : 'Accounting Body'
    const brand = isET ? '#1A4731' : '#0C1A3D'
    const firstName = (name ?? '').split(' ')[0]

    if (status === 'active') {
      await resend.emails.send({
        from:    'noreply@accountingbody.com',
        to:      email,
        subject: `Your candidate profile is active — ${platformName}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <h2 style="color:${brand};margin-bottom:16px">Your profile has been approved</h2>
          <p style="color:#475569;line-height:1.6">Dear ${firstName},</p>
          <p style="color:#475569;line-height:1.6">We are pleased to confirm that your candidate profile has been reviewed and approved. Your profile is now active in our system.</p>
          <p style="color:#475569;line-height:1.6">We will contact you directly when a role that matches your profile and preferences becomes available. You do not need to do anything further at this stage.</p>
          <p style="color:#475569;line-height:1.6">Please note that your details will never be shared with any employer without your prior knowledge.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">${platformName} | info@accountingbody.com</p>
        </div>`,
      })
    } else if (status === 'rejected') {
      await resend.emails.send({
        from:    'noreply@accountingbody.com',
        to:      email,
        subject: `Your candidate registration — ${platformName}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <h2 style="color:${brand};margin-bottom:16px">Thank you for your registration</h2>
          <p style="color:#475569;line-height:1.6">Dear ${firstName},</p>
          <p style="color:#475569;line-height:1.6">Thank you for registering with ${platformName}. After reviewing your profile, we are unable to proceed with your registration at this time.</p>
          <p style="color:#475569;line-height:1.6">This may be because your profile does not currently match the roles we are actively filling, or because we require additional information. We encourage you to reapply in the future if your circumstances change.</p>
          <p style="color:#475569;line-height:1.6">We wish you well in your career search.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">${platformName} | info@accountingbody.com</p>
        </div>`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('notify-candidate error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
