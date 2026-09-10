'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ADMIN_COLORS } from '@/lib/admin-theme'

// ── Canonical fields a field_mapping can target ──────────────────────────────
// This list mirrors exactly the `mapping.X` call sites in
// lib/ingestion/normalise.ts — nothing else is read from field_mapping.
const CANONICAL_FIELDS = [
  'title',
  'company_name',
  'location_text',
  'description',
  'application_url',
  'source_job_id',
  'source_url',
  'location_country',
  'salary_min',
  'salary_max',
  'salary_currency',
  'salary_text',
  'salary_is_predicted',
  'employment_type',
  'seniority_level',
] as const
type CanonicalField = (typeof CANONICAL_FIELDS)[number]

// Activate requires these four to have a non-empty mapped path.
const REQUIRED_FIELDS: CanonicalField[] = [
  'title',
  'company_name',
  'location_text',
  'description',
]

// ── API response shapes ─────────────────────────────────────────────────────
interface ProviderMeta {
  slug: string
  name: string
  adapter_key: string
  status: string
}

interface ProviderGetResponse {
  provider?: {
    slug: string
    name: string
    adapter_key: string
    status: string
    field_mapping: Record<string, string> | null
    country_codes: string[] | null
    regions: string[] | null
    platform_tags: string[] | null
    keywords: string[] | null
  }
  error?: string
}

type Verdict = 'would_insert' | 'would_deduplicate' | 'would_reject'

interface PreviewRelevance {
  relevant: boolean
  titleMatches: string[]
  descriptionMatches: string[]
  decidedBy: 'title' | 'description' | 'none'
}

interface PreviewSample {
  raw: unknown
  normalised: Record<string, unknown>
  verdict: Verdict
  reject_reason: string | null
  quality_flags: string[]
  relevance: PreviewRelevance
}

interface PreviewTotals {
  fetched: number
  would_insert: number
  would_deduplicate: number
  would_reject: number
  duration_ms: number
}

interface PreviewResponse {
  ok: boolean
  error?: string
  totals?: PreviewTotals
  samples?: PreviewSample[]
}

