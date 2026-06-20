import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()
    if (body._h) return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
    const required = ['full_name', 'email', 'location_city', 'professional_role', 'qualification', 'years_experience', 'employment_status', 'biography']
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }
    const platform = body.platform ?? 'ab'
    const isET = platform === 'et'
    const token = generateToken()
    const { error: dbError } = await supabase
      .from('job_seeker_registrations')
      .insert({
        platform,
        full_name:          body.full_name.trim(),
        email:              body.email.trim().toLowerCase(),
        phone:              body.phone?.trim() || null,
        location_city:      body.location_city.trim(),
        location_country:   body.location_country?.trim() || null,
        linkedin_url:       body.linkedin_url?.trim() || null,
        professional_role:  body.professional_role,
        qualification:      body.qualification,
        years_experience:   body.years_experience,
        employment_status:  body.employment_status,
        salary_expectation: body.salary_expectation?.trim() || null,
        role_types:         body.role_types || null,
        jurisdictions:      body.jurisdictions || null,
        languages:          body.languages || null,
        biography:          body.biography.trim(),
        terms_agreed:       body.terms_agreed ?? false,
        data_consent:       body.data_consent ?? false,
        status:             'pending_verification',
        verification_token: token,
      })
    if (dbError) {
      console.error('Supabase insert error:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    const platformName = isET ? 'EthioTax' : 'Accounting Body'
    const baseUrl = isET ? 'https://ethiotax.com' : 'https://accountingbody.com'
    const verifyUrl = `${baseUrl}/api/recruitment/verify-email?token=${token}`
    await resend.emails.send({
      from:    'noreply@accountingbody.com',
      to:      body.email.trim(),
      subject: `Verify your email — ${platformName} Candidate Registration`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px"><h2 style="color:${isET ? '#1A4731' : '#0C1A3D'};margin-bottom:16px">Confirm your email address</h2><p style="color:#475569;line-height:1.6">Thank you for registering with ${platformName}, ${body.full_name.split(' ')[0]}.</p><p style="color:#475569;line-height:1.6">Please click the button below to verify your email address. Once verified, your profile will be reviewed by our team within 5 working days.</p><div style="margin:32px 0"><a href="${verifyUrl}" style="background:${isET ? '#1A4731' : '#0C1A3D'};color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Verify my email address</a></div><p style="color:#94a3b8;font-size:13px">If you did not register with ${platformName}, you can safely ignore this email.</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/><p style="color:#94a3b8;font-size:12px">${platformName} | info@accountingbody.com</p></div>`,
    })
    await resend.emails.send({
      from:    'noreply@accountingbody.com',
      to:      'info@accountingbody.com',
      subject: `[${platform.toUpperCase()}] New candidate registration — ${body.full_name}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px"><h2 style="color:#0C1A3D">New Candidate Registration</h2><table style="width:100%;border-collapse:collapse;margin-top:16px"><tr><td style="padding:8px;color:#64748b;width:140px">Platform</td><td style="padding:8px;font-weight:600">${platform.toUpperCase()}</td></tr><tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Name</td><td style="padding:8px;font-weight:600">${body.full_name}</td></tr><tr><td style="padding:8px;color:#64748b">Email</td><td style="padding:8px">${body.email}</td></tr><tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Role</td><td style="padding:8px">${body.professional_role}</td></tr><tr><td style="padding:8px;color:#64748b">Qualification</td><td style="padding:8px">${body.qualification}</td></tr><tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Experience</td><td style="padding:8px">${body.years_experience}</td></tr><tr><td style="padding:8px;color:#64748b">Location</td><td style="padding:8px">${body.location_city}${body.location_country ? ', ' + body.location_country : ''}</td></tr></table><p style="color:#475569;margin-top:24px;font-size:13px">Review in admin panel once verified.</p></div>`,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Job seeker apply error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
