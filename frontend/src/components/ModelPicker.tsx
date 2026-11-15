import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
/**
 * ModelPicker: model selection for a worker, from the provider's live list.
 *
 * Shows the provider's own name, id and limits for the chosen model, where the
 * list came from (live / cache / built-in), and a refresh button. Any id can
 * still be typed by hand ("Custom…"), and a saved id that the provider no longer
 * lists stays usable as a custom id.
 */

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useProviderModels } from '../hooks/useProviderModels'
import { OpenRouterModelPicker } from './OpenRouterModelPicker'

interface Props {
  provider: string
  value: string
  onChange: (id: string) => void
}

const CUSTOM = '__custom'

function compact(n?: number | null): string {
  if (!n) return ''
  return n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n)
}

const SOURCE_LABEL: Record<string, { label: string; color: string; title: string }> = {
  live: { label: 'LIVE', color: 'var(--fg-green,#28E272)', title: 'Baru diambil dari provider' },
  cache: { label: 'CACHE', color: 'var(--fg-cyan,#00F7FF)', title: 'Dari provider, disimpan sampai 24 jam: tekan ⟳ untuk ambil ulang' },
  static: { label: 'BAWAAN', color: 'var(--fg-orange,#FFB020)', title: 'Daftar bawaan LWNTL (belum ada key, atau provider tidak menjawab)' },
}

export function ModelPicker({ provider, value, onChange }: Props) {
  const { models, source, error, loading, refresh } = useProviderModels(provider)
  const [forceCustom, setForceCustom] = useState(false)

  if (provider === 'openrouter') return <OpenRouterModelPicker value={value} onChange={onChange} />

  const selected = models.find(m => m.id === value)
  const custom = forceCustom || provider === 'openaicompat' && models.length === 0 || (!!value && !selected)
  const src = SOURCE_LABEL[source] ?? SOURCE_LABEL.static
  const info = selected && [
    selected.name !== selected.id ? selected.id : '',
    selected.contextLength ? `konteks ${compact(selected.contextLength)}` : '',
    selected.maxOutput ? `output ${compact(selected.maxOutput)}` : '',
  ].filter(Boolean).join(' · ')

  const inputStyle: React.CSSProperties = { padding: '6px 10px', fontSize: '13px', backgroundColor: 'var(--color-surface)', minWidth: 0, width: '100%' }

  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
      <div className="flex gap-1">
        {custom ? (
          <Input aria-label="model id..." value={value} onChange={e => onChange(e.target.value)} placeholder="model id..." className="ui-input" style={inputStyle} />
        ) : (
          <select aria-label="Model" value={value} onChange={e => e.target.value === CUSTOM ? (setForceCustom(true), onChange('')) : onChange(e.target.value)}
            className="ui-input" style={inputStyle}>
            {!value && <option value="">: pilih model: </option>}
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value={CUSTOM}>Custom…</option>
          </select>
        )}
        <Button aria-label="Ambil ulang daftar model dari provider" variant="ghost" type="button" onClick={refresh} disabled={loading} title="Ambil ulang daftar model dari provider"
          style={{ borderRadius: 'var(--radius)',  flexShrink: 0, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </Button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
        <span title={src.title} style={{ borderRadius: 'var(--radius)',  fontWeight: 600, padding: '0 4px', border: `1px solid ${src.color}`, color: src.color }}>{src.label}</span>
        <span>{models.length} model</span>
        {info && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {info}</span>}
        {custom && models.length > 0 && (
          <Button variant="ghost" type="button" onClick={() => { setForceCustom(false); onChange(models[0].id) }}
            style={{ borderRadius: 'var(--radius)',  fontSize: '10px', fontWeight: 600, border: 'none', background: 'none', color: 'var(--color-text)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            pilih dari daftar
          </Button>
        )}
      </div>
      {error && source !== 'live' && (
        <div title={error} style={{ fontSize: '10px', color: 'var(--fg-orange,#FFB020)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Provider tidak menjawab: {error}
        </div>
      )}
    </div>
  )
}
