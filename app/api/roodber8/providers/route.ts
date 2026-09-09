import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAllProviders, type ProviderRun } from '@/lib/providers'
import { isAuthenticated } from '@/lib/admin-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// ── GET /api/roodber8/providers ── all providers with their latest run
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const providers = await getAllProviders()

  const runBySlug: Record<string, ProviderRun> = {}
  if (providers.length > 0) {
    const supabase = getSupabase()
    const { data: latestRuns } = await supabase
      .from('provider_runs')
      .select('*')
      .in('provider_slug', providers.map(p => p.slug))
      .order('started_at', { ascending: false })

    for (const run of (latestRuns ?? []) as ProviderRun[]) {
      if (!runBySlug[run.provider_slug]) {
        runBySlug[run.provider_slug] = run
      }
    }
  }

  const enriched = providers.map(p => ({
    ...p,
    latest_run: runBySlug[p.slug] ?? null,
  }))

  return Response.json({ providers: enriched })
}

// ── PATCH /api/roodber8/providers ── body: { slug, status } — active/paused toggle
export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json() as { slug: string; status: string }
  const { slug, status } = body

  if (!slug || !['active', 'paused'].includes(status)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('job_providers')
    .update({ status })
    .eq('slug', slug)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, slug, status })
}
