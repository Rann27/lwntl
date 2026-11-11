/**
 * RequestParamsPreview
 *
 * One line under a worker: the parameters LWNTL will really send for its
 * provider + model, computed by the same backend function the client uses, plus
 * every adjustment (unsupported effort, temperature the model refuses, …).
 */

import { useEffect, useState } from 'react'
import { describeRequestParams } from '../api'
import type { RequestParams } from '../api'

interface Props {
  provider: string
  model: string
  /** Bump to recompute after settings are saved. */
  revision?: unknown
}

function summarize(extra: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(extra)) {
    if (k === 'provider' && v && typeof v === 'object') {
      out.push(`routing: ${Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a}=${String(b)}`).join(', ')}`)
    } else if (v && typeof v === 'object') {
      out.push(`${k}: ${JSON.stringify(v)}`)
    } else {
      out.push(`${k}: ${String(v)}`)
    }
  }
  return out
}

export function RequestParamsPreview({ provider, model, revision }: Props) {
  const [params, setParams] = useState<RequestParams | null>(null)

  useEffect(() => {
    if (!provider || !model) { setParams(null); return }
    let alive = true
    const t = setTimeout(() => {
      describeRequestParams(provider, model).then(p => { if (alive) setParams(p) }).catch(() => { if (alive) setParams(null) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [provider, model, revision])

  if (!params) return null
  const parts = summarize(params.extra)
  return (
    <div style={{ marginTop: '6px', fontSize: '10px', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
      <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>Dikirim: </span>
      {parts.length ? parts.join(' · ') : 'tanpa parameter tambahan'}
      {' · '}temperature: {params.temperature ? 'ya' : <strong>tidak</strong>}
      {params.notes.length > 0 && (
        <ul style={{ margin: '2px 0 0 14px', listStyle: 'disc' }}>
          {params.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  )
}
