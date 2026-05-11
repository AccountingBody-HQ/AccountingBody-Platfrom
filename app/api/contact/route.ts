import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    const body = await req.json()
    const { name, email, subject, message, subscribe, subscribeOnly } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    // Newsletter-only path (footer subscribe form)
    if (subscribeOnly) {
      const { error: subError } = await supabase
        .from('email_subscribers')
        .upsert({ email, platform: 'ab', status: 'subscribed', source: 'contact_form' }, { onConflict: 'email' })

      if (subError) {
        console.error('Subscribe error:', subError)
        return NextResponse.json({ error: subError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // Full contact form path
    if (!name || !message) {
      return NextResponse.json({ error: 'Name, email and message are required.' }, { status: 400 })
    }

    const { error: dbError } = await supabase
      .from('contact_submissions')
      .insert({ name, email, subject: subject ?? 'General Enquiry', message, platform: 'ab' })

    if (dbError) {
      console.error('Contact insert error:', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Also subscribe if checkbox was ticked
    if (subscribe) {
      const { error: subError } = await supabase
        .from('email_subscribers')
        .upsert({ email, platform: 'ab', status: 'subscribed', source: 'contact_form' }, { onConflict: 'email' })

      if (subError) {
        console.error('Subscribe error (non-fatal):', subError)
        // Non-fatal — contact was saved, subscription failed silently
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact route error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
