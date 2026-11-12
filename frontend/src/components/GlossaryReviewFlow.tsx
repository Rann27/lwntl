/**
 * GlossaryReviewFlow
 *
 * Walks through the glossary entries the audit marked "Periksa", one card at a
 * time. For each entry the user picks the canonical rendering; every other form
 * is rewritten to it in the translations, chapter summaries, long-term memory
 * and the glossary (chapters are archived to version history first).
 *
 * Other outcomes per card: accept as-is (the issue is not flagged again for this
 * rendering), delete the entry, or skip. A duplicate (the same term in another
 * spelling, or another term with the same rendering) is merged into the older
 * entry instead: its spellings become aliases of that entry.
 *
 * Defaults marked "yakin" (a homoglyph cleanup, or a name part taking the word
 * of its full name) can also be applied in bulk.
 */

import { useMemo, useState } from 'react'
import { Loader2, Check, SkipForward, Trash2, ShieldCheck, ArrowLeft, Zap, Merge } from 'lucide-react'
import { glossaryResolve } from '../api'
import type { GlossaryAuditEntry, GlossaryCandidate } from '../types'

interface Props {
  seriesId: string
  items: GlossaryAuditEntry[]
  disabled?: boolean
  onExit: (changed: boolean) => void
}

const ORIGIN_LABEL: Record<GlossaryCandidate['origin'], string> = {
  glossary: 'Glosarium',
  variant: 'Varian di teks',
  name: 'Dari nama lengkap',
  normalized: 'Dibersihkan',
  duplicate: 'Entri lama',
}

const IGNORABLE = ['conflict', 'variants_in_text', 'rendering_unused', 'homoglyph', 'duplicate', 'same_rendering']

const isMerge = (e: GlossaryAuditEntry | undefined) =>
  !!e?.duplicateOf && (e.resolution?.kind === 'duplicate' || e.resolution?.kind === 'same_rendering')

function problemText(e: GlossaryAuditEntry): string {
  const kind = e.resolution?.kind
  switch (kind) {
    case 'duplicate':
      return `Istilah yang sama sudah ada dengan ejaan lain: ${e.duplicateOf?.sourceTerm} = ${e.duplicateOf?.translatedTerm}. Gabungkan — ejaan entri ini menjadi ejaan lain dari entri lama, lalu entri ini dihapus.`
    case 'same_rendering':
      return `Terjemahannya sama persis dengan ${e.duplicateOf?.sourceTerm} = ${e.duplicateOf?.translatedTerm}. Gabungkan agar menjadi satu entri dengan dua ejaan sumber, atau pilih "Sudah benar" jika keduanya memang istilah berbeda.`
    case 'homoglyph':
      return 'Terjemahan di glosarium mengandung huruf Sirilik/Yunani yang tampak sama dengan huruf Latin, jadi tidak pernah cocok dengan teks.'
    case 'name_part':
      return `Bagian nama ini diterjemahkan berbeda dari nama lengkapnya (${e.conflictWith}).`
    case 'variants':
      return 'Teks memakai lebih dari satu bentuk untuk istilah ini.'
    case 'conflict':
      return `Bertentangan dengan entri terkait ${e.conflictWith}. Sering kali ini wajar — istilah majemuk tidak harus mengandung terjemahan bagiannya. Pilih "Sudah benar" jika keduanya tepat, atau ketik bentuk yang menyamakan keduanya.`
    default:
      return `Istilah ini muncul di ${e.srcChapters} bab raw, tapi terjemahan terkuncinya tidak pernah muncul di teks — teks memakai bentuk lain yang tidak tercatat. Ketik bentuk yang dipakai teks, tandai sudah benar (bab berikutnya akan mengikuti glosarium), atau hapus.`
  }
}

