import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
/**
 * TerminologyPrepassModal
 *
 * Runs a terminology pre-pass over every chapter's RAW source and lets the user
 * review, edit and select which proposed terms to add to the series glossary.
 *
 * The point is timing: per-chapter extraction can only learn a term after the
 * chapter that introduces it is already translated, so early chapters render it
 * however they like. Agreeing on terms up front removes that window.
 */

import { useState } from 'react'
import { X, Loader2, ScanSearch, Check, AlertCircle } from 'lucide-react'
import { runTerminologyPrepass } from '../api'
import type { ProposedTerm } from '../api'

interface Props {
  open: boolean
  onClose: () => void
  seriesId: string
  workerId?: string | null
  chapterCount: number
  onApply: (terms: ProposedTerm[]) => Promise<void>
}

type Phase = 'idle' | 'running' | 'review' | 'applying' | 'error'

export function TerminologyPrepassModal({
  open, onClose, seriesId, workerId, chapterCount, onApply,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [terms, setTerms] = useState<ProposedTerm[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [meta, setMeta] = useState<{ batches: number; skipped: number; scanned: number } | null>(null)
  const [error, setError] = useState('')

  if (!open) return null

  const reset = () => {
    setPhase('idle'); setTerms([]); setSelected(new Set()); setMeta(null); setError('')
  }

  const close = () => { reset(); onClose() }

  const run = async () => {
    setPhase('running'); setError('')
    try {
      const res = await runTerminologyPrepass(seriesId, workerId)
      setTerms(res.entries)
      setSelected(new Set(res.entries.map((_, i) => i)))
      setMeta({ batches: res.batches, skipped: res.skipped, scanned: res.scannedChapters })
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }

  const apply = async () => {
    setPhase('applying')
    try {
      await onApply(terms.filter((_, i) => selected.has(i)))
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const editTerm = (i: number, field: keyof ProposedTerm, value: string) => {
    setTerms(prev => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1.5px solid var(--color-border)', padding: '3px 6px',
    fontSize: '12px', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none',
  }

  return (
    <ModalSurface label="Terminology prepass" onClose={close} className="ui-modal-backdrop" style={{ zIndex: 210 }} onClick={close}>
      <div
        className="ui-modal"
        style={{ width: '820px', maxWidth: '94vw', height: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--bg-lime,#C8FF8A)', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <ScanSearch size={17} color="var(--foreground)" />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '15px', color: 'var(--on-accent,#111)', textTransform: 'none', letterSpacing: '0.05em' }}>
              Terminology Pre-Pass
            </span>
            {phase === 'review' && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--on-accent,#111)', opacity: 0.7 }}>
: {terms.length} usulan
              </span>
            )}
          </div>
          <Button aria-label="Close" variant="ghost" onClick={close} style={{ borderRadius: 'var(--radius)',  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-accent,#111)', display: 'flex' }}>
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1" style={{ minHeight: 0, overflowY: 'auto' }}>
          {(phase === 'idle' || phase === 'running') && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-10 text-center">
              {phase === 'running' ? (
                <>
                  <Loader2 size={30} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>Memindai seluruh raw content...</p>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Bisa memakan waktu untuk series besar. Jangan tutup jendela ini.
                  </p>
                </>
              ) : (
                <>
                  <ScanSearch size={34} style={{ color: 'var(--color-text-subtle)' }} />
                  <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-muted)', maxWidth: '520px' }}>
                    Memindai raw content <strong>{chapterCount} chapter</strong> untuk mengumpulkan
                    istilah berulang: nama, tempat, senjata, sihir, organisasi: lalu mengusulkan
                    terjemahan bakunya.
                    <br /><br />
                    Jalankan ini <strong>sebelum menerjemahkan</strong>. Tanpa itu, istilah baru
                    hanya masuk glossary setelah bab yang memperkenalkannya selesai: dan bab-bab
                    sebelumnya terlanjur mengarang bentuk sendiri.
                  </p>
                  <Button variant="default" onClick={run}>
                    <ScanSearch size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    Mulai pemindaian
                  </Button>
                </>
              )}
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-10 text-center">
              <AlertCircle size={30} color="var(--fg-red,#FF3C3C)" />
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-red,#FF3C3C)' }}>Gagal</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '520px' }}>{error}</p>
              <Button variant="default" onClick={run} className="">Coba lagi</Button>
            </div>
          )}

          {(phase === 'review' || phase === 'applying') && (
            terms.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Tidak ada istilah baru: glossary sudah mencakup semuanya.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-surface)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ width: '34px', padding: '7px 6px' }} />
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'none', color: 'var(--color-text-muted)', width: '25%' }}>Source Term</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'none', color: 'var(--color-text-muted)', width: '30%' }}>Translation</th>
                    <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'none', color: 'var(--color-text-muted)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', opacity: selected.has(i) ? 1 : 0.4 }}>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <Input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ cursor: 'pointer', accentColor: 'var(--fg-green,#28E272)' }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <Input value={t.sourceTerm} onChange={e => editTerm(i, 'sourceTerm', e.target.value)} style={{ ...inputStyle, fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <Input value={t.translatedTerm} onChange={e => editTerm(i, 'translatedTerm', e.target.value)} style={inputStyle} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <Input value={t.notes} onChange={e => editTerm(i, 'notes', e.target.value)} style={{ ...inputStyle, color: 'var(--color-text-muted)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Footer */}
        {(phase === 'review' || phase === 'applying') && terms.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              <strong>{selected.size}</strong> / {terms.length} dipilih
              {meta && (
                <span style={{ marginLeft: '10px', opacity: 0.75 }}>
                  · {meta.scanned} chapter, {meta.batches} batch
                  {meta.skipped > 0 && `, ${meta.skipped} dibuang`}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelected(new Set(terms.map((_, i) => i)))} className="" style={{ color: 'var(--foreground)',  fontSize: '11px', backgroundColor: 'var(--color-surface-2)' }}>
                Pilih semua
              </Button>
              <Button variant="outline" onClick={() => setSelected(new Set())} className="" style={{ color: 'var(--foreground)',  fontSize: '11px', backgroundColor: 'var(--color-surface-2)' }}>
                Kosongkan
              </Button>
              <Button variant="default"
                onClick={apply}
                disabled={selected.size === 0 || phase === 'applying'}
                className=""
                style={{ backgroundColor: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', opacity: selected.size === 0 || phase === 'applying' ? 0.5 : 1 }}
              >
                {phase === 'applying'
                  ? <><Loader2 size={13} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} /> Menyimpan...</>
                  : <><Check size={13} style={{ display: 'inline', marginRight: '6px' }} /> Tambahkan {selected.size}</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalSurface>
  )
}
