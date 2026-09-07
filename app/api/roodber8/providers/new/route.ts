import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// ── POST /api/roodber8/providers/new ── create a new provider
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await req.json()
  if (!isRecord(body)) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const name = str(body.name).trim()
  const slug = str(body.slug).trim()
  const baseUrl = str(body.base_url).trim()
  const adapterKey = str(body.adapter_key).trim()

  if (!name) {
    return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 })
  }
  if (!slug) {
    return NextResponse.json({ ok: false, error: 'Slug is required' }, { status: 400 })
  }
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: 'Base URL is required' }, { status: 400 })
  }
  if (!adapterKey) {
    return NextResponse.json({ ok: false, error: 'Adapter Key is required' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from('job_providers')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: false, error: `Slug "${slug}" is already in use` }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('job_providers')
    .insert({
      name,
      slug,
      provider_type:           str(body.provider_type, 'api_rest'),
      adapter_key:             adapterKey,
      status:                  str(body.status, 'active'),
      priority:                num(body.priority, 50),
      country_codes:           toArray(body.country_codes),
      regions:                 toArray(body.regions),
      platform_tags:           toArray(body.platform_tags),
      keywords:                toArray(body.keywords),
      source_score:            num(body.source_score, 0.5),
      source_name:             str(body.source_name) || null,
      base_url:                baseUrl,
      auth_type:               str(body.auth_type, 'none'),
      request_config:          parseJsonField(body.request_config),
      auth_config:             parseJsonField(body.auth_config),
      field_mapping:           parseJsonField(body.field_mapping),
      response_path:           str(body.response_path) || null,
      pagination_style:        str(body.pagination_style, 'none'),
      max_pages_per_run:       num(body.max_pages_per_run, 1),
      fetch_interval_minutes:  num(body.fetch_interval_minutes, 1440),
      fetch_offset_minutes:    num(body.fetch_offset_minutes, 0),
      commercial_terms:        str(body.commercial_terms) || null,
      notes:                   str(body.notes) || null,
    })
    .select('slug')
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Failed to create provider' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, slug: data.slug })
}
