/**
 * PromptPresetLibrary
 *
 * Built-in prompt presets (one per language pair, read-only) and the user's own.
 * A built-in is changed by duplicating it: the copy is editable and shared by
 * every profile. Series and profiles pick presets by id, so editing a user
 * preset updates everything that uses it.
 */

import { useEffect, useMemo, useState } from 'react'
import { X, Library, Lock, Copy, Save, Trash2, Loader2 } from 'lucide-react'
import { listPromptPresets, duplicatePromptPreset, savePromptPreset, deletePromptPreset } from '../api'
import type { PromptPreset } from '../types'
import { approxTokens } from '../utils/promptPresets'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after any change, so pickers can reload their list. */
  onChanged?: (presets: PromptPreset[]) => void
  /** Preset to show first (e.g. the one currently selected). */
  initialId?: string
}

export function PromptPresetLibrary({ open, onClose, onChanged, initialId }: Props) {
  const [presets, setPresets] = useState<PromptPreset[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const selected = useMemo(() => presets.find(p => p.id === selectedId), [presets, selectedId])
  const builtins = presets.filter(p => p.builtin)
  const mine = presets.filter(p => !p.builtin)

  const select = (p: PromptPreset | undefined) => {
    setSelectedId(p?.id ?? '')
    setName(p?.name ?? '')
    setText(p?.text ?? '')
    setDirty(false)
    setErr('')
  }

  const reload = async (focusId?: string) => {
    const list = await listPromptPresets(true)
    setPresets(list)
    onChanged?.(list)
    select(list.find(p => p.id === (focusId ?? selectedId)) ?? list.find(p => p.id === initialId) ?? list[0])
  }

  useEffect(() => {
    if (!open) return
    listPromptPresets(true).then(list => {
      setPresets(list)
      select(list.find(p => p.id === initialId) ?? list[0])
    }).catch(e => setErr(e instanceof Error ? e.message : String(e)))
  }, [open])

  if (!open) return null

  const guard = (fn: () => void) => {
    if (dirty && !confirm('Perubahan belum disimpan. Buang perubahan?')) return
    fn()
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  const duplicate = () => selected && run(async () => {
    const copy = await duplicatePromptPreset(selected.id)
    await reload(copy.id)
  })
  const save = () => selected && !selected.builtin && run(async () => {
    await savePromptPreset(selected.id, name, text)
    await reload(selected.id)
  })
  const remove = () => selected && !selected.builtin && confirm(`Hapus preset "${selected.name}"? Series dan profil yang memakainya akan kembali ke prompt profil / bawaan.`) && run(async () => {
    await deletePromptPreset(selected.id)
    await reload(builtins[0]?.id)
  })

  const item = (p: PromptPreset) => (
    <button key={p.id} type="button" onClick={() => guard(() => select(p))}
      className="flex items-center gap-1.5 w-full text-left"
      style={{
        padding: '6px 8px', fontSize: '12px', fontWeight: p.id === selectedId ? 800 : 500, cursor: 'pointer',
        border: 'none', borderLeft: `4px solid ${p.id === selectedId ? 'var(--fg-cyan,#00F7FF)' : 'transparent'}`,
        background: p.id === selectedId ? 'var(--color-surface-2)' : 'transparent', color: 'var(--color-text)',
      }}>
      {p.builtin ? <Lock size={11} style={{ flexShrink: 0, opacity: 0.6 }} /> : <span style={{ width: 11, flexShrink: 0 }}>✎</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
    </button>
  )

  const groupLabel: React.CSSProperties = { fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', padding: '8px 8px 4px' }

  return (
    <div className="neo-modal-backdrop" style={{ zIndex: 1300 }} onClick={() => guard(onClose)}>
      <div className="neo-modal" style={{ width: '1040px', maxWidth: '96vw', height: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--bg-cyan,#00F7FF)', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <Library size={17} color="#111" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--on-accent,#111)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pustaka Preset Prompt
            </span>
          </div>
          <button onClick={() => guard(onClose)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-accent,#111)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div className="flex" style={{ flex: 1, minHeight: 0 }}>
          {/* List */}
          <div style={{ width: '250px', flexShrink: 0, borderRight: '2.5px solid var(--color-border)', overflowY: 'auto' }}>
            <div style={groupLabel}>Bawaan LWNTL</div>
            {builtins.map(item)}
            <div style={groupLabel}>Milikku</div>
            {mine.length === 0 && (
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '0 8px 8px', lineHeight: 1.5 }}>
                Belum ada. Pilih preset bawaan lalu tekan DUPLIKAT untuk membuat versi yang bisa diedit.
              </p>
            )}
            {mine.map(item)}
          </div>

          {/* Detail */}
          <div className="flex flex-col gap-3 p-4" style={{ flex: 1, minWidth: 0 }}>
            {selected ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.builtin ? (
                    <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{selected.name}</span>
                  ) : (
                    <input value={name} onChange={e => { setName(e.target.value); setDirty(true) }} className="neo-input"
                      style={{ fontSize: '14px', fontWeight: 700, padding: '4px 8px', maxWidth: '360px' }} />
                  )}
                  {selected.builtin && (
                    <span className="flex items-center gap-1" style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', background: '#111', color: 'var(--fg-yellow,#FFEF33)', textTransform: 'uppercase' }}>
                      <Lock size={10} /> hanya baca
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {selected.sourceLanguage} → {selected.targetLanguage}
                    {selected.basedOn ? ` · dari ${presets.find(p => p.id === selected.basedOn)?.name ?? selected.basedOn}` : ''}
                    {' · '}≈{approxTokens(text).toLocaleString()} token
                  </span>
                </div>
                {selected.builtin && (
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5, borderLeft: '3px solid var(--fg-cyan,#00F7FF)', paddingLeft: '8px' }}>
                    Preset bawaan diperbarui bersama LWNTL, jadi tidak bisa diedit langsung. Tekan DUPLIKAT untuk membuat salinan milikmu — salinan itu bisa diedit dan dipilih di series maupun profil mana pun.
                  </p>
                )}
                <textarea value={text} readOnly={selected.builtin} onChange={e => { setText(e.target.value); setDirty(true) }}
                  className="neo-textarea"
                  style={{ flex: 1, minHeight: 0, resize: 'none', fontSize: '12px', fontFamily: 'monospace', lineHeight: 1.55, background: selected.builtin ? 'var(--color-surface-2)' : 'var(--color-surface)', color: 'var(--color-text)' }} />
                {err && <p style={{ fontSize: '12px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 700 }}>{err}</p>}
                <div className="flex items-center gap-2">
                  <button onClick={duplicate} disabled={busy} className="neo-button flex items-center gap-1.5" style={{ fontSize: '12px', backgroundColor: 'var(--bg-cyan,#00F7FF)', color: 'var(--on-accent,#111)' }}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />} DUPLIKAT
                  </button>
                  {!selected.builtin && (
                    <>
                      <button onClick={save} disabled={busy || !dirty || !name.trim()} className="neo-button flex items-center gap-1.5"
                        style={{ fontSize: '12px', backgroundColor: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', opacity: (busy || !dirty || !name.trim()) ? 0.5 : 1 }}>
                        <Save size={13} /> SIMPAN
                      </button>
                      <button onClick={remove} disabled={busy} className="neo-button flex items-center gap-1.5" style={{ fontSize: '12px', backgroundColor: 'var(--bg-red,#FF8A8A)', color: 'var(--on-accent,#111)', marginLeft: 'auto' }}>
                        <Trash2 size={13} /> HAPUS
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{err || 'Memuat…'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
