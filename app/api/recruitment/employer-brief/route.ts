import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    if (body._h) return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })

    const required = ['company_name', 'contact_name', 'contact_email', 'role_title', 'contract_type', 'location', 'role_description']
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const platform = body.platform ?? 'ab'
    const isET = platform === 'et'

    const { error: dbError } = await supabase
      .from('employer_briefs')
      .insert({
        platform,
        company_name:     body.company_name.trim(),
        contact_name:     body.contact_name.trim(),
        contact_email:    body.contact_email.trim().toLowerCase(),
        contact_phone:    body.contact_phone?.trim() || null,
        role_title:       body.role_title.trim(),
        contract_type:    body.contract_type,
        location:         body.location.trim(),
        salary_budget:    body.salary_budget?.trim() || null,
        start_date:       body.start_date?.trim() || null,
        jurisdiction:     body.jurisdiction || null,
        role_description: body.role_description.trim(),
        must_haves:       body.must_haves?.trim() || null,
        nice_to_haves:    body.nice_to_haves?.trim() || null,
        status:           'pending',
      })

    if (dbError) {
      console.error('Supabase error:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const platformName = isET ? 'EthioTax' : 'Accounting Body'

    await resend.emails.send({
      from:    'noreply@accountingbody.com',
      to:      body.contact_email.trim(),
      subject: `Hiring brief received — ${platformName}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <h2 style="color:${isET ? '#1A4731' : '#0C1A3D'};margin-bottom:16px">Thank you for your hiring brief</h2>
        <p style="color:#475569;line-height:1.6">Dear ${body.contact_name.split(' ')[0]},</p>
        <p style="color:#475569;line-height:1.6">We have received your hiring brief for the role of <strong>${body.role_title}</strong> at ${body.company_name}.</p>
        <p style="color:#475569;line-height:1.6">Our team will review your brief and be in touch within 2 working days. We will send you a Fee Agreement Letter before any search begins.</p>
        <p style="color:#475569;line-height:1.6">You will only be introduced to candidates we have selected and vetted for your specific requirement.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="color:#94a3b8;font-size:12px">${platformName} | info@accountingbody.com</p>
      </div>`,
    })

    await resend.emails.send({
      from:    'noreply@accountingbody.com',
      to:      'info@accountingbody.com',
      subject: `[${platform.toUpperCase()}] New employer brief — ${body.role_title} at ${body.company_name}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#0C1A3D">New Employer Brief</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px;color:#64748b;width:140px">Platform</td><td style="padding:8px;font-weight:600">${platform.toUpperCase()}</td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Company</td><td style="padding:8px;font-weight:600">${body.company_name}</td></tr>
          <tr><td style="padding:8px;color:#64748b">Contact</td><td style="padding:8px">${body.contact_name} — ${body.contact_email}</td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Role</td><td style="padding:8px;font-weight:600">${body.role_title}</td></tr>
          <tr><td style="padding:8px;color:#64748b">Type</td><td style="padding:8px">${body.contract_type}</td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Location</td><td style="padding:8px">${body.location}</td></tr>
          ${body.salary_budget ? `<tr><td style="padding:8px;color:#64748b">Budget</td><td style="padding:8px">${body.salary_budget}</td></tr>` : ''}
          ${body.start_date ? `<tr style="background:#f8fafc"><td style="padding:8px;color:#64748b">Start date</td><td style="padding:8px">${body.start_date}</td></tr>` : ''}
        </table>
        <p style="color:#475569;margin-top:16px;font-size:13px"><strong>Description:</strong> ${body.role_description}</p>
        ${body.must_haves ? `<p style="color:#475569;font-size:13px"><strong>Must-haves:</strong> ${body.must_haves}</p>` : ''}
      </div>`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('employer-brief error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
