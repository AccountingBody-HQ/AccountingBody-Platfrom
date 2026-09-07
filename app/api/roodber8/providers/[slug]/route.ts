import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/providers'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ── GET /api/roodber8/providers/[slug] ── provider + recent runs + recent errors
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!(await isAuthenticated(req))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { slug } = params
  const provider = await getProvider(slug)

  if (!provider) {
    return Response.json({ error: 'Provider not found' }, { status: 404 })
  }

  const supabase = getSupabase()

  const { data: runs } = await supabase
    .from('provider_runs')
    .select('*')
    .eq('provider_slug', slug)
    .order('started_at', { ascending: false })
    .limit(30)

  const { data: errors } = await supabase
    .from('provider_errors')
    .select('*')
    .eq('provider_id', provider.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { count: activeJobCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', provider.id)
    .eq('status', 'active')

  return Response.json({
    provider,
    runs: runs ?? [],
    errors: errors ?? [],
    active_job_count: activeJobCount ?? 0,
  })
}
