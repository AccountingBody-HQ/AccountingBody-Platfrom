import type { ProviderAdapter } from './types'
import { adzunaAdapter } from './adzuna'
import { genericRestAdapter } from './generic-rest'
import { rssAdapter } from './rss'

/**
 * Adapter registry.
 * To add a new adapter type: create the file in lib/adapters/, import it here, add the key.
 * No other file needs to change to support a new adapter type.
 */
const ADAPTERS: Record<string, ProviderAdapter> = {
  'adzuna':        adzunaAdapter,
  'generic-rest':  genericRestAdapter,
  'rss':           rssAdapter,
}

/**
 * Every adapter_key the registry can actually run, derived from ADAPTERS so
 * it can never drift from what's wired up. The provider create/edit API
 * routes validate submitted adapter_key values against this list.
 */
export const REGISTERED_ADAPTER_KEYS: readonly string[] = Object.keys(ADAPTERS)

/** True when `key` is an adapter_key the registry can run. */
export function isRegisteredAdapterKey(key: unknown): key is string {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(ADAPTERS, key)
}

/**
 * Returns the correct adapter for a provider's adapter_key.
 * Throws a clear error if the adapter_key is not registered.
 */
export function getAdapter(adapterKey: string): ProviderAdapter {
  const adapter = ADAPTERS[adapterKey]
  if (!adapter) {
    throw new Error(
      `No adapter registered for key: "${adapterKey}". ` +
      `Registered adapters: ${Object.keys(ADAPTERS).join(', ')}. ` +
      `Add the new adapter to lib/adapters/index.ts.`
    )
  }
  return adapter
}
