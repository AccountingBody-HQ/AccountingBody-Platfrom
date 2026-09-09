import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthenticated } from '@/lib/admin-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function stringArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback
  return v.filter((x): x is string => typeof x === 'string')
}

function recordOrNull(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// ── POST /api/roodber8/providers/create ── insert a new job_providers row
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const b = body as Record<string, unknown>

  // ── Required fields ────────────────────────────────────────────────────
  const slug = b.slug
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug) || slug.length > 80) {
    return Response.json(
      { error: 'slug is required and must contain only lowercase letters, numbers and hyphens (max 80 characters)' },
      { status: 400 }
    )
  }

  const name = b.name
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
    return Response.json({ error: 'name is required and must be at most 120 characters' }, { status: 400 })
  }

  const adapterKey = b.adapter_key
  if (adapterKey !== 'adzuna' && adapterKey !== 'generic-rest') {
    return Response.json({ error: "adapter_key must be 'adzuna' or 'generic-rest'" }, { status: 400 })
  }

  const baseUrl = b.base_url
  if (typeof baseUrl !== 'string' || !baseUrl.startsWith('https://') || baseUrl.length > 500) {
    return Response.json(
      { error: 'base_url is required, must start with https:// and be at most 500 characters' },
      { status: 400 }
    )
  }

  const status = b.status
  if (status !== 'active' && status !== 'paused') {
    return Response.json({ error: "status must be 'active' or 'paused'" }, { status: 400 })
  }

  // ── Optional fields (defaults per spec) ────────────────────────────────
  const sourceName = stringOrNull(b.source_name)
  const providerType = stringOrNull(b.provider_type)
  const authType = stringOr(b.auth_type, 'none')
  const authConfig = recordOrNull(b.auth_config)
  const requestConfig = recordOrNull(b.request_config)
  const responsePath = stringOrNull(b.response_path)
  const fieldMapping = recordOrNull(b.field_mapping)
  const keywords = stringArray(b.keywords, [])
  const platformTags = stringArray(b.platform_tags, ['ab'])
  const countryCodes = stringArray(b.country_codes, [])
  const regions = stringArray(b.regions, [])
  const fetchIntervalMinutes = numberOr(b.fetch_interval_minutes, 1440)
  const fetchOffsetMinutes = numberOr(b.fetch_offset_minutes, 0)
  const sourceScore = numberOr(b.source_score, 0.50)
  const priority = numberOr(b.priority, 50)
  const commercialTerms = stringOrNull(b.commercial_terms)
  const notes = stringOrNull(b.notes)
  const maxPagesPerRun = numberOr(b.max_pages_per_run, 1)
  const paginationStyle = stringOr(b.pagination_style, 'none')

  const supabase = getSupabase()
  const { error } = await supabase.from('job_providers').insert({
    slug,
    name,
    adapter_key: adapterKey,
    base_url: baseUrl,
    status,
    source_name: sourceName,
    provider_type: providerType,
    auth_type: authType,
    auth_config: authConfig,
    request_config: requestConfig,
    response_path: responsePath,
    field_mapping: fieldMapping,
    keywords,
    platform_tags: platformTags,
    country_codes: countryCodes,
    regions,
    fetch_interval_minutes: fetchIntervalMinutes,
    fetch_offset_minutes: fetchOffsetMinutes,
    source_score: sourceScore,
    priority,
    commercial_terms: commercialTerms,
    notes,
    max_pages_per_run: maxPagesPerRun,
    pagination_style: paginationStyle,
  })

  if (error) {
    if (error.message.toLowerCase().includes('duplicate') || error.code === '23505') {
      return Response.json({ error: 'A provider with this slug already exists' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, slug }, { status: 201 })
}
