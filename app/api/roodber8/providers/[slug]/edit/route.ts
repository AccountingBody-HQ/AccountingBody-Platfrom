import { NextRequest, NextResponse } from 'next/server'
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v !== 'string') return []
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

function parseJsonField(v: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof v !== 'string' || !v.trim()) return fallback
  try {
    const parsed = JSON.parse(v)
    return isRecord(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

type RouteParams = { params: { slug: string } }

// ── PATCH /api/roodber8/providers/[slug]/edit ── update an existing provider
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = params
  const existing = await getProvider(slug)
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Provider not found' }, { status: 404 })
  }

  const body: unknown = await req.json()
  if (!isRecord(body)) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const name = str(body.name, existing.name).trim()
  const baseUrl = str(body.base_url, existing.base_url ?? '').trim()
  const adapterKey = str(body.adapter_key, existing.adapter_key).trim()

  if (!name) {
    return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 })
  }
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: 'Base URL is required' }, { status: 400 })
  }
  if (!adapterKey) {
    return NextResponse.json({ ok: false, error: 'Adapter Key is required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('job_providers')
    .update({
      name,
      provider_type:           str(body.provider_type, existing.provider_type),
      adapter_key:             adapterKey,
      status:                  str(body.status, existing.status),
      priority:                num(body.priority, existing.priority),
      country_codes:           toArray(body.country_codes),
      regions:                 toArray(body.regions),
      platform_tags:           toArray(body.platform_tags),
      source_score:            num(body.source_score, existing.source_score),
      source_name:             str(body.source_name) || null,
      base_url:                baseUrl,
      auth_type:               str(body.auth_type, existing.auth_type),
      request_config:          parseJsonField(body.request_config, existing.request_config),
      auth_config:             parseJsonField(body.auth_config, existing.auth_config),
      field_mapping:           parseJsonField(body.field_mapping, existing.field_mapping),
      response_path:           str(body.response_path) || null,
      pagination_style:        str(body.pagination_style, existing.pagination_style ?? 'none'),
      max_pages_per_run:       num(body.max_pages_per_run, existing.max_pages_per_run),
      fetch_interval_minutes:  num(body.fetch_interval_minutes, existing.fetch_interval_minutes),
      fetch_offset_minutes:    num(body.fetch_offset_minutes, existing.fetch_offset_minutes),
      commercial_terms:        str(body.commercial_terms) || null,
      notes:                   str(body.notes) || null,
    })
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── DELETE /api/roodber8/providers/[slug]/edit ── delete a provider (blocked if it has active jobs)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = params
  const existing = await getProvider(slug)
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Provider not found' }, { status: 404 })
  }

  const supabase = getSupabase()

  const { count: activeJobCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', existing.id)
    .eq('status', 'active')

  if ((activeJobCount ?? 0) > 0) {
    return NextResponse.json(
      { ok: false, error: 'Cannot delete provider with active jobs — pause it and wait for jobs to expire' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('job_providers')
    .delete()
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
