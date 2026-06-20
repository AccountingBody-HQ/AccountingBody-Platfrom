import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.redirect(new URL('/jobs/find-work?verified=invalid', req.url))

    const { data, error } = await supabase
      .from('job_seeker_registrations')
      .select('id, email, full_name, platform, status')
      .eq('verification_token', token)
      .single()

    if (error || !data) return NextResponse.redirect(new URL('/jobs/find-work?verified=invalid', req.url))
    if (data.status !== 'pending_verification') return NextResponse.redirect(new URL('/jobs/find-work?verified=already', req.url))

    await supabase
      .from('job_seeker_registrations')
      .update({ status: 'pending_review', verified_at: new Date().toISOString(), verification_token: null })
      .eq('id', data.id)

    const isET = data.platform === 'et'
    const platformName = isET ? 'EthioTax' : 'Accounting Body'

    await resend.emails.send({
      from:    'noreply@accountingbody.com',
      to:      data.email,
      subject: `Registration confirmed — ${platformName}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px"><h2 style="color:${isET ? '#1A4731' : '#0C1A3D'};margin-bottom:16px">Email confirmed</h2><p style="color:#475569;line-height:1.6">Thank you, ${data.full_name.split(' ')[0]}. Your email address has been verified.</p><p style="color:#475569;line-height:1.6">Your profile is now with our team for review. We aim to complete all reviews within 5 working days. We will contact you only when a role that matches your profile becomes available.</p><p style="color:#475569;line-height:1.6">Your details will never be shared with any employer without your prior knowledge.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/><p style="color:#94a3b8;font-size:12px">${platformName} | info@accountingbody.com</p></div>`,
    })

    const base = isET ? 'https://ethiotax.com' : 'https://accountingbody.com'
    return NextResponse.redirect(new URL('/jobs/find-work?verified=true', base))

  } catch (err) {
    console.error('Verify email error:', err)
    return NextResponse.redirect(new URL('/jobs/find-work?verified=error', req.url))
  }
}
