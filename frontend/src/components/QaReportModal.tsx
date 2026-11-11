/**
 * QaReportModal
 *
 * Deterministic QA over the whole series — no model calls, no tokens.
 * Mirrors Step A/B of the agentic workflow: scan every translated chapter,
 * show per-chapter findings and cross-chapter checks, and apply the purely
 * mechanical fixes (each changed chapter is archived to version history first).
 *
 * Fixes that need the source or judgment stay with the reviewer or the agent.
 */

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, ShieldCheck, ChevronDown, ChevronRight, Wand2, RefreshCw, ExternalLink, Replace } from 'lucide-react'
import { qaScanSeries, qaPreviewFixes, qaApplyFixes, qaPreviewRename, qaApplyRename, glossaryAudit, glossaryDeleteEntries } from '../api'
import type { RenamePreview } from '../api'
import { GlossaryReviewFlow } from './GlossaryReviewFlow'
import { useI18n } from '../i18n'
import { ChapterReviewModal } from './ChapterReviewModal'
import type { QaReport, QaFixPreview, QaSeverity, QaChapterReport, GlossaryAudit, GlossaryAuditEntry } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  seriesId: string
  disabled?: boolean
  onApplied?: () => void
}

type Tab = 'chapters' | 'volume' | 'glossary' | 'fixes' | 'rename'

const SEV_COLOR: Record<QaSeverity, string> = { high: '#FF3C3C', medium: '#FFB020', low: '#8A8A8A' }

const FIX_LABELS: Record<string, { label: string; desc: string }> = {
  typography: { label: 'Tipografi', desc: 'Spasi ganda, spasi sebelum tanda baca, -- → —' },
  marks: { label: 'Tanda sumber', desc: '「」 → petik, …… → …, ─ / —— → —, ，。！？ → , . ! ?, `` \'\' → petik' },
  macron: { label: 'Macron', desc: 'ā ī ū ē ō → aa ii uu ee ou (Tōkyō → Tokyo)' },
  tone: { label: 'Tanda nada', desc: 'Pinyin polos (Lín → Lin, Lǚ → Lu); Korea ŏ / ŭ → eo / eu' },
  homoglyph: { label: 'Huruf kembar', desc: 'Huruf Sirilik/Yunani yang menyamar di kata Latin (Toyоashihara → Toyoashihara)' },
  bold: { label: 'Bold', desc: '**teks** → teks (hanya miring yang boleh)' },
  italic_spacing: { label: 'Spasi miring', desc: '* teks * → *teks*' },
  quotes: { label: 'Gaya petik', desc: 'Petik melengkung → lurus, jika bab mayoritas lurus' },
  ejaan: { label: 'Ejaan baku', desc: 'nafas → napas, sekedar → sekadar, anda → Anda, …' },
  acronym: { label: 'Akronim', desc: 'tv → TV, ktp → KTP, usb → USB, …' },
}
const DEFAULT_FIXES = ['typography', 'marks', 'macron', 'tone', 'homoglyph', 'bold', 'italic_spacing']

const box: React.CSSProperties = { border: '2px solid var(--color-border)', padding: '10px 12px', backgroundColor: 'var(--color-surface)' }
const h: React.CSSProperties = { fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }

function SevBadge({ sev, n }: { sev: QaSeverity; n: number }) {
  if (!n) return null
  return (
    <span style={{ fontSize: '10px', fontWeight: 800, padding: '1px 6px', color: '#fff', backgroundColor: SEV_COLOR[sev], fontFamily: 'monospace' }}>
      {n}
    </span>
  )
}

/**
 * Rename one rendering everywhere it can re-enter the model's context:
 * chapter text, chapter summaries (rolling memory), long-term memory and the
 * glossary. Fixing only the text would let an old summary teach the wrong
 * name back to the next chapter.
 */
