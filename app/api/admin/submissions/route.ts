import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: helpRequests } = await supabase
    .from('help_requests')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: contactSubmissions } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({
    helpRequests: helpRequests ?? [],
    contactSubmissions: contactSubmissions ?? [],
  })
}
