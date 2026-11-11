/**
 * A provider's model list, fetched from the provider by the backend (cached there
 * for a day). Falls back to the built-in list while loading or when the provider
 * cannot be asked (no key, no network).
 */

import { useCallback, useEffect, useState } from 'react'
import { listProviderModels } from '../api'
import type { ModelCatalog, ModelInfo } from '../types'
import { PROVIDERS } from '../types'

// One request per provider per session, shared by every picker on screen.
const inflight = new Map<string, Promise<ModelCatalog>>()

export function staticModels(provider: string): ModelInfo[] {
  const p = PROVIDERS[provider]
  return (p?.models ?? []).filter(m => m !== 'custom').map(id => ({ id, name: p.displayNames?.[id] ?? id }))
}

export function useProviderModels(provider: string, enabled = true) {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (refresh: boolean) => {
    if (!provider || provider === 'openrouter') return
    setLoading(true)
    try {
      let p = refresh ? undefined : inflight.get(provider)
      if (!p) {
        p = listProviderModels(provider, refresh)
        inflight.set(provider, p)
        p.catch(() => inflight.delete(provider))
      }
      setCatalog(await p)
    } catch (e) {
      setCatalog({ models: staticModels(provider), source: 'static', fetchedAt: null, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [provider])

  useEffect(() => {
    setCatalog(null)
    if (enabled) load(false)
  }, [provider, enabled, load])

  return {
    models: catalog?.models ?? staticModels(provider),
    source: catalog?.source ?? 'static',
    error: catalog?.error ?? '',
    loading,
    refresh: () => load(true),
  }
}

/** Drop the session cache (after keys change, so the next picker asks again). */
export function resetProviderModels(provider?: string) {
  if (provider) inflight.delete(provider)
  else inflight.clear()
}
