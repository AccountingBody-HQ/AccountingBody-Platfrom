import { NextRequest } from 'next/server'
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function strField(cfg: Record<string, unknown>, key: string): string | undefined {
  const v = cfg[key]
  return typeof v === 'string' ? v : undefined
}

// ── POST /api/roodber8/providers/[slug]/test ── read-only connectivity check, never inserts jobs
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!(await isAuthenticated(req))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const provider = await getProvider(params.slug)
  if (!provider) {
    return Response.json({ error: 'Provider not found' }, { status: 404 })
  }

  if (!provider.base_url) {
    return Response.json({ ok: false, error: 'Provider has no base_url configured' })
  }

  try {
    const url = new URL(provider.base_url)

    if (isRecord(provider.request_config)) {
      for (const [key, value] of Object.entries(provider.request_config)) {
        url.searchParams.set(key, String(value))
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'AccountingBody/1.0',
    }

    const authConfig = isRecord(provider.auth_config) ? provider.auth_config : {}

    if (provider.auth_type === 'bearer') {
      const envVar = strField(authConfig, 'env_var')
      const secret = envVar ? process.env[envVar] : undefined
      if (secret) headers['Authorization'] = `Bearer ${secret}`
    } else if (provider.auth_type === 'api_key') {
      const envVar = strField(authConfig, 'env_var')
      const paramName = strField(authConfig, 'param_name') ?? 'api_key'
      const secret = envVar ? process.env[envVar] : undefined
      if (secret) url.searchParams.set(paramName, secret)
    } else if (provider.auth_type === 'basic') {
      const envVar = strField(authConfig, 'env_var')
      const secret = envVar ? process.env[envVar] : undefined
      if (secret) headers['Authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`
    }

    const startMs = Date.now()
    const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(10000) })
    const responseMs = Date.now() - startMs

    if (!response.ok) {
      return Response.json({
        ok: false,
        status: response.status,
        statusText: response.statusText,
        responseMs,
        error: `HTTP ${response.status} ${response.statusText}`,
      })
    }

    const data: unknown = await response.json()

    let jobCount = 0
    if (provider.response_path) {
      const pathParts = provider.response_path.split('.')
      let cursor: unknown = data
      for (const part of pathParts) {
        cursor = isRecord(cursor) ? cursor[part] : undefined
      }
      if (Array.isArray(cursor)) jobCount = cursor.length
    } else if (Array.isArray(data)) {
      jobCount = data.length
    }

    return Response.json({
      ok: true,
      status: response.status,
      responseMs,
      jobCount,
      message: `Connection successful — ${jobCount} jobs found at response path`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ ok: false, error: message })
  }
}
