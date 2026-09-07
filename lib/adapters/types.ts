import type { JobProvider } from '../providers'

// Raw job object from a provider API — provider-native field names, unknown shape
export type RawJob = Record<string, unknown>

// Every adapter must implement this interface
export interface ProviderAdapter {
  fetch(provider: JobProvider): Promise<RawJob[]>
}
