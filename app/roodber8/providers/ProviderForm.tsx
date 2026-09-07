'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { JobProvider } from '@/lib/providers'

const C = {
  card:  { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  input: { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, color: '#fff' },
}

export interface ProviderFormValues {
  name: string
  slug: string
  provider_type: string
  adapter_key: string
  status: string
  priority: string
  country_codes: string
  regions: string
  platform_tags: string[]
  source_score: string
  source_name: string
  base_url: string
  auth_type: string
  request_config: string
  auth_config: string
  field_mapping: string
  response_path: string
  pagination_style: string
  max_pages_per_run: string
  fetch_interval_minutes: string
  fetch_offset_minutes: string
  commercial_terms: string
  notes: string
}

export const EMPTY_PROVIDER_FORM: ProviderFormValues = {
  name: '',
  slug: '',
  provider_type: 'api_rest',
  adapter_key: 'generic-rest',
  status: 'active',
  priority: '50',
  country_codes: '',
  regions: '',
  platform_tags: [],
  source_score: '0.5',
  source_name: '',
  base_url: '',
  auth_type: 'none',
  request_config: '{}',
  auth_config: '{}',
  field_mapping: '{}',
  response_path: '',
  pagination_style: 'none',
  max_pages_per_run: '1',
  fetch_interval_minutes: '1440',
  fetch_offset_minutes: '0',
  commercial_terms: '',
  notes: '',
}

export function providerToFormValues(provider: JobProvider): ProviderFormValues {
  return {
    name: provider.name,
    slug: provider.slug,
    provider_type: provider.provider_type,
    adapter_key: provider.adapter_key,
    status: provider.status,
    priority: String(provider.priority ?? 50),
    country_codes: (provider.country_codes ?? []).join(', '),
    regions: (provider.regions ?? []).join(', '),
    platform_tags: provider.platform_tags ?? [],
    source_score: String(provider.source_score ?? 0.5),
    source_name: provider.source_name ?? '',
    base_url: provider.base_url ?? '',
    auth_type: provider.auth_type ?? 'none',
    request_config: JSON.stringify(provider.request_config ?? {}, null, 2),
    auth_config: JSON.stringify(provider.auth_config ?? {}, null, 2),
    field_mapping: JSON.stringify(provider.field_mapping ?? {}, null, 2),
    response_path: provider.response_path ?? '',
    pagination_style: provider.pagination_style ?? 'none',
    max_pages_per_run: String(provider.max_pages_per_run ?? 1),
    fetch_interval_minutes: String(provider.fetch_interval_minutes ?? 1440),
    fetch_offset_minutes: String(provider.fetch_offset_minutes ?? 0),
    commercial_terms: provider.commercial_terms ?? '',
    notes: provider.notes ?? '',
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>{label}</p>
      {children}
      {hint && <p className="text-xs mt-1.5" style={{ color: '#334155' }}>{hint}</p>}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 text-sm focus:outline-none'

export default function ProviderForm({
  mode,
  initialValues,
}: {
  mode: 'create' | 'edit'
  initialValues: ProviderFormValues
}) {
  const router = useRouter()
  const [values, setValues] = useState<ProviderFormValues>(initialValues)
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ProviderFormValues>(key: K, value: ProviderFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  function handleNameChange(name: string) {
    set('name', name)
    if (!slugTouched) {
      set('slug', slugify(name))
    }
  }

  function togglePlatformTag(tag: string) {
    setValues(prev => ({
      ...prev,
      platform_tags: prev.platform_tags.includes(tag)
        ? prev.platform_tags.filter(t => t !== tag)
        : [...prev.platform_tags, tag],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!values.name.trim()) return setError('Name is required')
    if (!values.slug.trim()) return setError('Slug is required')
    if (!values.base_url.trim()) return setError('Base URL is required')
    if (!values.adapter_key.trim()) return setError('Adapter Key is required')

    for (const [label, json] of [
      ['Request Config', values.request_config],
      ['Auth Config', values.auth_config],
      ['Field Mapping', values.field_mapping],
    ] as const) {
      try {
        JSON.parse(json)
      } catch {
        return setError(`${label} must be valid JSON`)
      }
    }

    setSubmitting(true)
    try {
      const url = mode === 'create'
        ? '/api/roodber8/providers/new'
        : `/api/roodber8/providers/${initialValues.slug}/edit`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data: { ok?: boolean; slug?: string; error?: string } = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Something went wrong')
        setSubmitting(false)
        return
      }

      router.push(`/roodber8/providers/${data.slug ?? values.slug}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete provider "${values.name}"? This cannot be undone.`)) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/roodber8/providers/${initialValues.slug}/edit`, {
        method: 'DELETE',
      })
      const data: { ok?: boolean; error?: string } = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Failed to delete provider')
        setDeleting(false)
        return
      }

      router.push('/roodber8/providers')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete provider')
      setDeleting(false)
    }
  }

  const busy = submitting || deleting

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Basic */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Basic</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input type="text" value={values.name} onChange={e => handleNameChange(e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
          <Field label="Slug" hint="Auto-generated from name, editable">
            <input type="text" value={values.slug}
              onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)) }}
              className={inputClass} style={C.input} disabled={mode === 'edit'} />
          </Field>
          <Field label="Provider Type">
            <select value={values.provider_type} onChange={e => set('provider_type', e.target.value)}
              className={inputClass} style={C.input}>
              <option value="api_rest">api_rest</option>
              <option value="api_graphql">api_graphql</option>
              <option value="rss_feed">rss_feed</option>
              <option value="scrape">scrape</option>
            </select>
          </Field>
          <Field label="Adapter Key">
            <select value={values.adapter_key} onChange={e => set('adapter_key', e.target.value)}
              className={inputClass} style={C.input}>
              <option value="adzuna">adzuna</option>
              <option value="generic-rest">generic-rest</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={values.status} onChange={e => set('status', e.target.value)}
              className={inputClass} style={C.input}>
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </Field>
          <Field label="Priority">
            <input type="number" value={values.priority} onChange={e => set('priority', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
        </div>
      </div>

      {/* Coverage */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Coverage</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Country Codes" hint="Comma-separated, e.g. gb, us">
            <input type="text" value={values.country_codes} onChange={e => set('country_codes', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
          <Field label="Regions" hint="Comma-separated">
            <input type="text" value={values.regions} onChange={e => set('regions', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
        </div>
        <Field label="Platform Tags">
          <div className="flex items-center gap-4">
            {['ab', 'et'].map(tag => (
              <label key={tag} className="flex items-center gap-2 text-sm" style={{ color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  checked={values.platform_tags.includes(tag)}
                  onChange={() => togglePlatformTag(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </Field>
      </div>

      {/* Source */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Source</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Source Score" hint="0.0 – 1.0">
            <input type="number" step="0.01" min="0" max="1" value={values.source_score}
              onChange={e => set('source_score', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
          <Field label="Source Name">
            <input type="text" value={values.source_name} onChange={e => set('source_name', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
        </div>
      </div>

      {/* Endpoint */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Endpoint</p>
        <Field label="Base URL">
          <input type="text" value={values.base_url} onChange={e => set('base_url', e.target.value)}
            className={inputClass} style={C.input} />
        </Field>
        <Field label="Auth Type">
          <select value={values.auth_type} onChange={e => set('auth_type', e.target.value)}
            className={inputClass} style={C.input}>
            <option value="none">none</option>
            <option value="api_key">api_key</option>
            <option value="bearer">bearer</option>
            <option value="basic">basic</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Request Config" hint="JSON">
            <textarea rows={5} value={values.request_config} onChange={e => set('request_config', e.target.value)}
              className={`${inputClass} font-mono resize-none`} style={C.input} />
          </Field>
          <Field label="Auth Config" hint="JSON">
            <textarea rows={5} value={values.auth_config} onChange={e => set('auth_config', e.target.value)}
              className={`${inputClass} font-mono resize-none`} style={C.input} />
          </Field>
        </div>
      </div>

      {/* Field Mapping */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Field Mapping</p>
        <Field label="Field Mapping" hint="Maps our field names to provider field names — JSON">
          <textarea rows={5} value={values.field_mapping} onChange={e => set('field_mapping', e.target.value)}
            className={`${inputClass} font-mono resize-none`} style={C.input} />
        </Field>
      </div>

      {/* Response */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Response</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Response Path" hint="e.g. jobs">
            <input type="text" value={values.response_path} onChange={e => set('response_path', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
          <Field label="Pagination Style">
            <select value={values.pagination_style} onChange={e => set('pagination_style', e.target.value)}
              className={inputClass} style={C.input}>
              <option value="none">none</option>
              <option value="page">page</option>
              <option value="offset">offset</option>
              <option value="cursor">cursor</option>
            </select>
          </Field>
          <Field label="Max Pages Per Run">
            <input type="number" value={values.max_pages_per_run} onChange={e => set('max_pages_per_run', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Schedule</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fetch Interval Minutes">
            <input type="number" value={values.fetch_interval_minutes} onChange={e => set('fetch_interval_minutes', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
          <Field label="Fetch Offset Minutes">
            <input type="number" value={values.fetch_offset_minutes} onChange={e => set('fetch_offset_minutes', e.target.value)}
              className={inputClass} style={C.input} />
          </Field>
        </div>
      </div>

      {/* Meta */}
      <div className="rounded-2xl border p-5 space-y-4" style={C.card}>
        <p className="text-white font-bold text-sm">Meta</p>
        <Field label="Commercial Terms">
          <input type="text" value={values.commercial_terms} onChange={e => set('commercial_terms', e.target.value)}
            className={inputClass} style={C.input} />
        </Field>
        <Field label="Notes">
          <textarea rows={3} value={values.notes} onChange={e => set('notes', e.target.value)}
            className={`${inputClass} resize-none`} style={C.input} />
        </Field>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
          style={{ background: '#D4A017', color: '#0d1424', opacity: busy ? 0.6 : 1 }}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {mode === 'create' ? 'Create Provider' : 'Save Changes'}
        </button>

        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', opacity: busy ? 0.6 : 1 }}
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Delete Provider
          </button>
        )}
      </div>
    </form>
  )
}
