'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2 } from 'lucide-react'

interface TriggerResult {
  ok: boolean
  inserted?: number
  fetched?: number
  error?: string
  skipped?: boolean
  reason?: string
}

export default function RunNowButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  async function handleClick() {
    if (state === 'loading') return
    setState('loading')
    setMessage('')

    try {
      const res = await fetch(`/api/roodber8/providers/${slug}/trigger`, {
        method: 'POST',
      })
      const data = (await res.json()) as TriggerResult

      if (!res.ok || data.ok === false) {
        setState('error')
        setMessage(data.error ?? 'Run failed')
      } else if (data.skipped) {
        setState('error')
        setMessage(data.reason ?? 'Run skipped')
      } else {
        setState('success')
        setMessage(`+${data.inserted ?? 0} jobs inserted`)
      }
    } catch (err: unknown) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setTimeout(() => {
        router.refresh()
      }, 2000)
    }
  }

  const isLoading = state === 'loading'

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span
          className="text-xs font-semibold"
          style={{ color: state === 'success' ? '#34d399' : '#f87171' }}
        >
          {message}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
        style={{
          background: '#D4A017',
          color: '#0d1424',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {isLoading ? 'Running…' : 'Run Now'}
      </button>
    </div>
  )
}
