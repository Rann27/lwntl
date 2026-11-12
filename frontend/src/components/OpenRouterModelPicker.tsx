/**
 * OpenRouterModelPicker
 *
 * Searchable picker over the live OpenRouter catalog. Each row shows what the
 * model costs and what it accepts (reasoning levels, tools, temperature), since
 * those differ per model and decide which LWNTL settings actually take effect.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Search, ChevronDown } from 'lucide-react'
import { getOpenRouterModels } from '../api'
import type { OpenRouterModel } from '../api'

interface Props {
  value: string
  onChange: (id: string) => void
}

const fmtCtx = (n: number | null) => (n ? (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}M` : `${Math.round(n / 1000)}K`) : '?')
const fmtPrice = (n: number | null) => (n === null ? '?' : n === 0 ? 'free' : `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`)

export function OpenRouterModelPicker({ value, onChange }: Props) {
  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [onlyTools, setOnlyTools] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = (force = false) => {
    setLoading(true); setErr('')
    getOpenRouterModels(force)
      .then(r => setModels(r.models))
      .catch(e => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(false) }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = models.find(m => m.id === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return models
      .filter(m => !m.id.endsWith(':batch'))
      .filter(m => !onlyTools || m.tools)
      .filter(m => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 150)
  }, [models, query, onlyTools])

  return (
    <div ref={boxRef} style={{ position: 'relative', gridColumn: '1 / -1' }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="neo-input w-full flex items-center gap-2"
        style={{ padding: '6px 10px', fontSize: '13px', backgroundColor: 'var(--color-surface)', textAlign: 'left', cursor: 'pointer' }}>
        <span className="truncate" style={{ flex: 1 }}>
          {current ? <><strong>{current.name}</strong> <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{current.id}</span></>
            : value ? value : <span style={{ color: 'var(--color-text-muted)' }}>Pilih model OpenRouter…</span>}
        </span>
        <ChevronDown size={14} />
      </button>
      {current && (
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
          ctx {fmtCtx(current.context)} · in {fmtPrice(current.priceIn)} / out {fmtPrice(current.priceOut)} per 1M
          {current.priceCacheRead !== null && ` · cache ${fmtPrice(current.priceCacheRead)}`}
          {current.reasoning && ` · reasoning ${current.efforts.length ? current.efforts.join('/') : current.budgetReasoning ? 'budget' : 'on'}${current.reasoningMandatory ? ' (wajib)' : ''}`}
          {!current.temperature && ' · temperature tidak diterima'}
          {!current.tools && ' · TANPA tool calling (agent pakai mode cadangan)'}
        </div>
      )}

      {open && (
        <div style={{ position: 'absolute', zIndex: 50, left: 0, right: 0, top: '38px', border: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: '4px 4px 0 #111' }}>
          <div className="flex items-center gap-2" style={{ padding: '6px 8px', borderBottom: '1.5px solid var(--color-border)' }}>
            <Search size={13} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="cari: kimi, gemini, deepseek…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '13px', background: 'transparent', color: 'var(--color-text)' }} />
            <label className="flex items-center gap-1" style={{ fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyTools} onChange={e => setOnlyTools(e.target.checked)} /> TOOLS
            </label>
            <button type="button" onClick={() => load(true)} title="Muat ulang katalog" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          {err && <p style={{ fontSize: '11px', color: 'var(--fg-red,#FF3C3C)', padding: '6px 8px' }}>{err}</p>}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {filtered.map(m => (
              <button type="button" key={m.id} onClick={() => { onChange(m.id); setOpen(false); setQuery('') }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px dashed var(--color-border)', cursor: 'pointer',
                  background: m.id === value ? 'var(--color-surface-2)' : 'transparent', color: 'var(--color-text)' }}>
                <div className="flex items-center gap-2">
                  <strong style={{ fontSize: '12px' }}>{m.name}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                    {fmtCtx(m.context)} · {fmtPrice(m.priceIn)}/{fmtPrice(m.priceOut)}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  <span style={{ fontFamily: 'monospace' }}>{m.id}</span>
                  {m.reasoning && <span style={{ border: '1px solid var(--fg-purple,#C9A7FF)', color: '#9B6BFF', padding: '0 4px', fontWeight: 700 }}>
                    R {m.efforts.length ? m.efforts.join('/') : m.budgetReasoning ? 'budget' : ''}
                  </span>}
                  {m.tools && <span style={{ border: '1px solid var(--fg-green,#28E272)', color: '#1BA556', padding: '0 4px', fontWeight: 700 }}>TOOLS</span>}
                  {!m.temperature && <span style={{ border: '1px solid var(--color-border)', padding: '0 4px', fontWeight: 700 }}>NO TEMP</span>}
                  {m.expires && <span style={{ color: 'var(--fg-red,#FF3C3C)', fontWeight: 700 }}>pensiun {m.expires}</span>}
                </div>
              </button>
            ))}
            {!loading && filtered.length === 0 && <p style={{ fontSize: '12px', padding: '10px', color: 'var(--color-text-muted)' }}>Tidak ada model yang cocok.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
