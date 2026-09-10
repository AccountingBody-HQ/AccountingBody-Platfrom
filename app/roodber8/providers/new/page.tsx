'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_COLORS } from '@/lib/admin-theme'
import {
  AUTH_TYPE_OPTIONS,
  PAGINATION_STYLE_OPTIONS,
  buildSelectOptions,
} from '../provider-form-options'

export default function AddProviderPage() {
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  const [formData, setFormData] = useState({
    slug: '',
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
    enforce_relevance: false,
    rate_limit_rpm: null as number | null,
    rate_limit_daily: null as number | null,
    data_ownership: '',
  })

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

  function handleNameChange(value: string) {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: slugManuallyEdited ? prev.slug : value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    }))
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true)
    setFormData(prev => ({ ...prev, slug: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Client-side validation
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Name is required'
    if (!/^[a-z0-9-]+$/.test(formData.slug))
      errs.slug = 'Slug must be lowercase letters, numbers and hyphens only'
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
      const res = await fetch('/api/roodber8/providers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: formData.slug,
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
          enforce_relevance: formData.enforce_relevance,
          rate_limit_rpm: formData.rate_limit_rpm,
          rate_limit_daily: formData.rate_limit_daily,
          data_ownership: formData.data_ownership || null,
        }),
      })
      const data = await res.json() as { ok?: boolean; slug?: string; error?: string }
      if (res.status === 201 && data.slug) {
        router.push('/roodber8/providers/' + data.slug)
      } else {
        setError(data.error ?? 'Unknown error')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
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
          <span style={{ color: ADMIN_COLORS.textMuted }}>Add Provider</span>
        </div>

        {/* Header */}
        <h1 style={{ color: ADMIN_COLORS.text, fontWeight: 700, fontSize: '28px', marginBottom: '4px' }}>Add Provider</h1>
        <p style={{ color: ADMIN_COLORS.textMuted, fontSize: '14px', marginBottom: '32px' }}>
          Configure a new job ingestion source
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
                  onChange={e => handleNameChange(e.target.value)}
                  style={inputStyle}
                />
                <p style={helperStyle}>Display name shown in admin (e.g. Reed UK)</p>
                {fieldErrors.name && <p style={errorTextStyle}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label style={labelStyle}>Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  style={inputStyle}
                />
                <p style={helperStyle}>Lowercase, hyphens only (e.g. reed-uk). Auto-derived from name.</p>
                {fieldErrors.slug && <p style={errorTextStyle}>{fieldErrors.slug}</p>}
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
                  {buildSelectOptions(AUTH_TYPE_OPTIONS, formData.auth_type).map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p style={helperStyle}>
                  api_key and api_key_query both send the key as a query param; api_key_header sends it as a header.
                </p>
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
                  {buildSelectOptions(PAGINATION_STYLE_OPTIONS, formData.pagination_style).map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p style={helperStyle}>
                  page_number is used by the Adzuna adapter (which paginates on its own); generic-rest understands none/page/offset/cursor.
                </p>
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

          {/* Section 2b — Relevance & Rate Limits */}
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Relevance &amp; Rate Limits</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none', letterSpacing: 'normal', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={formData.enforce_relevance}
                    onChange={e => setFormData({ ...formData, enforce_relevance: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: ADMIN_COLORS.gold }}
                  />
                  Enforce relevance (Rule 104)
                </label>
                <p style={helperStyle}>
                  ON: any job that fails the relevance check is rejected outright. OFF: only choose this once the
                  provider&rsquo;s own API filtering (category / tag) has been tested and confirmed via the preview
                  endpoint — do not assume a new provider&rsquo;s filter is reliable without testing it first.
                </p>
              </div>

              <div>
                <label style={labelStyle}>Rate Limit (req/min)</label>
                <input
                  type="number"
                  min={1}
                  value={formData.rate_limit_rpm ?? ''}
                  onChange={e => setFormData({ ...formData, rate_limit_rpm: e.target.value === '' ? null : Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Optional. Blank = unlimited.</p>
              </div>

              <div>
                <label style={labelStyle}>Rate Limit (req/day)</label>
                <input
                  type="number"
                  min={1}
                  value={formData.rate_limit_daily ?? ''}
                  onChange={e => setFormData({ ...formData, rate_limit_daily: e.target.value === '' ? null : Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Optional. Blank = unlimited. A run is skipped once requests today reaches this.</p>
              </div>

              <div>
                <label style={labelStyle}>Data Ownership</label>
                <input
                  type="text"
                  value={formData.data_ownership}
                  onChange={e => setFormData({ ...formData, data_ownership: e.target.value })}
                  style={inputStyle}
                />
                <p style={helperStyle}>Free text: licensing / ownership basis for the ingested data (e.g. owned, licensed, affiliate-feed).</p>
              </div>

              {formData.adapter_key === 'adzuna' && (
                <div>
                  <label style={labelStyle}>Keyword Cursor</label>
                  <input type="text" value="0" readOnly disabled style={{ ...inputStyle, opacity: 0.6 }} />
                  <p style={helperStyle}>
                    Diagnostic only. Starts at 0 and advances automatically as the Adzuna adapter rotates through its
                    keyword list. Editable from the provider&rsquo;s Edit page once it has been created.
                  </p>
                </div>
              )}
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
                <label style={labelStyle}>Fetch Offset (min)</label>
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

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              color: ADMIN_COLORS.gold,
              border: '2px solid ' + ADMIN_COLORS.gold,
              background: ADMIN_COLORS.card,
              borderRadius: '8px',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Adding...' : 'Add Provider'}
          </button>
        </form>
      </div>
    </div>
  )
}