function RenamePanel({ seriesId, disabled, initial, onApplied }: {
  seriesId: string
  disabled?: boolean
  initial: { old: string; new: string } | null
  onApplied: () => void
}) {
  const [oldText, setOldText] = useState(initial?.old ?? '')
  const [newText, setNewText] = useState(initial?.new ?? '')
  const [preview, setPreview] = useState<RenamePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (initial) { setOldText(initial.old); setNewText(initial.new); setPreview(null); setMsg('') }
  }, [initial])

  const runPreview = async () => {
    setBusy(true); setErr(''); setMsg('')
    try { setPreview(await qaPreviewRename(seriesId, oldText, newText)) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const apply = async () => {
    setBusy(true); setErr('')
    try {
      const r = await qaApplyRename(seriesId, oldText, newText)
      setMsg(`${r.replaced} kemunculan diganti di ${r.chapters} bab` + (r.glossary ? `, ${r.glossary} entri glosarium` : '') + '. Versi lama tersimpan di riwayat bab.')
      setPreview(null)
      onApplied()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  const input: React.CSSProperties = { flex: 1, border: '2px solid var(--color-border)', padding: '6px 8px', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text)', outline: 'none' }

  return (
    <div className="flex flex-col gap-3">
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        Ganti satu bentuk nama/istilah di seluruh series — teks terjemahan, ringkasan bab (rolling memory), memori jangka panjang,
        dan glosarium — supaya bentuk lama tidak masuk lagi ke konteks bab berikutnya. Pencocokan per kata utuh dan peka huruf besar
        (<code>Kanouma</code> juga mengenai <code>Kanouma-kun</code>, tapi tidak <code>kanoumaku</code>).
      </p>
      <div className="flex items-center gap-2">
        <input value={oldText} onChange={e => { setOldText(e.target.value); setPreview(null) }} placeholder="Bentuk salah, mis. Kanouma" style={input} />
        <span style={{ fontWeight: 800 }}>→</span>
        <input value={newText} onChange={e => { setNewText(e.target.value); setPreview(null) }} placeholder="Bentuk benar, mis. Touma" style={input} />
        <button onClick={runPreview} disabled={busy || !oldText.trim() || !newText.trim()} className="neo-button" style={{ fontSize: '12px', backgroundColor: 'var(--color-surface-2)', opacity: (!oldText.trim() || !newText.trim()) ? 0.5 : 1 }}>
          PRATINJAU
        </button>
      </div>
      {err && <p style={{ fontSize: '12px', color: '#FF3C3C', fontWeight: 700 }}>{err}</p>}
      {msg && <p style={{ fontSize: '12px', color: '#28E272', fontWeight: 700 }}>✓ {msg}</p>}
      {preview && (
        <div style={box}>
          <div style={h}>{preview.total} kemunculan</div>
          {preview.chapters.length > 0 && (
            <p style={{ fontSize: '12px' }}>
              {preview.chapters.map(c => `Bab ${c.chapterNumber} (${c.text}${c.summary ? ` + ${c.summary} ringkasan` : ''})`).join(' · ')}
            </p>
          )}
          {preview.memory > 0 && <p style={{ fontSize: '12px', marginTop: '4px' }}>Memori jangka panjang: {preview.memory}</p>}
          {preview.glossary.length > 0 && (
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Glosarium: {preview.glossary.map(g => `${g.sourceTerm} = ${g.translatedTerm}`).join(' · ')}</p>
          )}
          {preview.samples.map((s, i) => (
            <div key={i} style={{ fontSize: '11px', padding: '4px 0', borderBottom: '1px dashed var(--color-border)' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>Bab {s.chapter}</span>
              <div style={{ color: '#FF3C3C', whiteSpace: 'pre-wrap' }}>{s.before}</div>
              <div style={{ color: '#28E272', whiteSpace: 'pre-wrap' }}>{s.after}</div>
            </div>
          ))}
          <div className="flex justify-end" style={{ marginTop: '8px' }}>
            <button onClick={apply} disabled={busy || disabled || preview.total + preview.glossary.length === 0}
              className="neo-button flex items-center gap-1.5"
              style={{ backgroundColor: '#28E272', color: '#111', fontSize: '12px', opacity: (busy || disabled || preview.total + preview.glossary.length === 0) ? 0.5 : 1 }}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Replace size={13} />}
              GANTI SEMUA
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const FLAG_LABELS: Record<string, string> = {
  not_in_source: 'tidak ada di raw',
  single_chapter: 'hanya 1 bab',
  common_word: 'kata biasa',
  rendering_unused: 'terjemahan tak dipakai',
  variants_in_text: 'ada varian di teks',
  conflict: 'konflik',
  homoglyph: 'huruf kembar',
  duplicate: 'duplikat',
  same_rendering: 'terjemahan sama',
}
const SUGGEST_COLOR: Record<string, string> = { check: '#FFB020', remove: '#FF3C3C', keep: '#28E272' }
const SUGGEST_LABEL: Record<string, string> = { check: 'Periksa', remove: 'Saran hapus', keep: 'Simpan' }

/**
 * Glossary audit: which entries earn their place. Measured from the raw text and
 * the translations, no model involved. Bulk delete backs the removed entries up
 * to a JSON file next to the series first.
 */
function GlossaryAuditPanel({ seriesId, disabled, onRename, onChanged }: {
  seriesId: string
  disabled?: boolean
  onRename: (oldText: string, newText: string) => void
  onChanged: () => void
}) {
  const [audit, setAudit] = useState<GlossaryAudit | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'check' | 'remove' | 'keep' | 'character'>('remove')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [reviewing, setReviewing] = useState<GlossaryAuditEntry[] | null>(null)

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const a = await glossaryAudit(seriesId)
      setAudit(a)
      setSelected(new Set(a.entries.filter(e => e.suggestion === 'remove').map(e => e.id)))
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [seriesId])  // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (audit?.entries ?? []).filter(e =>
    filter === 'all' ? true : filter === 'character' ? e.character : e.suggestion === filter), [audit, filter])

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const visibleSelected = rows.filter(r => selected.has(r.id)).length

  const remove = async () => {
    const ids = rows.filter(r => selected.has(r.id)).map(r => r.id)
    setConfirming(false); setErr('')
    try {
      const r = await glossaryDeleteEntries(seriesId, ids)
      setMsg(`${r.deleted} entri dihapus. Cadangan: ${r.backup}`)
      onChanged()
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }

  if (reviewing) {
    return (
      <GlossaryReviewFlow seriesId={seriesId} items={reviewing} disabled={disabled}
        onExit={(changed) => { setReviewing(null); if (changed) { onChanged(); load() } }} />
    )
  }
  if (loading && !audit) return <div className="flex items-center gap-2" style={{ fontSize: '13px' }}><Loader2 size={16} className="animate-spin" /> Mengaudit glosarium...</div>
  if (!audit) return err ? <p style={{ fontSize: '12px', color: '#FF3C3C' }}>{err}</p> : null
  const checkItems = audit.entries.filter(e => e.suggestion === 'check' && e.resolution)

  const chip = (key: typeof filter, label: string, n: number, color?: string) => (
    <button key={key} onClick={() => setFilter(key)} style={{
      fontSize: '11px', fontWeight: 800, padding: '3px 9px', cursor: 'pointer', border: '2px solid var(--color-border)',
      backgroundColor: filter === key ? (color ?? 'var(--color-surface-2)') : 'transparent', color: filter === key && color ? '#111' : 'var(--color-text)',
    }}>{label} ({n})</button>
  )

  return (
    <div className="flex flex-col gap-3">
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        Diukur dari raw dan terjemahan, tanpa AI. <strong>Saran hapus</strong> = tidak ada di raw, atau istilah non-tokoh yang hanya muncul di 1 bab
        (mengunci istilah sekali-muncul tidak ada gunanya). <strong>Periksa</strong> = konflik dengan nama terkait, terjemahan yang terkunci tidak dipakai,
        atau teks memakai bentuk lain. Hitungan raw tahan furigana dan mengenali nama yang disebut sebagian.
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {chip('remove', 'Saran hapus', audit.summary.remove, '#FF8A8A')}
        {chip('check', 'Periksa', audit.summary.check, '#FFD580')}
        {chip('keep', 'Simpan', audit.summary.keep, '#9BF0B8')}
        {chip('character', 'Tokoh', audit.entries.filter(e => e.character).length)}
        {chip('all', 'Semua', audit.total)}
        {checkItems.length > 0 && (
          <button onClick={() => setReviewing(checkItems)} disabled={disabled}
            style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', cursor: 'pointer', border: '2px solid #111', backgroundColor: '#FFB020', color: '#111', boxShadow: '2px 2px 0 #111' }}>
            TINJAU & PERBAIKI ({checkItems.length})
          </button>
        )}
        <button onClick={load} title="Audit ulang" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'flex' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {err && <p style={{ fontSize: '12px', color: '#FF3C3C', fontWeight: 700 }}>{err}</p>}
      {msg && <p style={{ fontSize: '12px', color: '#28E272', fontWeight: 700, wordBreak: 'break-all' }}>✓ {msg}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            <th style={{ width: 28 }}>
              <input type="checkbox" checked={rows.length > 0 && visibleSelected === rows.length}
                onChange={e => setSelected(prev => { const n = new Set(prev); rows.forEach(r => e.target.checked ? n.add(r.id) : n.delete(r.id)); return n })} />
            </th>
            <th>Sumber</th><th>Terjemahan</th>
            <th title="Bab di raw yang memuat istilah ini">Bab raw</th>
            <th title="Berapa kali terjemahan terkunci muncul di teks">Dipakai</th>
            <th>Catatan audit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: GlossaryAuditEntry) => (
            <tr key={r.id} style={{ borderBottom: '1px dashed var(--color-border)', verticalAlign: 'top', opacity: selected.has(r.id) ? 1 : 0.85 }}>
              <td style={{ padding: '4px 0' }}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td style={{ padding: '4px 6px', fontWeight: 700 }}>
                {r.sourceTerm}
                {r.character && <span style={{ marginLeft: 4, fontSize: '9px', padding: '0 4px', border: '1px solid #C9A7FF', color: '#C9A7FF' }}>TOKOH</span>}
              </td>
              <td style={{ padding: '4px 6px' }}>{r.translatedTerm}</td>
              <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{r.srcChapters}</td>
              <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{r.usedCount}</td>
              <td style={{ padding: '4px 6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: SUGGEST_COLOR[r.suggestion] }}>{SUGGEST_LABEL[r.suggestion]}</span>
                {r.flags.length > 0 && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}> · {r.flags.map(f => FLAG_LABELS[f] ?? f).join(', ')}</span>}
                {r.conflictWith && <div style={{ fontSize: '10px', color: '#FF3C3C' }}>vs {r.conflictWith}</div>}
                {r.variants.map((v, i) => (
                  <div key={i} style={{ fontSize: '10px' }}>
                    teks memakai <strong>{v.form}</strong> ×{v.count} (bab {v.chapters.join(', ')})
                    <button onClick={() => onRename(v.form, r.translatedTerm)} style={miniBtn}>→ {r.translatedTerm}</button>
                    <button onClick={() => onRename(r.translatedTerm, v.form)} style={miniBtn}>{r.translatedTerm} → {v.form}</button>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-end gap-2" style={{ position: 'sticky', bottom: 0, background: 'var(--color-surface)', padding: '8px 0', borderTop: '2px solid var(--color-border)' }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginRight: 'auto' }}>{visibleSelected} dipilih di tampilan ini</span>
        {confirming ? (
          <>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Hapus {visibleSelected} entri? Cadangan JSON dibuat dulu.</span>
            <button onClick={() => setConfirming(false)} className="neo-button" style={{ fontSize: '12px', backgroundColor: 'var(--color-surface-2)' }}>BATAL</button>
            <button onClick={remove} className="neo-button" style={{ fontSize: '12px', backgroundColor: '#FF3C3C', color: '#fff' }}>YA, HAPUS</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} disabled={disabled || visibleSelected === 0} className="neo-button"
            style={{ fontSize: '12px', backgroundColor: '#FF3C3C', color: '#fff', opacity: (disabled || visibleSelected === 0) ? 0.5 : 1 }}>
            HAPUS TERPILIH
          </button>
        )}
      </div>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  marginLeft: '4px', fontSize: '10px', fontWeight: 800, border: '1px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-text)', padding: '0 5px', cursor: 'pointer',
}

export function QaReportModal({ open, onClose, seriesId, disabled, onApplied }: Props) {
  const { language } = useI18n()
  const [tab, setTab] = useState<Tab>('chapters')
  const [report, setReport] = useState<QaReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sevFilter, setSevFilter] = useState<Record<QaSeverity, boolean>>({ high: true, medium: true, low: false })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [fixCats, setFixCats] = useState<string[]>(DEFAULT_FIXES)
  const [preview, setPreview] = useState<QaFixPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [appliedMsg, setAppliedMsg] = useState('')
  const [renameSeed, setRenameSeed] = useState<{ old: string; new: string } | null>(null)
  const [reviewChapter, setReviewChapter] = useState<string | null>(null)

  const scan = async () => {
    setLoading(true); setError('')
    try {
      const r = await qaScanSeries(seriesId, true)
      setReport(r)
      setExpanded(new Set(r.chapters.filter(c => c.stats.high > 0).slice(0, 3).map(c => c.chapterId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const runPreview = async (cats: string[]) => {
    setPreviewing(true)
    try { setPreview(await qaPreviewFixes(seriesId, cats)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setPreviewing(false) }
  }

  useEffect(() => {
    if (!open) return
    setReport(null); setPreview(null); setAppliedMsg(''); setTab('chapters')
    scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seriesId])

  useEffect(() => {
    if (open && tab === 'fixes') runPreview(fixCats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fixCats, open])

  const visibleChapters = useMemo(() => {
    if (!report) return []
    return report.chapters
      .map(c => ({ ...c, shown: c.findings.filter(f => sevFilter[f.severity]) }))
      .filter(c => c.shown.length > 0)
  }, [report, sevFilter])

  if (!open) return null

  const apply = async () => {
    setApplying(true); setAppliedMsg('')
    try {
      const res = await qaApplyFixes(seriesId, fixCats)
      const total = Object.values(res.categories).reduce((a, b) => a + b, 0)
      setAppliedMsg(`${total} perbaikan diterapkan di ${res.chapters} bab. Versi sebelumnya tersimpan di riwayat bab.`)
      onApplied?.()
      await scan()
      await runPreview(fixCats)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  // Every safe-fix category the scan found anywhere — all of them are mechanical.
  const autoFixCats = report
    ? [...new Set(report.chapters.flatMap(c => c.findings.map(f => f.fix).filter((x): x is string => !!x)))]
    : []
  const autoFixCount = report ? report.chapters.reduce((n, c) => n + c.findings.filter(f => f.fix).length, 0) : 0

  const fixAll = async () => {
    if (!autoFixCats.length) return
    setApplying(true); setAppliedMsg(''); setError('')
    try {
      const res = await qaApplyFixes(seriesId, autoFixCats)
      const total = Object.values(res.categories).reduce((a, b) => a + b, 0)
      setAppliedMsg(`${total} perbaikan otomatis diterapkan di ${res.chapters} bab. Versi sebelumnya tersimpan di riwayat bab.`)
      onApplied?.()
      await scan()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const openChapter = (c: QaChapterReport) => setReviewChapter(c.chapterId)

  const v = report?.volume

  return (
    <>
    <ChapterReviewModal open={!!reviewChapter} seriesId={seriesId} chapterId={reviewChapter} disabled={disabled}
      onClose={(changed) => { setReviewChapter(null); if (changed) { onApplied?.(); scan() } }} />
    <div className="neo-modal-backdrop" style={{ zIndex: 210 }} onClick={onClose}>
      <div className="neo-modal" style={{ width: '920px', maxWidth: '95vw', height: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: '#8AF0FF', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} color="#111" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>QA Scan</span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#111', border: '1.5px solid #111', padding: '0 6px' }}>TANPA AI · 0 TOKEN</span>
            {report && (
              <span className="flex items-center gap-1" style={{ marginLeft: '6px' }}>
                <SevBadge sev="high" n={report.totals.high} />
                <SevBadge sev="medium" n={report.totals.medium} />
                <SevBadge sev="low" n={report.totals.low} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={scan} disabled={loading} title="Pindai ulang" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', display: 'flex' }}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', display: 'flex' }}><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2px solid var(--color-border)', flexShrink: 0 }}>
          {([['chapters', 'Per Bab'], ['volume', 'Volume'], ['glossary', 'Glosarium'], ['fixes', 'Perbaikan Aman'], ['rename', 'Ganti Nama']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '8px 16px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', border: 'none', cursor: 'pointer',
              borderRight: '2px solid var(--color-border)',
              backgroundColor: tab === k ? 'var(--color-surface-2)' : 'transparent', color: 'var(--color-text)',
            }}>{label}</button>
          ))}
        </div>

        <div className="flex-1" style={{ minHeight: 0, overflowY: 'auto', padding: '14px 18px' }}>
          {loading && !report && (
            <div className="flex items-center justify-center h-full gap-2" style={{ fontSize: '13px' }}>
              <Loader2 size={18} className="animate-spin" /> Memindai seluruh bab...
            </div>
          )}
          {error && <p style={{ fontSize: '12px', color: '#FF3C3C', fontWeight: 700, marginBottom: '8px' }}>{error}</p>}

          {/* ── Per chapter ── */}
          {report && tab === 'chapters' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2" style={{ fontSize: '11px' }}>
                <span style={{ fontWeight: 700 }}>Tampilkan:</span>
                {(['high', 'medium', 'low'] as QaSeverity[]).map(s => (
                  <label key={s} className="flex items-center gap-1" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={sevFilter[s]} onChange={e => setSevFilter(p => ({ ...p, [s]: e.target.checked }))} style={{ accentColor: SEV_COLOR[s] }} />
                    <span style={{ color: SEV_COLOR[s], fontWeight: 800, textTransform: 'uppercase' }}>{s}</span>
                  </label>
                ))}
                <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }}>{report.chapterCount} bab terjemahan dipindai</span>
              </div>
              {autoFixCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap" style={{ border: '2px solid #28E272', padding: '6px 10px', fontSize: '12px' }}>
                  <Wand2 size={14} style={{ color: '#28E272' }} />
                  <span><strong>{autoFixCount}</strong> temuan bisa diperbaiki otomatis tanpa AI ({autoFixCats.map(c => FIX_LABELS[c]?.label ?? c).join(', ')}).</span>
                  <button onClick={fixAll} disabled={applying || disabled} className="neo-button flex items-center gap-1.5"
                    style={{ marginLeft: 'auto', fontSize: '11px', padding: '4px 10px', backgroundColor: '#28E272', color: '#111', opacity: (applying || disabled) ? 0.5 : 1 }}>
                    {applying ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} PERBAIKI SEMUA AUTO-FIX
                  </button>
                </div>
              )}
              {appliedMsg && tab === 'chapters' && <p style={{ fontSize: '12px', color: '#28E272', fontWeight: 700 }}>{appliedMsg}</p>}
              {visibleChapters.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '24px 0', textAlign: 'center' }}>Tidak ada temuan untuk filter ini.</p>
              )}
              {visibleChapters.map(c => (
                <div key={c.chapterId} style={{ border: '2px solid var(--color-border)' }}>
                  <button onClick={() => toggleExpand(c.chapterId)} className="w-full flex items-center gap-2" style={{ padding: '7px 10px', background: 'var(--color-surface-2)', border: 'none', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}>
                    {expanded.has(c.chapterId) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace' }}>Bab {c.chapterNumber}</span>
                    <span className="truncate" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{c.title}</span>
                    <span className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
                      <SevBadge sev="high" n={c.stats.high} /><SevBadge sev="medium" n={c.stats.medium} /><SevBadge sev="low" n={c.stats.low} />
                    </span>
                  </button>
                  {expanded.has(c.chapterId) && (
                    <div style={{ padding: '6px 10px 10px' }}>
                      {c.shown.map((f, i) => (
                        <div key={i} style={{ padding: '5px 0', borderBottom: '1px dashed var(--color-border)', fontSize: '12px' }}>
                          <div className="flex items-center gap-2">
                            <span style={{ width: 8, height: 8, backgroundColor: SEV_COLOR[f.severity], flexShrink: 0 }} />
                            <code style={{ fontSize: '11px', fontWeight: 700 }}>{f.type}</code>
                            {f.para !== null && <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>¶{f.para}</span>}
                            {f.fix && <span style={{ fontSize: '9px', fontWeight: 800, padding: '0 5px', border: '1px solid #28E272', color: '#28E272', textTransform: 'uppercase' }}>auto-fix</span>}
                            <span style={{ color: 'var(--color-text-muted)' }}>{language === 'id' ? (f.detailId ?? f.detail) : f.detail}</span>
                          </div>
                          {f.text && <div style={{ marginTop: '3px', marginLeft: '16px', fontSize: '11px', fontStyle: 'italic', color: 'var(--color-text-subtle)', whiteSpace: 'pre-wrap' }}>“{f.text}”</div>}
                        </div>
                      ))}
                      <button onClick={() => openChapter(c)} className="flex items-center gap-1" style={{ marginTop: '8px', fontSize: '11px', fontWeight: 700, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '3px 8px', cursor: 'pointer' }}>
                        <ExternalLink size={11} /> Tinjau &amp; perbaiki
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Volume ── */}
          {report && v && tab === 'volume' && (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
              <div style={box}>
                <div style={h}>Varian nama ({v.nameVariants.length})</div>
                {v.nameVariants.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Tidak ada.</p> :
                  v.nameVariants.map((g, i) => (
                    <div key={i} style={{ fontSize: '12px', padding: '3px 0', borderBottom: '1px dashed var(--color-border)' }}>
                      {g.forms.map((f, j) => {
                        const target = g.forms.find(x => x.glossary) ?? g.forms[0]
                        return (
                          <span key={j} style={{ marginRight: '10px' }}>
                            <strong style={{ color: f.glossary ? '#28E272' : f.macron ? '#FF3C3C' : 'var(--color-text)' }}>{f.form}</strong>
                            <span style={{ color: 'var(--color-text-muted)' }}> ×{f.count} (bab {f.chapters.slice(0, 6).join(', ')}{f.chapters.length > 6 ? '…' : ''})</span>
                            {f.form !== target.form && (
                              <button onClick={() => { setRenameSeed({ old: f.form, new: target.form }); setTab('rename') }}
                                style={{ marginLeft: '4px', fontSize: '10px', fontWeight: 800, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '0 5px', cursor: 'pointer' }}>
                                → {target.form}
                              </button>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  ))}
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Hijau = bentuk di glosarium · merah = macron</p>
              </div>

              <div style={box}>
                <div style={h}>Rasio panjang (deteksi omisi)</div>
                <p style={{ fontSize: '12px' }}>Median volume: <strong>{v.length.median}×</strong> karakter sumber</p>
                {v.length.outliers.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Tidak ada bab yang menyimpang.</p> :
                  v.length.outliers.map((o, i) => (
                    <p key={i} style={{ fontSize: '12px', color: o.kind === 'short' ? '#FF3C3C' : '#FFB020' }}>
                      Bab {o.chapter}: {Math.round(o.relative * 100)}% dari biasanya — {o.kind === 'short' ? 'kemungkinan ada isi hilang' : 'kemungkinan ada duplikasi/tambahan'}
                    </p>
                  ))}
              </div>

              {v.spelling && (
                <div style={box}>
                  <div style={h}>Ejaan tidak baku ({v.spelling.length})</div>
                  {v.spelling.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Bersih.</p> :
                    v.spelling.map((s, i) => (
                      <p key={i} style={{ fontSize: '12px' }}>
                        <span style={{ color: '#FF3C3C' }}>{s.nonStandard}</span> ×{s.nonStandardCount} → <strong>{s.standard}</strong>
                        <span style={{ color: 'var(--color-text-muted)' }}> (bentuk baku dipakai ×{s.standardCount})</span>
                      </p>
                    ))}
                </div>
              )}

              {v.spellingMixed && (
                <div style={box}>
                  <div style={h}>Ejaan US / UK bercampur ({v.spellingMixed.length})</div>
                  {v.spellingMixed.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Konsisten.</p> :
                    v.spellingMixed.map((s, i) => (
                      <p key={i} style={{ fontSize: '12px' }}>
                        <strong>{s.us}…</strong> ×{s.usCount} <span style={{ color: 'var(--color-text-muted)' }}>vs</span> <strong>{s.uk}…</strong> ×{s.ukCount}
                        <span style={{ color: 'var(--color-text-muted)' }}> — pilih satu standar untuk seluruh volume</span>
                      </p>
                    ))}
                </div>
              )}

              <div style={box}>
                <div style={h}>Gaya petik & pembuka</div>
                <p style={{ fontSize: '12px' }}>Mayoritas: <strong>{v.quoteStyle.majority}</strong>
                  {v.quoteStyle.deviating.length > 0 && <span style={{ color: '#FFB020' }}> · menyimpang: bab {v.quoteStyle.deviating.join(', ')}</span>}</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Rasio pembuka metronom rata-rata: <strong>{Math.round(v.openers.average * 100)}%</strong></p>
                {v.openers.outliers.map((o, i) => (
                  <p key={i} style={{ fontSize: '12px', color: '#FFB020' }}>Bab {o.chapter}: {Math.round(o.ratio * 100)}%</p>
                ))}
              </div>

              <div style={box}>
                <div style={h}>Kepadatan diksi (penguat & pembanding / 1000 kata)</div>
                {v.diction.map((d, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ fontSize: '11px', padding: '1px 0' }}>
                    <span style={{ width: '52px', fontFamily: 'monospace' }}>Bab {d.chapter}</span>
                    <div style={{ height: '8px', width: `${Math.min(d.per1000 * 3, 160)}px`, backgroundColor: '#C9A7FF' }} />
                    <span style={{ fontFamily: 'monospace' }}>{d.per1000}</span>
                    <span style={{ color: 'var(--color-text-muted)' }} className="truncate">{d.top.map(([w, c]) => `${w} ${c}`).join(', ')}</span>
                  </div>
                ))}
              </div>

              {v.pronouns && (
                <div style={box}>
                  <div style={h}>Kata ganti di dialog (baris)</div>
                  {v.pronouns.map((p, i) => (
                    <p key={i} style={{ fontSize: '11px', fontFamily: 'monospace' }}>Bab {p.chapter}: kau {p.kau ?? 0} · kamu {p.kamu ?? 0} · Anda {p.Anda ?? 0}</p>
                  ))}
                </div>
              )}

              <div style={box}>
                <div style={h}>Frekuensi (bahan cek diksi menyempit)</div>
                <p style={{ fontSize: '11px', lineHeight: 1.6 }}><strong>Kata:</strong> {v.frequency.words.map(([w, n]) => `${w} ${n}`).join(' · ')}</p>
                <p style={{ fontSize: '11px', lineHeight: 1.6, marginTop: '4px' }}><strong>Bigram:</strong> {v.frequency.bigrams.slice(0, 15).map(([w, n]) => `${w} ${n}`).join(' · ')}</p>
                <p style={{ fontSize: '11px', lineHeight: 1.6, marginTop: '4px' }}><strong>Trigram:</strong> {v.frequency.trigrams.slice(0, 10).map(([w, n]) => `${w} ${n}`).join(' · ')}</p>
              </div>

              <div style={box}>
                <div style={h}>Kesehatan glosarium ({v.glossary.length})</div>
                {v.glossary.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Bersih.</p> :
                  v.glossary.map((g, i) => (
                    <p key={i} style={{ fontSize: '12px' }}>
                      {g.sourceTerm} = {g.translatedTerm} — <span style={{ color: '#FF3C3C' }}>{g.issue}</span>
                      {g.suggestOld && g.suggestNew && (
                        <button onClick={() => { setRenameSeed({ old: g.suggestOld!, new: g.suggestNew! }); setTab('rename') }}
                          style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '0 5px', cursor: 'pointer' }}>
                          {g.suggestOld} → {g.suggestNew}
                        </button>
                      )}
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* ── Glossary audit ── */}
          {tab === 'glossary' && (
            <GlossaryAuditPanel seriesId={seriesId} disabled={disabled}
              onRename={(o, n) => { setRenameSeed({ old: o, new: n }); setTab('rename') }}
              onChanged={() => onApplied?.()} />
          )}

          {/* ── Rename ── */}
          {tab === 'rename' && (
            <RenamePanel seriesId={seriesId} disabled={disabled} initial={renameSeed}
              onApplied={() => { onApplied?.(); scan() }} />
          )}

          {/* ── Safe fixes ── */}
          {tab === 'fixes' && (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Perbaikan mekanis yang sepenuhnya ditentukan aturan — tanpa AI. Baris placeholder, penanda adegan, dan tabel glosarium tidak disentuh.
                Setiap bab yang berubah diarsipkan dulu ke riwayat versinya.
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {(preview?.available ?? Object.keys(FIX_LABELS)).map(cat => {
                  const meta = FIX_LABELS[cat]
                  const n = preview?.categories[cat] ?? 0
                  const on = fixCats.includes(cat)
                  return (
                    <label key={cat} className="flex items-start gap-2" style={{ ...box, cursor: 'pointer', opacity: on ? 1 : 0.65 }}>
                      <input type="checkbox" checked={on} style={{ marginTop: '3px', accentColor: '#28E272' }}
                        onChange={e => setFixCats(prev => e.target.checked ? [...prev, cat] : prev.filter(c => c !== cat))} />
                      <span>
                        <span style={{ fontSize: '12px', fontWeight: 800 }}>{meta?.label ?? cat}</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', marginLeft: '6px', color: n ? '#28E272' : 'var(--color-text-muted)' }}>{previewing ? '…' : `${n} perubahan`}</span>
                        <br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{meta?.desc}</span>
                      </span>
                    </label>
                  )
                })}
              </div>

              {preview && Object.keys(preview.samples).length > 0 && (
                <div style={box}>
                  <div style={h}>Contoh perubahan</div>
                  {Object.entries(preview.samples).filter(([cat]) => fixCats.includes(cat)).map(([cat, items]) => (
                    <div key={cat} style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800 }}>{FIX_LABELS[cat]?.label ?? cat}</div>
                      {items.slice(0, 3).map((s, i) => (
                        <div key={i} style={{ fontSize: '11px', padding: '3px 0', borderBottom: '1px dashed var(--color-border)' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>Bab {s.chapter} ¶{s.para}</span>
                          <div style={{ color: '#FF3C3C', textDecoration: 'line-through', whiteSpace: 'pre-wrap' }}>{s.before}</div>
                          <div style={{ color: '#28E272', whiteSpace: 'pre-wrap' }}>{s.after}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {appliedMsg && <p style={{ fontSize: '12px', color: '#28E272', fontWeight: 700 }}>✓ {appliedMsg}</p>}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {preview ? `${preview.chapters.length} bab akan berubah` : ''}
                  {disabled ? ' · series sedang diproses' : ''}
                </span>
                <button onClick={apply} disabled={applying || disabled || !preview || preview.chapters.length === 0 || fixCats.length === 0}
                  className="neo-button flex items-center gap-1.5"
                  style={{ backgroundColor: '#28E272', color: '#111', fontSize: '12px', opacity: (applying || disabled || !preview || preview.chapters.length === 0) ? 0.5 : 1 }}>
                  {applying ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  TERAPKAN PERBAIKAN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
