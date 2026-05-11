import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: jobListings } = await supabase
    .from('job_listings')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: firmsApplications } = await supabase
    .from('firms_applications')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({
    jobListings: jobListings ?? [],
    firmsApplications: firmsApplications ?? [],
  })
}
