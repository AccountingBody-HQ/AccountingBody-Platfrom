import type { ProviderAdapter } from './types'
import { adzunaAdapter } from './adzuna'

// Adapter registry — add new adapters here as they are built
const ADAPTERS: Record<string, ProviderAdapter> = {
  'adzuna': adzunaAdapter,
}

// Returns the correct adapter for a provider's adapter_key.
// Throws if the adapter_key is not registered.
export function getAdapter(adapterKey: string): ProviderAdapter {
  const adapter = ADAPTERS[adapterKey]
  if (!adapter) {
    throw new Error(`No adapter registered for key: "${adapterKey}". Register it in lib/adapters/index.ts`)
  }
  return adapter
}
