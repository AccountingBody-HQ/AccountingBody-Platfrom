import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/providers'
import { isAuthenticated } from '@/lib/admin-auth'
import { REGISTERED_ADAPTER_KEYS, isRegisteredAdapterKey } from '@/lib/adapters'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function str(v: unknown, fallback: string | null = ''): string {
  return typeof v === 'string' ? v : (fallback ?? '')
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Nullable number: an explicit null clears the column; a missing/invalid
// value leaves the existing value untouched.
function numOrNull(v: unknown, fallback: number | null): number | null {
  if (v === null) return null
  if (v === undefined) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  if (typeof v !== 'string') return []
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

// Same undefined-vs-omitted distinction numOrNull() already applies to the
// numeric fields: a field left out of a partial PATCH keeps the existing row
// value; an explicitly-sent array or comma-string is still parsed by toArray().
function toArrayOr(v: unknown, fallback: string[]): string[] {
  if (v === undefined) return fallback
  return toArray(v)
}

function parseJsonField(v: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  // Field omitted from a partial PATCH — keep the current row value.
  if (v === undefined) return fallback
  // Already-parsed plain object (not an array, not null): a caller that builds
  // the value live and submits it as JSON rather than a typed-out string — the
  // Add/Edit provider forms already do this, and the planned field-mapping UI
  // will too. Without this branch an object submission returned {ok:true} while
  // silently keeping the old value (Rule 122).
  if (isRecord(v) && !Array.isArray(v)) return v
  // String — unchanged: JSON.parse, then the isRecord check, falling back on a
  // parse failure or a non-object result.
  if (typeof v === 'string') {
    if (!v.trim()) return fallback
    try {
      const parsed = JSON.parse(v)
      return isRecord(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  // number | boolean | array | explicit null — unchanged: keep the row value.
  return fallback
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

  let body: unknown
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
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

  // Parity with the create route — but only enforced on a value the request
  // actually submits, so a partial PATCH that omits these fields still falls
  // back to the (already-valid) existing row values.
  if (
    body.base_url !== undefined &&
    (typeof body.base_url !== 'string' ||
      !body.base_url.startsWith('https://') ||
      body.base_url.length > 500)
  ) {
    return NextResponse.json(
      { ok: false, error: 'base_url must start with https:// and be at most 500 characters' },
      { status: 400 }
    )
  }
  if (body.adapter_key !== undefined && !isRegisteredAdapterKey(body.adapter_key)) {
    return NextResponse.json(
      { ok: false, error: `adapter_key must be one of: ${REGISTERED_ADAPTER_KEYS.join(', ')}` },
      { status: 400 }
    )
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
      country_codes:           toArrayOr(body.country_codes, existing.country_codes),
      regions:                 toArrayOr(body.regions, existing.regions),
      platform_tags:           toArrayOr(body.platform_tags, existing.platform_tags),
      keywords:                toArrayOr(body.keywords, existing.keywords),
      source_score:            num(body.source_score, existing.source_score),
      source_name:             str(body.source_name, existing.source_name) || null,
      base_url:                baseUrl,
      auth_type:               str(body.auth_type, existing.auth_type),
      request_config:          parseJsonField(body.request_config, existing.request_config),
      auth_config:             parseJsonField(body.auth_config, existing.auth_config),
      field_mapping:           parseJsonField(body.field_mapping, existing.field_mapping),
      response_path:           str(body.response_path, existing.response_path) || null,
      pagination_style:        str(body.pagination_style, existing.pagination_style ?? 'none'),
      max_pages_per_run:       num(body.max_pages_per_run, existing.max_pages_per_run),
      fetch_interval_minutes:  num(body.fetch_interval_minutes, existing.fetch_interval_minutes),
      fetch_offset_minutes:    num(body.fetch_offset_minutes, existing.fetch_offset_minutes),
      commercial_terms:        str(body.commercial_terms, existing.commercial_terms) || null,
      notes:                   str(body.notes, existing.notes) || null,
      enforce_relevance:       boolOr(body.enforce_relevance, existing.enforce_relevance ?? false),
      keyword_cursor:          num(body.keyword_cursor, existing.keyword_cursor ?? 0),
      rate_limit_rpm:          numOrNull(body.rate_limit_rpm, existing.rate_limit_rpm),
      rate_limit_daily:        numOrNull(body.rate_limit_daily, existing.rate_limit_daily),
      data_ownership:          str(body.data_ownership, existing.data_ownership) || null,
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
