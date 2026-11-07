import { NextRequest } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { getProvider } from '@/lib/providers'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'

function getSupabase() {
  return getServerSupabase('admin')
}

// ── GET /api/roodber8/providers/[slug] ── provider + recent runs + recent errors
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
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