export function GlossaryReviewFlow({ seriesId, items, disabled, onExit }: Props) {
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<string>(() => items[0]?.resolution?.preselect ?? '')
  const [custom, setCustom] = useState('')
  const [replaceOff, setReplaceOff] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [changed, setChanged] = useState(false)
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null)

  const entry = items[index]
  const res = entry?.resolution
  const confident = useMemo(() => items.filter(i => i.resolution?.confident), [items])

  const canonical = choice === '__custom' ? custom.trim() : choice
  // Every other form that actually occurs gets rewritten to the canonical one.
  const replaceable = (res?.candidates ?? []).filter(c => c.form !== canonical && c.count > 0)
  const replaceForms = (e: GlossaryAuditEntry, canon: string, off: Set<string>) => {
    const forms = (e.resolution?.candidates ?? []).filter(c => c.form !== canon && (c.count > 0 || c.origin === 'glossary')).map(c => c.form)
    // The entry's own current rendering is always replaced (that is what changes).
    if (e.translatedTerm !== canon && !forms.includes(e.translatedTerm)) forms.push(e.translatedTerm)
    return forms.filter(f => !off.has(f) || f === e.translatedTerm)
  }

  const goTo = (i: number) => {
    if (i >= items.length) { onExit(changed); return }
    setIndex(i)
    setChoice(items[i]?.resolution?.preselect ?? '')
    setCustom('')
    setReplaceOff(new Set())
    setErr('')
  }

  const run = async (action: Record<string, unknown>, label: string) => {
    setBusy(true); setErr('')
    try {
      await glossaryResolve(seriesId, action)
      setResults(r => [...r, label])
      setChanged(true)
      goTo(index + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const applyCanonical = () => {
    if (!entry || !canonical) return
    run({ type: 'canonical', entryId: entry.id, canonical, replace: replaceForms(entry, canonical, replaceOff) },
      `${entry.sourceTerm}: ${entry.translatedTerm} → ${canonical}`)
  }

  const accept = () => entry && run({
    type: 'ignore', entryId: entry.id, partnerId: entry.conflictEntry?.id,
    flags: entry.flags.filter(f => IGNORABLE.includes(f)),
  }, `${entry.sourceTerm}: ditandai sudah benar`)

  const remove = () => entry && run({ type: 'delete', entryId: entry.id }, `${entry.sourceTerm}: dihapus`)

  const mergeAction = (e: GlossaryAuditEntry, canon: string, off: Set<string>) => ({
    type: 'merge', entryId: e.id, intoId: e.duplicateOf!.id, canonical: canon, replace: replaceForms(e, canon, off),
  })

  const merge = () => {
    if (!entry || !canonical || !entry.duplicateOf) return
    run(mergeAction(entry, canonical, replaceOff), `${entry.sourceTerm} → digabung ke ${entry.duplicateOf.sourceTerm} (${canonical})`)
  }

  const applyConfident = async () => {
    setBulk({ done: 0, total: confident.length }); setErr('')
    let done = 0
    for (const e of confident) {
      const canon = e.resolution!.preselect!
      try {
        if (isMerge(e)) {
          await glossaryResolve(seriesId, mergeAction(e, canon, new Set()))
          setResults(r => [...r, `${e.sourceTerm} → digabung ke ${e.duplicateOf!.sourceTerm}`])
        } else {
          await glossaryResolve(seriesId, { type: 'canonical', entryId: e.id, canonical: canon, replace: replaceForms(e, canon, new Set()) })
          setResults(r => [...r, `${e.sourceTerm}: ${e.translatedTerm} → ${canon}`])
        }
        setChanged(true)
      } catch (ex) {
        setErr(`${e.sourceTerm}: ${ex instanceof Error ? ex.message : String(ex)}`)
      }
      done += 1
      setBulk({ done, total: confident.length })
    }
    setBulk(null)
    onExit(true)
  }

  const box: React.CSSProperties = { border: '2px solid var(--color-border)', padding: '12px 14px', backgroundColor: 'var(--color-surface)' }

  if (!entry || !res) {
    return (
      <div className="flex flex-col gap-3">
        <p style={{ fontSize: '13px' }}>Tidak ada entri untuk ditinjau.</p>
        <button onClick={() => onExit(changed)} className="neo-button" style={{ fontSize: '12px', alignSelf: 'flex-start' }}>KEMBALI</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <button onClick={() => onExit(changed)} className="flex items-center gap-1" style={{ fontSize: '11px', fontWeight: 800, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '3px 8px', cursor: 'pointer' }}>
          <ArrowLeft size={12} /> DAFTAR
        </button>
        <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace' }}>{index + 1} / {items.length}</span>
        <div style={{ flex: 1, height: 6, background: 'var(--color-surface-2)' }}>
          <div style={{ width: `${(index / items.length) * 100}%`, height: '100%', background: 'var(--bg-orange,#FFB020)' }} />
        </div>
        {confident.length > 0 && (
          <button onClick={applyConfident} disabled={!!bulk || busy || disabled} className="flex items-center gap-1"
            title="Terapkan otomatis pilihan bawaan yang aman: pembersihan huruf kembar, bagian nama yang mengikuti nama lengkapnya, dan duplikat yang terjemahannya sudah sama"
            style={{ fontSize: '11px', fontWeight: 800, border: '2px solid #111', background: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', padding: '3px 8px', cursor: 'pointer', opacity: (bulk || disabled) ? 0.5 : 1 }}>
            {bulk ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {bulk ? `${bulk.done}/${bulk.total}` : `TERAPKAN SARAN YAKIN (${confident.length})`}
          </button>
        )}
      </div>

      {/* Card */}
      <div style={box}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span style={{ fontSize: '20px', fontWeight: 800 }}>{entry.sourceTerm}</span>
          <span style={{ fontSize: '14px' }}>= {entry.translatedTerm}</span>
          {entry.character && <span style={{ fontSize: '10px', padding: '0 5px', border: '1px solid var(--fg-purple,#C9A7FF)', color: 'var(--fg-purple,#C9A7FF)', fontWeight: 800 }}>TOKOH</span>}
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{entry.srcChapters} bab raw · dipakai {entry.usedCount}×</span>
        </div>
        {entry.notes && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{entry.notes}</p>}
        <p style={{ fontSize: '12px', marginTop: '10px', lineHeight: 1.5, borderLeft: '3px solid var(--fg-orange,#FFB020)', paddingLeft: '8px' }}>{problemText(entry)}</p>
        {entry.duplicateOf && (
          <p style={{ fontSize: '11px', marginTop: '6px', color: 'var(--color-text-muted)' }}>
            Entri lama: <strong>{entry.duplicateOf.sourceTerm} = {entry.duplicateOf.translatedTerm}</strong>
            {entry.duplicateOf.notes ? ` — ${entry.duplicateOf.notes}` : ''}
          </p>
        )}
        {entry.conflictEntry && (
          <p style={{ fontSize: '11px', marginTop: '6px', color: 'var(--color-text-muted)' }}>
            Entri terkait: <strong>{entry.conflictEntry.sourceTerm} = {entry.conflictEntry.translatedTerm}</strong>
            {entry.conflictEntry.notes ? ` — ${entry.conflictEntry.notes}` : ''}
          </p>
        )}
      </div>

      {/* Choice */}
      <div style={box}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Pilih bentuk utama</div>
        {res.reason && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Pilihan bawaan: {res.reason}{res.confident ? ' (yakin)' : ''}</p>}
        <div className="flex flex-col gap-1">
          {res.candidates.map(c => (
            <label key={c.form} className="flex items-center gap-2" style={{ fontSize: '13px', cursor: 'pointer', padding: '4px 6px', background: choice === c.form ? 'var(--color-surface-2)' : 'transparent' }}>
              <input type="radio" checked={choice === c.form} onChange={() => setChoice(c.form)} style={{ accentColor: 'var(--fg-orange,#FFB020)' }} />
              <strong>{c.form}</strong>
              <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>×{c.count}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, padding: '0 5px', border: '1px solid var(--color-border)' }}>{ORIGIN_LABEL[c.origin]}</span>
              {c.note && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.note}</span>}
            </label>
          ))}
          <label className="flex items-center gap-2" style={{ fontSize: '13px', cursor: 'pointer', padding: '4px 6px', background: choice === '__custom' ? 'var(--color-surface-2)' : 'transparent' }}>
            <input type="radio" checked={choice === '__custom'} onChange={() => setChoice('__custom')} style={{ accentColor: 'var(--fg-orange,#FFB020)' }} />
            <span>Lainnya:</span>
            <input value={custom} onChange={e => { setCustom(e.target.value); setChoice('__custom') }} placeholder="ketik bentuk yang benar"
              style={{ flex: 1, border: '2px solid var(--color-border)', padding: '3px 6px', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none' }} />
          </label>
        </div>

        {canonical && (replaceable.length > 0 || entry.translatedTerm !== canonical) && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              Diganti menjadi «{canonical}» di teks, ringkasan bab, memori, dan glosarium:
            </div>
            {replaceable.map(c => (
              <label key={c.form} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={!replaceOff.has(c.form)} disabled={c.form === entry.translatedTerm}
                  onChange={e => setReplaceOff(prev => { const n = new Set(prev); e.target.checked ? n.delete(c.form) : n.add(c.form); return n })} />
                <span>{c.form} <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>×{c.count}</span></span>
              </label>
            ))}
            {entry.translatedTerm !== canonical && !replaceable.some(c => c.form === entry.translatedTerm) && (
              <div style={{ color: 'var(--color-text-muted)' }}>✓ entri glosarium: {entry.translatedTerm} → {canonical}</div>
            )}
          </div>
        )}
      </div>

      {err && <p style={{ fontSize: '12px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 700 }}>{err}</p>}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isMerge(entry) ? (
          <button onClick={merge} disabled={busy || disabled || !canonical} className="neo-button flex items-center gap-1.5"
            style={{ fontSize: '12px', backgroundColor: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', opacity: (busy || disabled || !canonical) ? 0.5 : 1 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />}
            GABUNGKAN & LANJUT
          </button>
        ) : (
          <button onClick={applyCanonical} disabled={busy || disabled || !canonical} className="neo-button flex items-center gap-1.5"
            style={{ fontSize: '12px', backgroundColor: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', opacity: (busy || disabled || !canonical) ? 0.5 : 1 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {canonical === entry.translatedTerm && replaceable.length === 0 ? 'SIMPAN & LANJUT' : 'TERAPKAN & LANJUT'}
          </button>
        )}
        <button onClick={accept} disabled={busy || disabled} className="neo-button flex items-center gap-1.5" style={{ fontSize: '12px', backgroundColor: 'var(--color-surface-2)' }}
          title="Bentuk sekarang sudah benar — masalah ini tidak akan ditandai lagi untuk terjemahan ini">
          <ShieldCheck size={13} /> SUDAH BENAR
        </button>
        <button onClick={remove} disabled={busy || disabled} className="neo-button flex items-center gap-1.5" style={{ fontSize: '12px', backgroundColor: 'var(--bg-red,#FF8A8A)', color: 'var(--on-accent,#111)' }}>
          <Trash2 size={13} /> HAPUS ENTRI
        </button>
        <button onClick={() => goTo(index + 1)} disabled={busy} className="neo-button flex items-center gap-1.5" style={{ fontSize: '12px', backgroundColor: 'transparent' }}>
          <SkipForward size={13} /> LEWATI
        </button>
        {index > 0 && (
          <button onClick={() => goTo(index - 1)} disabled={busy} style={{ marginLeft: 'auto', fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            ← sebelumnya
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px dashed var(--color-border)', paddingTop: '6px' }}>
          {results.slice(-5).map((r, i) => <div key={i}>✓ {r}</div>)}
          {results.length > 5 && <div>… {results.length - 5} lainnya</div>}
        </div>
      )}
    </div>
  )
}
