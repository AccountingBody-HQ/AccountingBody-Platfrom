// app/api/contact/route.ts
// Saves contact submissions and email subscribers to Supabase.
// No third-party email service required.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, subject, message, subscribe, subscribeOnly } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. Save contact submission (skip for subscribe-only requests)
    if (!subscribeOnly) {
      if (!name || !subject || !message) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }
      const { error } = await supabase
        .from('contact_submissions')
        .insert({ name, email, subject, message, created_at: new Date().toISOString() })
      if (error) console.error('contact_submissions error:', error)
    }

    // 2. Add to email_subscribers if opted in
    if (subscribe || subscribeOnly) {
      const { error } = await supabase
        .from('email_subscribers')
        .upsert(
          { email, source: 'contact_form', subscribed: true, created_at: new Date().toISOString() },
          { onConflict: 'email', ignoreDuplicates: false }
        )
      if (error) console.error('email_subscribers error:', error)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact API error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
