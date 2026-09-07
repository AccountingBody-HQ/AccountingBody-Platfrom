import Link from 'next/link'
import { ChevronRight, Server } from 'lucide-react'
import ProviderForm, { EMPTY_PROVIDER_FORM } from '../ProviderForm'

export default function NewProviderPage() {
  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs mb-4">
        <Link href="/roodber8" style={{ color: '#475569' }}>Command Centre</Link>
        <ChevronRight size={12} style={{ color: '#1e293b' }} />
        <Link href="/roodber8/providers" style={{ color: '#475569' }}>Providers</Link>
        <ChevronRight size={12} style={{ color: '#1e293b' }} />
        <span style={{ color: '#64748b' }}>Add Provider</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(96,165,250,0.12)' }}>
          <Server size={20} style={{ color: '#60a5fa' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Add Provider</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Configure a new job feed source</p>
        </div>
      </div>

      <ProviderForm mode="create" initialValues={EMPTY_PROVIDER_FORM} />
    </div>
  )
}
