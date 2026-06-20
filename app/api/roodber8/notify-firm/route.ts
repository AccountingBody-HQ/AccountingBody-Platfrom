import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id, status } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ success: true, skipped: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: app, error: fetchError } = await supabase
      .from('firms_applications')
      .select('contact_name, contact_email, firm_name, platform')
      .eq('id', id)
      .single()

    if (fetchError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { contact_name, contact_email, firm_name, platform } = app

    if (!contact_email) {
      return NextResponse.json({ error: 'No email address on record' }, { status: 400 })
    }

    const isEthioTax = platform === 'et'
    const brand = isEthioTax
      ? { name: 'EthioTax', domain: 'ethiotax.com', color: '#1A4731' }
      : { name: 'Accounting Body', domain: 'accountingbody.com', color: '#0C1A3D' }

    const displayName = firm_name || contact_name || 'Applicant'
    const resend = new Resend(process.env.RESEND_API_KEY)

    if (status === 'approved') {
      await resend.emails.send({
        from: `${brand.name} <info@accountingbody.com>`,
        to: contact_email,
        subject: `Your application has been approved — ${brand.name}`,
        html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:${brand.color};padding:32px 40px;">
      <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
      <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">Application approved.</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${contact_name || displayName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">We are pleased to confirm that your application to join the ${brand.name} professional network has been approved.</p>
      <div style="background:#f0fdf4;border-radius:8px;border-left:3px solid #16a34a;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;font-weight:600;">Welcome to the network.</p>
        <p style="margin:8px 0 0;color:#166534;font-size:13px;line-height:1.6;">You will shortly receive a Network Partner Agreement for your review and signature. Please read it carefully and return the signed copy to complete your onboarding.</p>
      </div>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 28px;">If you have any questions in the meantime, simply reply to this email and we will be happy to help.</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">We look forward to working with you.</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:4px 0 0;font-weight:600;">The ${brand.name} Team</p>
    </div>
    <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">${brand.name} &middot; Professional Services Network &middot; <a href="https://${brand.domain}" style="color:#94a3b8;">${brand.domain}</a></p>
    </div>
  </div>
</body>
</html>`,
      })
    }

    if (status === 'rejected') {
      await resend.emails.send({
        from: `${brand.name} <info@accountingbody.com>`,
        to: contact_email,
        subject: `Update on your application — ${brand.name}`,
        html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:${brand.color};padding:32px 40px;">
      <p style="color:#D4A017;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">${brand.name}</p>
      <h1 style="color:#fff;font-size:22px;margin:0;line-height:1.3;">Application update.</h1>
    </div>
    <div style="padding:32px 40px;">
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Dear ${contact_name || displayName},</p>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">Thank you for taking the time to apply to join the ${brand.name} professional network. We have carefully reviewed your application.</p>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">After consideration, we are unable to proceed with your application at this time. This decision is not a reflection of your professional standing — we review all applications against the current needs and capacity of the network.</p>
      <div style="background:#f8fafc;border-radius:8px;border-left:3px solid #D4A017;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">You are welcome to reapply in the future if circumstances change. If you would like feedback on your application, please reply to this email.</p>
      </div>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:0;">Thank you again for your interest in ${brand.name}.</p>
      <p style="color:#475569;font-size:14px;line-height:1.7;margin:4px 0 0;font-weight:600;">The ${brand.name} Team</p>
    </div>
    <div style="padding:20px 40px;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">${brand.name} &middot; Professional Services Network &middot; <a href="https://${brand.domain}" style="color:#94a3b8;">${brand.domain}</a></p>
    </div>
  </div>
</body>
</html>`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('notify-firm error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
