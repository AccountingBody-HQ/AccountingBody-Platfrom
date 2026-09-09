'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ADMIN_COLORS } from '@/lib/admin-theme'
import type { JobProvider } from '@/lib/providers'

function jsonFieldToText(v: Record<string, unknown> | null | undefined): string {
  if (!v || Object.keys(v).length === 0) return ''
  return JSON.stringify(v, null, 2)
}

export default function EditProviderPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [providerName, setProviderName] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    adapter_key: 'generic-rest',
    base_url: '',
    status: 'active',
    source_name: '',
    provider_type: 'api_rest',
    auth_type: 'none',
    auth_config: '',
    request_config: '',
    response_path: 'jobs',
    field_mapping: '',
    keywords: '',
    platform_tags: 'ab',
    country_codes: '',
    regions: '',
    fetch_interval_minutes: 1440,
    fetch_offset_minutes: 0,
    source_score: 0.50,
    priority: 50,
    commercial_terms: 'free',
    notes: '',
    max_pages_per_run: 1,
    pagination_style: 'none',
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/roodber8/providers/${slug}`)
        const data = await res.json() as { provider?: JobProvider; error?: string }
        if (cancelled) return
        if (!res.ok || !data.provider) {
          setError('Failed to load provider')
          setLoading(false)
          return
        }
        const provider = data.provider
        setProviderName(provider.name)
        setFormData({
          name: provider.name,
          adapter_key: provider.adapter_key,
          base_url: provider.base_url ?? '',
          status: provider.status,
          source_name: provider.source_name ?? '',
          provider_type: provider.provider_type,
          auth_type: provider.auth_type,
          auth_config: jsonFieldToText(provider.auth_config),
          request_config: jsonFieldToText(provider.request_config),
          response_path: provider.response_path ?? '',
          field_mapping: jsonFieldToText(provider.field_mapping),
          keywords: Array.isArray(provider.keywords) ? provider.keywords.join(', ') : '',
          platform_tags: Array.isArray(provider.platform_tags) ? provider.platform_tags.join(', ') : 'ab',
          country_codes: Array.isArray(provider.country_codes) ? provider.country_codes.join(', ') : '',
          regions: Array.isArray(provider.regions) ? provider.regions.join(', ') : '',
          fetch_interval_minutes: provider.fetch_interval_minutes,
          fetch_offset_minutes: provider.fetch_offset_minutes,
          source_score: provider.source_score,
          priority: provider.priority,
          commercial_terms: provider.commercial_terms ?? '',
          notes: provider.notes ?? '',
          max_pages_per_run: provider.max_pages_per_run,
          pagination_style: provider.pagination_style ?? 'none',
        })
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Failed to load provider')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [slug])

  const inputStyle = {
    background: ADMIN_COLORS.bg,
    border: '1px solid ' + ADMIN_COLORS.border,
    color: ADMIN_COLORS.text,
    borderRadius: '6px',
    padding: '8px 12px',
    width: '100%',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    color: ADMIN_COLORS.textMuted,
    fontSize: '12px',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  }
  const helperStyle = {
    color: ADMIN_COLORS.textDim,
    fontSize: '11px',
    marginTop: '4px',
  }
  const sectionStyle = {
    background: ADMIN_COLORS.card,
    border: '1px solid ' + ADMIN_COLORS.border,
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '16px',
  }
  const sectionTitleStyle = {
    color: ADMIN_COLORS.text,
    fontSize: '14px',
    fontWeight: '700' as const,
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '1px solid ' + ADMIN_COLORS.border,
  }
  const errorTextStyle = {
    color: ADMIN_COLORS.danger,
    fontSize: '11px',
    marginTop: '4px',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Client-side validation
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Name is required'
    if (!formData.base_url.startsWith('https://'))
      errs.base_url = 'Base URL must start with https://'

    // Parse JSON fields
    let parsedRequestConfig: Record<string, unknown> | null = null
    let parsedFieldMapping: Record<string, unknown> | null = null
    let parsedAuthConfig: Record<string, unknown> | null = null
    if (formData.request_config.trim()) {
      try {
        parsedRequestConfig = JSON.parse(formData.request_config)
      } catch {
        errs.request_config = 'Invalid JSON'
      }
    }
    if (formData.field_mapping.trim()) {
      try {
        parsedFieldMapping = JSON.parse(formData.field_mapping)
      } catch {
        errs.field_mapping = 'Invalid JSON'
      }
    }
    if (formData.auth_config.trim()) {
      try {
        parsedAuthConfig = JSON.parse(formData.auth_config)
      } catch {
        errs.auth_config = 'Invalid JSON'
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    // Parse comma-separated strings to arrays
    const parseTags = (s: string) =>
      s.split(',').map(t => t.trim()).filter(Boolean)

    setSubmitting(true)
    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          adapter_key: formData.adapter_key,
          base_url: formData.base_url,
          status: formData.status,
          source_name: formData.source_name || null,
          provider_type: formData.provider_type || null,
          auth_type: formData.auth_type,
          auth_config: parsedAuthConfig,
          request_config: parsedRequestConfig,
          response_path: formData.response_path || null,
          field_mapping: parsedFieldMapping,
          keywords: parseTags(formData.keywords),
          platform_tags: parseTags(formData.platform_tags),
          country_codes: parseTags(formData.country_codes),
          regions: parseTags(formData.regions),
          fetch_interval_minutes: formData.fetch_interval_minutes,
          fetch_offset_minutes: formData.fetch_offset_minutes,
          source_score: formData.source_score,
          priority: formData.priority,
          commercial_terms: formData.commercial_terms || null,
          notes: formData.notes || null,
          max_pages_per_run: formData.max_pages_per_run,
          pagination_style: formData.pagination_style,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        setSuccessMsg('Provider updated successfully.')
        setTimeout(() => setSuccessMsg(null), 3000)
      } else {
        setError(data.error ?? 'Unknown error')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this provider? This cannot be undone. Active jobs must expire first.')) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/edit`, { method: 'DELETE' })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && data.ok) {
        router.push('/roodber8/providers')
        return
      }
      if (res.status === 409) {
        setError(data.error ?? 'Cannot delete provider with active jobs')
      } else {
        setError(data.error ?? 'Delete failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ background: ADMIN_COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: ADMIN_COLORS.textMuted }}>Loading provider...</p>
      </div>
    )
  }

  return (
    <div style={{ background: ADMIN_COLORS.bg, minHeight: '100vh', padding: '32px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
          <a href="/roodber8" style={{ color: ADMIN_COLORS.textMuted, textDecoration: 'none' }}>Command Centre</a>
          <span style={{ color: ADMIN_COLORS.textDim }}>/</span>
          <a href="/roodber8/providers" style={{ color: ADMIN_COLORS.textMuted, textDecoration: 'none' }}>Providers</a>
          <span style={{ color: ADMIN_COLORS.textDim }}>/</span>
          <a href={`/roodber8/providers/${slug}`} style={{ color: ADMIN_COLORS.textMuted, textDecoration: 'none' }}>{providerName}</a>
          <span style={{ color: ADMIN_COLORS.textDim }}>/</span>
          <span style={{ color: ADMIN_COLORS.textMuted }}>Edit</span>
        </div>

        {/* Header */}
        <h1 style={{ color: ADMIN_COLORS.text, fontWeight: 700, fontSize: '28px', marginBottom: '4px' }}>Edit Provider</h1>
        <p style={{ color: ADMIN_COLORS.textMuted, fontSize: '14px', marginBottom: '32px' }}>
          Update configuration for {providerName}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Section 1 — Identity */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Identity</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Display name shown in admin (e.g. Reed UK)</p>
                {fieldErrors.name && <p style={errorTextStyle}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label style={labelStyle}>Source Name</label>
                <input
                  type="text"
                  value={formData.source_name}
                  onChange={e => setFormData({ ...formData, source_name: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Written to jobs.source field (e.g. reed). Defaults to adapter key if blank.</p>
              </div>

              <div>
                <label style={labelStyle}>Provider Type</label>
                <select
                  value={formData.provider_type}
                  onChange={e => setFormData({ ...formData, provider_type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="api_rest">api_rest</option>
                  <option value="rss">rss</option>
                  <option value="scrape">scrape</option>
                  <option value="manual">manual</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={inputStyle}
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Priority</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Lower number = higher priority</p>
              </div>

              <div>
                <label style={labelStyle}>Commercial Terms</label>
                <select
                  value={formData.commercial_terms}
                  onChange={e => setFormData({ ...formData, commercial_terms: e.target.value })}
                  style={inputStyle}
                >
                  <option value="free">free</option>
                  <option value="affiliate">affiliate</option>
                  <option value="licensed">licensed</option>
                  <option value="negotiated">negotiated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2 — API Configuration */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>API Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Adapter</label>
                <select
                  value={formData.adapter_key}
                  onChange={e => setFormData({ ...formData, adapter_key: e.target.value })}
                  style={inputStyle}
                >
                  <option value="generic-rest">generic-rest</option>
                  <option value="adzuna">adzuna</option>
                </select>
                <p style={helperStyle}>generic-rest handles most REST JSON APIs without code changes</p>
              </div>

              <div>
                <label style={labelStyle}>Auth Type</label>
                <select
                  value={formData.auth_type}
                  onChange={e => setFormData({ ...formData, auth_type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="none">none</option>
                  <option value="api_key">api_key</option>
                  <option value="bearer">bearer</option>
                  <option value="basic">basic</option>
                </select>
              </div>

              <div className="col-span-2">
                <label style={labelStyle}>Base URL</label>
                <input
                  type="text"
                  required
                  value={formData.base_url}
                  onChange={e => setFormData({ ...formData, base_url: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Full HTTPS endpoint URL</p>
                {fieldErrors.base_url && <p style={errorTextStyle}>{fieldErrors.base_url}</p>}
              </div>

              <div>
                <label style={labelStyle}>Response Path</label>
                <input
                  type="text"
                  value={formData.response_path}
                  onChange={e => setFormData({ ...formData, response_path: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Path to jobs array in response (e.g. jobs, data.results)</p>
              </div>

              <div>
                <label style={labelStyle}>Pagination Style</label>
                <select
                  value={formData.pagination_style}
                  onChange={e => setFormData({ ...formData, pagination_style: e.target.value })}
                  style={inputStyle}
                >
                  <option value="none">none</option>
                  <option value="page">page</option>
                  <option value="offset">offset</option>
                  <option value="cursor">cursor</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Max Pages/Run</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.max_pages_per_run}
                  onChange={e => setFormData({ ...formData, max_pages_per_run: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>

              <div className="col-span-2">
                <label style={labelStyle}>Request Config</label>
                <textarea
                  rows={4}
                  value={formData.request_config}
                  onChange={e => setFormData({ ...formData, request_config: e.target.value })}
                  placeholder='{"count":"50","tag":"accounting"}'
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' as const }}
                />
                <p style={helperStyle}>JSON query params (e.g. {'{"count":"50","tag":"accounting"}'})</p>
                {fieldErrors.request_config && <p style={errorTextStyle}>{fieldErrors.request_config}</p>}
              </div>

              <div className="col-span-2">
                <label style={labelStyle}>Auth Config</label>
                <textarea
                  rows={4}
                  value={formData.auth_config}
                  onChange={e => setFormData({ ...formData, auth_config: e.target.value })}
                  placeholder='{"env_var":"MY_KEY_VAR"}'
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' as const }}
                />
                <p style={helperStyle}>
                  JSON auth configuration. For api_key: {'{"env_var":"MY_KEY_VAR"}'}.
                  NEVER store actual secrets here — reference env var names only.
                </p>
                {fieldErrors.auth_config && <p style={errorTextStyle}>{fieldErrors.auth_config}</p>}
              </div>
            </div>
          </div>

          {/* Section 3 — Field Mapping */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Field Mapping</h2>
            <div>
              <label style={labelStyle}>Field Mapping</label>
              <textarea
                rows={8}
                value={formData.field_mapping}
                onChange={e => setFormData({ ...formData, field_mapping: e.target.value })}
                placeholder={`{
  "title": "jobTitle",
  "company_name": "companyName",
  "location_text": "jobGeo",
  "description": "jobDescription",
  "application_url": "url",
  "source_job_id": "id"
}`}
                style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' as const }}
              />
              <p style={helperStyle}>
                Map canonical fields to source field names. Keys: title, company_name, location_text,
                description, application_url, source_job_id, salary_min, salary_max, salary_currency,
                salary_text, employment_type
              </p>
              {fieldErrors.field_mapping && <p style={errorTextStyle}>{fieldErrors.field_mapping}</p>}
            </div>
          </div>

          {/* Section 4 — Coverage & Schedule */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Coverage &amp; Schedule</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Platform Tags</label>
                <input
                  type="text"
                  value={formData.platform_tags}
                  onChange={e => setFormData({ ...formData, platform_tags: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Comma-separated: ab, et</p>
              </div>

              <div>
                <label style={labelStyle}>Country Codes</label>
                <input
                  type="text"
                  value={formData.country_codes}
                  onChange={e => setFormData({ ...formData, country_codes: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>ISO codes e.g. gb,us. Blank = global.</p>
              </div>

              <div>
                <label style={labelStyle}>Regions</label>
                <input
                  type="text"
                  value={formData.regions}
                  onChange={e => setFormData({ ...formData, regions: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>e.g. remote, europe</p>
              </div>

              <div>
                <label style={labelStyle}>Fetch Interval</label>
                <input
                  type="number"
                  min={60}
                  value={formData.fetch_interval_minutes}
                  onChange={e => setFormData({ ...formData, fetch_interval_minutes: Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Minutes. 1440=daily, 720=twice daily</p>
              </div>

              <div>
                <label style={labelStyle}>Fetch Offset Minutes</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={formData.fetch_offset_minutes}
                  onChange={e => setFormData({ ...formData, fetch_offset_minutes: Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Offset within the fetch interval to stagger runs (0-59 min)</p>
              </div>

              <div>
                <label style={labelStyle}>Source Score</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={formData.source_score}
                  onChange={e => setFormData({ ...formData, source_score: Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Job ranking weight. 0.65=Adzuna UK, 0.50=default</p>
              </div>

              <div>
                <label style={labelStyle}>Keywords</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={e => setFormData({ ...formData, keywords: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Comma-separated. Leave blank if provider filters by category.</p>
              </div>
            </div>
          </div>

          {/* Section 5 — Notes */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Notes</h2>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
              <p style={helperStyle}>Internal notes, API quirks, rate limits, contractual constraints.</p>
            </div>
          </div>

          {/* Submit area */}
          {successMsg && (
            <div
              style={{
                background: ADMIN_COLORS.successBg,
                borderLeft: `4px solid ${ADMIN_COLORS.success}`,
                color: ADMIN_COLORS.success,
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
              }}
            >
              {successMsg}
            </div>
          )}

          {error && (
            <div
              style={{
                background: ADMIN_COLORS.dangerBg,
                borderLeft: `4px solid ${ADMIN_COLORS.danger}`,
                color: ADMIN_COLORS.danger,
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || submitting}
              style={{
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: 700,
                color: ADMIN_COLORS.danger,
                border: '2px solid ' + ADMIN_COLORS.danger,
                background: ADMIN_COLORS.card,
                borderRadius: '8px',
                cursor: (deleting || submitting) ? 'default' : 'pointer',
              }}
            >
              {deleting ? 'Deleting...' : 'Delete Provider'}
            </button>

            <button
              type="submit"
              disabled={submitting || deleting}
              style={{
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: 700,
                color: ADMIN_COLORS.gold,
                border: '2px solid ' + ADMIN_COLORS.gold,
                background: ADMIN_COLORS.card,
                borderRadius: '8px',
                cursor: (submitting || deleting) ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