interface EditPatchResponse {
  ok?: boolean
  error?: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Path helpers — produce the exact syntax resolvePath() expects ────────────
function childObjectPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key
}
function childArrayPath(parent: string, index: number): string {
  // resolveSinglePath rewrites `[n]` -> `.n`, so `tags[0]` / `locations[0].name`
  return `${parent}[${index}]`
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// ── Styling (reused admin tokens only) ──────────────────────────────────────
const pageStyle = { background: ADMIN_COLORS.bg, minHeight: '100vh', padding: '32px' }
const sectionStyle = {
  background: ADMIN_COLORS.card,
  border: `1px solid ${ADMIN_COLORS.border}`,
  borderRadius: '8px',
  padding: '20px',
}
const sectionTitleStyle = {
  color: ADMIN_COLORS.text,
  fontSize: '13px',
  fontWeight: 700 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '14px',
}
const labelStyle = {
  color: ADMIN_COLORS.textMuted,
  fontSize: '12px',
  fontWeight: 600 as const,
  display: 'block',
  marginBottom: '4px',
}
const inputStyle = {
  background: ADMIN_COLORS.bg,
  border: `1px solid ${ADMIN_COLORS.border}`,
  color: ADMIN_COLORS.text,
  borderRadius: '6px',
  padding: '7px 10px',
  width: '100%',
  fontSize: '13px',
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box' as const,
}
const inputFocusedStyle = { ...inputStyle, border: `1px solid ${ADMIN_COLORS.gold}` }
const helperStyle = { color: ADMIN_COLORS.textDim, fontSize: '11px', marginTop: '3px' }
const nodeToggleStyle = {
  background: 'transparent',
  border: 'none',
  padding: '2px 0',
  fontSize: '12px',
  fontFamily: 'monospace',
  cursor: 'pointer',
  textAlign: 'left' as const,
  display: 'block',
}
const leafButtonStyle = {
  background: 'transparent',
  border: 'none',
  padding: '2px 4px',
  fontSize: '12px',
  fontFamily: 'monospace',
  cursor: 'pointer',
  textAlign: 'left' as const,
  display: 'block',
  borderRadius: '4px',
}

// ── Recursive JSON tree ─────────────────────────────────────────────────────
function JsonTreeNode({
  nodeKey,
  value,
  path,
  depth,
  onPickLeaf,
}: {
  nodeKey: string
  value: unknown
  path: string
  depth: number
  onPickLeaf: (p: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const indentStyle = { paddingLeft: depth === 0 ? 0 : 14 }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    return (
      <div style={indentStyle}>
        <button type="button" onClick={() => setOpen(o => !o)} style={nodeToggleStyle}>
          <span style={{ color: ADMIN_COLORS.textDim }}>{open ? '▾' : '▸'}</span>{' '}
          <span style={{ color: ADMIN_COLORS.textMuted }}>{nodeKey}</span>{' '}
          <span style={{ color: ADMIN_COLORS.textDim }}>{`{${entries.length}}`}</span>
        </button>
        {open &&
          entries.map(([k, v]) => (
            <JsonTreeNode
              key={k}
              nodeKey={k}
              value={v}
              path={childObjectPath(path, k)}
              depth={depth + 1}
              onPickLeaf={onPickLeaf}
            />
          ))}
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <div style={indentStyle}>
        <button type="button" onClick={() => setOpen(o => !o)} style={nodeToggleStyle}>
          <span style={{ color: ADMIN_COLORS.textDim }}>{open ? '▾' : '▸'}</span>{' '}
          <span style={{ color: ADMIN_COLORS.textMuted }}>{nodeKey}</span>{' '}
          <span style={{ color: ADMIN_COLORS.textDim }}>{`[${value.length}]`}</span>
        </button>
        {open &&
          value.map((v, i) => (
            <JsonTreeNode
              key={i}
              nodeKey={`[${i}]`}
              value={v}
              path={childArrayPath(path, i)}
              depth={depth + 1}
              onPickLeaf={onPickLeaf}
            />
          ))}
      </div>
    )
  }

  const display =
    value === null
      ? 'null'
      : typeof value === 'string'
        ? `"${value}"`
        : String(value)

  return (
    <div style={indentStyle}>
      <button
        type="button"
        onClick={() => onPickLeaf(path)}
        style={leafButtonStyle}
        title={`Map path "${path}" into the selected canonical field`}
      >
        <span style={{ color: ADMIN_COLORS.textMuted }}>{nodeKey}</span>
        <span style={{ color: ADMIN_COLORS.textDim }}>: </span>
        <span style={{ color: ADMIN_COLORS.gold }}>{truncate(display, 64)}</span>
      </button>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ProviderMapPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [providerMeta, setProviderMeta] = useState<ProviderMeta | null>(null)

  const emptyMapping = useMemo(() => {
    const m = {} as Record<CanonicalField, string>
    for (const f of CANONICAL_FIELDS) m[f] = ''
    return m
  }, [])
  const [mapping, setMapping] = useState<Record<CanonicalField, string>>(emptyMapping)
  const [focusedField, setFocusedField] = useState<CanonicalField | null>(null)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  // Refs the debounced save reads so it never captures stale state.
  const mappingRef = useRef<Record<CanonicalField, string>>(emptyMapping)
  const preserveRef = useRef<{
    country_codes: string[]
    regions: string[]
    platform_tags: string[]
    keywords: string[]
  }>({ country_codes: [], regions: [], platform_tags: [], keywords: [] })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonic token: a newer change invalidates an in-flight save/preview.
  const saveSeq = useRef(0)

  // Build the object sent as field_mapping — only non-empty entries.
  function currentMappingObject(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(mappingRef.current)) {
      if (v.trim() !== '') out[k] = v.trim()
    }
    return out
  }

  // Fields the edit route's toArray() helper would blank if omitted from a
  // partial PATCH — echo them back unchanged so an auto-save can't wipe them.
  function preservedArrays() {
    return {
      country_codes: preserveRef.current.country_codes,
      regions: preserveRef.current.regions,
      platform_tags: preserveRef.current.platform_tags,
      keywords: preserveRef.current.keywords,
    }
  }

  async function fetchPreview(seq: number) {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSize: 1 }),
      })
      const data = (await res.json()) as PreviewResponse
      if (seq !== saveSeq.current) return
      if (!res.ok || !data.ok) {
        setPreviewError(data.error ?? 'Preview failed')
        setPreview(null)
      } else {
        setPreview(data)
        setPreviewError(null)
      }
    } catch (err) {
      if (seq !== saveSeq.current) return
      setPreviewError(err instanceof Error ? err.message : 'Preview network error')
      setPreview(null)
    } finally {
      if (seq === saveSeq.current) setPreviewLoading(false)
    }
  }

  // SEQUENCED: PATCH the mapping, await it, and only then re-run the preview —
  // the preview route reads field_mapping from the DB, so a preview fired
  // before the save lands would show stale results.
  async function saveThenPreview() {
    const seq = ++saveSeq.current
    setSaveState('saving')
    setSaveError(null)
    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_mapping: currentMappingObject(),
          ...preservedArrays(),
        }),
      })
      const data = (await res.json()) as EditPatchResponse
      if (seq !== saveSeq.current) return
      if (!res.ok || !data.ok) {
        setSaveState('error')
        setSaveError(data.error ?? 'Save failed')
        return
      }
      setSaveState('saved')
      await fetchPreview(seq)
    } catch (err) {
      if (seq !== saveSeq.current) return
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'Save network error')
    }
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveThenPreview()
    }, 500)
  }

  function updateMapping(field: CanonicalField, value: string) {
    setMapping(prev => {
      const next = { ...prev, [field]: value }
      mappingRef.current = next
      return next
    })
    scheduleSave()
  }

  function handlePickLeaf(path: string) {
    if (!focusedField) return
    updateMapping(focusedField, path)
  }

  // ── Initial load: GET provider, then one preview (no PATCH needed — the DB
  //    already holds the saved mapping). ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/roodber8/providers/${slug}`)
        const data = (await res.json()) as ProviderGetResponse
        if (cancelled) return
        if (!res.ok || !data.provider) {
          setLoadError(data.error ?? 'Failed to load provider')
          setLoading(false)
          return
        }
        const p = data.provider
        setProviderMeta({
          slug: p.slug,
          name: p.name,
          adapter_key: p.adapter_key,
          status: p.status,
        })
        preserveRef.current = {
          country_codes: p.country_codes ?? [],
          regions: p.regions ?? [],
          platform_tags: p.platform_tags ?? [],
          keywords: p.keywords ?? [],
        }
        const initial = {} as Record<CanonicalField, string>
        for (const f of CANONICAL_FIELDS) initial[f] = p.field_mapping?.[f] ?? ''
        mappingRef.current = initial
        setMapping(initial)
        setLoading(false)

        const seq = saveSeq.current
        await fetchPreview(seq)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load provider')
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    []
  )

  const rawSample: unknown = preview?.samples?.[0]?.raw ?? null
  const sample = preview?.samples?.[0] ?? null
  const totals = preview?.totals ?? null

  const canActivate = useMemo(() => {
    const allRequiredMapped = REQUIRED_FIELDS.every(f => (mapping[f] ?? '').trim() !== '')
    const wouldInsert = (totals?.would_insert ?? 0) > 0
    return allRequiredMapped && wouldInsert && saveState !== 'saving' && !activating
  }, [mapping, totals, saveState, activating])

  async function handleActivate() {
    setActivating(true)
    setActivateError(null)
    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          field_mapping: currentMappingObject(),
          ...preservedArrays(),
        }),
      })
      const data = (await res.json()) as EditPatchResponse
      if (res.ok && data.ok) {
        router.push(`/roodber8/providers/${slug}`)
        return
      }
      setActivateError(data.error ?? 'Activation failed')
      setActivating(false)
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Activation network error')
      setActivating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: ADMIN_COLORS.textMuted }}>Loading provider…</p>
      </div>
    )
  }

  if (loadError || !providerMeta) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            ...sectionStyle,
            borderLeft: `4px solid ${ADMIN_COLORS.danger}`,
            color: ADMIN_COLORS.danger,
            maxWidth: 640,
          }}
        >
          {loadError ?? 'Provider not found'}
        </div>
      </div>
    )
  }

  const saveIndicator =
    saveState === 'saving'
      ? { text: 'Saving…', color: ADMIN_COLORS.textMuted }
      : saveState === 'saved'
        ? { text: 'Saved', color: ADMIN_COLORS.success }
        : saveState === 'error'
          ? { text: saveError ?? 'Save failed', color: ADMIN_COLORS.danger }
          : { text: '', color: ADMIN_COLORS.textDim }

  const verdictColor =
    sample?.verdict === 'would_insert'
      ? ADMIN_COLORS.success
      : sample?.verdict === 'would_reject'
        ? ADMIN_COLORS.danger
        : ADMIN_COLORS.warning

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
          <a href="/roodber8" style={{ color: ADMIN_COLORS.textMuted, textDecoration: 'none' }}>
            Command Centre
          </a>
          <span style={{ color: ADMIN_COLORS.textDim }}>/</span>
          <a href="/roodber8/providers" style={{ color: ADMIN_COLORS.textMuted, textDecoration: 'none' }}>
            Providers
          </a>
          <span style={{ color: ADMIN_COLORS.textDim }}>/</span>
          <a
            href={`/roodber8/providers/${slug}`}
            style={{ color: ADMIN_COLORS.textMuted, textDecoration: 'none' }}
          >
            {providerMeta.name}
          </a>
          <span style={{ color: ADMIN_COLORS.textDim }}>/</span>
          <span style={{ color: ADMIN_COLORS.textMuted }}>Map fields</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
          <div>
            <h1 style={{ color: ADMIN_COLORS.text, fontWeight: 700, fontSize: '26px', marginBottom: 2 }}>
              Map fields — {providerMeta.name}
            </h1>
            <p style={{ color: ADMIN_COLORS.textMuted, fontSize: 13 }}>
              Click a value on the left, then a field on the right, to bind it. Saves and re-previews automatically.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{ fontSize: 12, color: saveIndicator.color, minHeight: 16 }}>{saveIndicator.text}</span>
            <button
              type="button"
              onClick={() => void handleActivate()}
              disabled={!canActivate}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 8,
                border: `2px solid ${canActivate ? ADMIN_COLORS.gold : ADMIN_COLORS.border}`,
                background: ADMIN_COLORS.card,
                color: canActivate ? ADMIN_COLORS.gold : ADMIN_COLORS.textDim,
                cursor: canActivate ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {activating ? 'Activating…' : 'Activate provider'}
            </button>
            {activateError && (
              <span style={{ color: ADMIN_COLORS.danger, fontSize: 11 }}>{activateError}</span>
            )}
          </div>
        </div>

        {providerMeta.adapter_key !== 'generic-rest' && (
          <div
            style={{
              ...sectionStyle,
              borderLeft: `4px solid ${ADMIN_COLORS.warning}`,
              color: ADMIN_COLORS.warning,
              fontSize: 12,
              marginBottom: 12,
              padding: '10px 14px',
            }}
          >
            This provider&rsquo;s adapter is{' '}
            <code style={{ fontFamily: 'monospace' }}>{providerMeta.adapter_key}</code>. Field mapping
            is intended for <code style={{ fontFamily: 'monospace' }}>generic-rest</code> providers.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* LEFT — raw JSON tree */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Raw sample payload</div>
            {previewError && (
              <p style={{ color: ADMIN_COLORS.danger, fontSize: 12, marginBottom: 8 }}>{previewError}</p>
            )}
            {rawSample == null ? (
              <p style={{ color: ADMIN_COLORS.textDim, fontSize: 13 }}>
                {previewLoading
                  ? 'Fetching a sample from the provider…'
                  : 'No sample rows returned by the provider preview.'}
              </p>
            ) : (
              <div
                style={{
                  background: ADMIN_COLORS.bg,
                  border: `1px solid ${ADMIN_COLORS.border}`,
                  borderRadius: 6,
                  padding: 12,
                  maxHeight: 560,
                  overflow: 'auto',
                }}
              >
                <JsonTreeNode
                  nodeKey="(root)"
                  value={rawSample}
                  path=""
                  depth={0}
                  onPickLeaf={handlePickLeaf}
                />
              </div>
            )}
            <p style={helperStyle}>
              Only leaf values are clickable. Nested keys join with dots; array items use{' '}
              <code style={{ fontFamily: 'monospace' }}>name[0]</code>. You can also type a path
              directly — <code style={{ fontFamily: 'monospace' }}>__constant:GBP</code> for a literal,
              or <code style={{ fontFamily: 'monospace' }}>a.b|c|d</code> for a fallback chain.
            </p>
          </div>

          {/* RIGHT — canonical field rows */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Canonical fields</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CANONICAL_FIELDS.map(field => {
                const isFocused = focusedField === field
                const isRequired = REQUIRED_FIELDS.includes(field)
                return (
                  <div key={field}>
                    <label style={labelStyle}>
                      {field}
                      {isRequired && <span style={{ color: ADMIN_COLORS.gold }}> *</span>}
                    </label>
                    <input
                      type="text"
                      value={mapping[field]}
                      placeholder="(unmapped)"
                      onFocus={() => setFocusedField(field)}
                      onChange={e => updateMapping(field, e.target.value)}
                      style={isFocused ? inputFocusedStyle : inputStyle}
                    />
                  </div>
                )
              })}
            </div>
            <p style={helperStyle}>
              The focused field (gold border) receives the next value you click on the left.
              <span style={{ color: ADMIN_COLORS.gold }}> *</span> required before the provider can be
              activated.
            </p>
          </div>
        </div>

        {/* RESULT panel */}
        <div style={{ ...sectionStyle, marginTop: 20 }}>
          <div style={sectionTitleStyle}>
            Preview result {previewLoading && <span style={{ color: ADMIN_COLORS.textDim }}>· refreshing…</span>}
          </div>

          {!preview || !preview.ok ? (
            <p style={{ color: ADMIN_COLORS.textDim, fontSize: 13 }}>
              {previewError ?? 'No preview yet.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* verdict + relevance + totals */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 999,
                      color: verdictColor,
                      border: `1px solid ${verdictColor}`,
                    }}
                  >
                    {sample?.verdict ?? '—'}
                  </span>
                  {sample?.reject_reason && (
                    <span style={{ color: ADMIN_COLORS.danger, fontSize: 12 }}>
                      {sample.reject_reason}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginBottom: 4 }}>
                  Relevance decided by:{' '}
                  <span style={{ color: ADMIN_COLORS.text }}>{sample?.relevance.decidedBy ?? '—'}</span>
                </div>
                <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginBottom: 4 }}>
                  Title matches:{' '}
                  <span style={{ color: ADMIN_COLORS.text }}>
                    {sample && sample.relevance.titleMatches.length > 0
                      ? sample.relevance.titleMatches.join(', ')
                      : '—'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginBottom: 12 }}>
                  Description matches:{' '}
                  <span style={{ color: ADMIN_COLORS.text }}>
                    {sample && sample.relevance.descriptionMatches.length > 0
                      ? sample.relevance.descriptionMatches.join(', ')
                      : '—'}
                  </span>
                </div>

                {totals && (
                  <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
                    fetched {totals.fetched} · would_insert{' '}
                    <span style={{ color: ADMIN_COLORS.success }}>{totals.would_insert}</span> ·
                    would_reject{' '}
                    <span style={{ color: ADMIN_COLORS.danger }}>{totals.would_reject}</span> ·
                    would_deduplicate{' '}
                    <span style={{ color: ADMIN_COLORS.warning }}>{totals.would_deduplicate}</span>
                  </div>
                )}
              </div>

              {/* normalised populated fields */}
              <div>
                <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginBottom: 6 }}>
                  Normalised job (populated fields)
                </div>
                {sample ? (
                  <div
                    style={{
                      background: ADMIN_COLORS.bg,
                      border: `1px solid ${ADMIN_COLORS.border}`,
                      borderRadius: 6,
                      padding: 10,
                      maxHeight: 320,
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {Object.entries(sample.normalised)
                      .filter(
                        ([k, v]) =>
                          k !== 'raw_source_data' &&
                          v !== null &&
                          v !== undefined &&
                          v !== '' &&
                          !(Array.isArray(v) && v.length === 0)
                      )
                      .map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 2 }}>
                          <span style={{ color: ADMIN_COLORS.textMuted }}>{k}</span>
                          <span style={{ color: ADMIN_COLORS.textDim }}>: </span>
                          <span style={{ color: ADMIN_COLORS.text }}>
                            {truncate(
                              typeof v === 'string' ? v : JSON.stringify(v),
                              200
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p style={{ color: ADMIN_COLORS.textDim, fontSize: 13 }}>No normalised sample.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
