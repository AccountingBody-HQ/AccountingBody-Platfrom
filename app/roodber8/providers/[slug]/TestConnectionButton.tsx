'use client'
import { useState } from 'react'
import { Zap } from 'lucide-react'

interface TestResult {
  ok: boolean
  status?: number
  responseMs?: number
  jobCount?: number
  message?: string
  error?: string
}

export default function TestConnectionButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  async function handleTest() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/test`, { method: 'POST' })
      const data = (await res.json()) as TestResult
      setResult(data)
    } catch {
      setResult({ ok: false, error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleTest}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={{
          background: loading ? 'rgba(148,163,184,0.08)' : 'rgba(96,165,250,0.1)',
          color: loading ? '#475569' : '#60a5fa',
          border: '1px solid rgba(96,165,250,0.2)',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        <Zap size={13} />
        {loading ? 'Testing…' : 'Test Connection'}
      </button>
      {result && (
        <div className="px-3 py-2 rounded-lg text-xs font-mono"
          style={{
            background: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${result.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: result.ok ? '#34d399' : '#f87171',
          }}>
          {result.ok
            ? `✓ ${result.message} (${result.responseMs}ms)`
            : `✗ ${result.error}`}
        </div>
      )}
    </div>
  )
}
