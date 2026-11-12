/**
 * ChapterReviewModal
 *
 * One chapter's QA findings in context, fixable in place. The chapter workspace
 * shows translations read-only, so the report opens this instead:
 *
 *   left   findings (chapter-level and per paragraph), filterable by severity
 *   right  the whole translation; flagged paragraphs are marked, and the selected
 *          paragraph opens an editor with its source lines, the safe-fix preview
 *          when one exists, a manual editor and an optional AI suggestion
 *
 * The first save in a session archives the chapter to version history; later
 * saves in the same session do not, so one review = one restorable version.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Sparkles, Save, Trash2, Wand2 } from 'lucide-react'
import { qaChapterDetail, qaUpdateParagraph, qaSuggestFix } from '../api'
import type { QaChapterDetail, QaFinding, QaSeverity } from '../types'
import { useI18n } from '../i18n'

interface Props {
  open: boolean
  seriesId: string
  chapterId: string | null
  disabled?: boolean
  onClose: (changed: boolean) => void
}

const SEV_COLOR: Record<QaSeverity, string> = { high: 'var(--fg-red,#FF3C3C)', medium: 'var(--fg-orange,#FFB020)', low: '#8A8A8A' }

export function ChapterReviewModal({ open, seriesId, chapterId, disabled, onClose }: Props) {
  const { language } = useI18n()
  const say = (f: QaFinding) => (language === 'id' ? (f.detailId ?? f.detail) : f.detail)
  const [detail, setDetail] = useState<QaChapterDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sev, setSev] = useState<Record<QaSeverity, boolean>>({ high: true, medium: true, low: true })
  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestion, setSuggestion] = useState<{ text: string; del: boolean } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [archived, setArchived] = useState(false)
  const [changed, setChanged] = useState(false)
  const paraRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!open || !chapterId) return
    setDetail(null); setSelected(null); setErr(''); setArchived(false); setChanged(false); setSuggestion(null)
    setLoading(true)
    qaChapterDetail(seriesId, chapterId)
      .then(setDetail)
      .catch(e => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [open, seriesId, chapterId])

  const byPara = useMemo(() => {
    const m: Record<number, QaFinding[]> = {}
    for (const f of detail?.findings ?? []) {
      if (f.para !== null && sev[f.severity]) (m[f.para] ??= []).push(f)
    }
    return m
  }, [detail, sev])

  if (!open || !chapterId) return null

  const select = (i: number) => {
    if (!detail) return
    setSelected(i)
    setDraft(detail.paragraphs[i] ?? '')
    setSuggestion(null)
    setErr('')
    setTimeout(() => paraRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
  }

  const save = async (text: string) => {
    if (!detail || selected === null) return
    setBusy(true); setErr('')
    try {
      const next = await qaUpdateParagraph(seriesId, detail.chapterId, selected, detail.paragraphs[selected], text, !archived)
      setArchived(true); setChanged(true)
      setDetail(next)
      const idx = Math.min(selected, next.paragraphs.length - 1)
      setSelected(idx >= 0 ? idx : null)
      setDraft(idx >= 0 ? next.paragraphs[idx] : '')
      setSuggestion(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const askAi = async () => {
    if (!detail || selected === null) return
    setSuggesting(true); setErr('')
    try {
      const r = await qaSuggestFix(seriesId, detail.chapterId, selected)
      setSuggestion({ text: r.suggestion, del: r.delete })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSuggesting(false)
    }
  }

  const chapterLevel = (detail?.findings ?? []).filter(f => f.para === null && sev[f.severity])
  const paraFindings = (detail?.findings ?? []).filter(f => f.para !== null && sev[f.severity])
  const sel = selected !== null && detail ? selected : null
  const selFindings = sel !== null ? (byPara[sel] ?? []) : []
  const preview = selFindings.find(f => f.fixPreview)?.fixPreview
  const span = sel !== null && detail ? detail.sourceMap[sel] : null

  const small: React.CSSProperties = { fontSize: '11px', fontWeight: 800, border: '2px solid var(--color-border)', padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }

  return (
    <div className="neo-modal-backdrop" style={{ zIndex: 230 }} onClick={() => onClose(changed)}>
      <div className="neo-modal" style={{ width: '1180px', maxWidth: '97vw', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--bg-cyan,#8AF0FF)', flexShrink: 0 }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--on-accent,#111)', minWidth: 0 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', textTransform: 'uppercase' }}>Tinjau Bab {detail?.chapterNumber ?? ''}</span>
            <span className="truncate" style={{ fontSize: '12px', opacity: 0.75 }}>{detail?.title}</span>
            {archived && <span style={{ fontSize: '10px', fontWeight: 800, border: '1.5px solid #111', padding: '0 6px' }}>VERSI SEBELUMNYA DIARSIPKAN</span>}
          </div>
          <button onClick={() => onClose(changed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-accent,#111)', display: 'flex' }}><X size={18} /></button>
        </div>

        {loading && <div className="flex items-center justify-center flex-1 gap-2" style={{ fontSize: '13px' }}><Loader2 size={18} className="animate-spin" /> Memuat bab...</div>}

        {detail && (
          <div className="flex flex-1" style={{ minHeight: 0 }}>
            {/* Findings list */}
            <div style={{ width: '300px', flexShrink: 0, borderRight: '2px solid var(--color-border)', overflowY: 'auto', padding: '10px 12px' }}>
              <div className="flex items-center gap-2" style={{ fontSize: '11px', marginBottom: '8px' }}>
                {(['high', 'medium', 'low'] as QaSeverity[]).map(s => (
                  <label key={s} className="flex items-center gap-1" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={sev[s]} onChange={e => setSev(p => ({ ...p, [s]: e.target.checked }))} style={{ accentColor: SEV_COLOR[s] }} />
                    <span style={{ color: SEV_COLOR[s], fontWeight: 800, textTransform: 'uppercase' }}>{s}</span>
                  </label>
                ))}
              </div>

              {chapterLevel.length > 0 && (
                <>
                  <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '4px 0' }}>Tingkat bab</div>
                  {chapterLevel.map((f, i) => (
                    <div key={`c${i}`} style={{ fontSize: '11px', padding: '5px 6px', borderLeft: `3px solid ${SEV_COLOR[f.severity]}`, marginBottom: '4px', background: 'var(--color-surface-2)' }}>
                      <code style={{ fontWeight: 700 }}>{f.type}</code>
                      <div style={{ color: 'var(--color-text-muted)' }}>{say(f)}</div>
                    </div>
                  ))}
                </>
              )}

              <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '8px 0 4px' }}>
                Per paragraf ({paraFindings.length})
              </div>
              {paraFindings.length === 0 && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tidak ada.</p>}
              {paraFindings.map((f, i) => (
                <button key={`p${i}`} onClick={() => select(f.para!)} style={{
                  display: 'block', width: '100%', textAlign: 'left', fontSize: '11px', padding: '5px 6px', marginBottom: '4px', cursor: 'pointer',
                  border: 'none', borderLeft: `3px solid ${SEV_COLOR[f.severity]}`,
                  background: sel === f.para ? 'var(--color-surface-2)' : 'transparent', color: 'var(--color-text)',
                }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>¶{f.para} </span>
                  <code style={{ fontWeight: 700 }}>{f.type}</code>
                  {f.fix && <span style={{ marginLeft: 4, fontSize: '9px', fontWeight: 800, color: 'var(--fg-green,#28E272)' }}>AUTO</span>}
                  <div style={{ color: 'var(--color-text-muted)' }}>{say(f)}</div>
                </button>
              ))}
            </div>

            {/* Translation */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                Klik paragraf mana pun untuk mengeditnya. Paragraf bertanda warna punya temuan.
              </p>
              {detail.paragraphs.map((p, i) => {
                const fs = byPara[i]
                const color = fs ? SEV_COLOR[fs.some(f => f.severity === 'high') ? 'high' : fs.some(f => f.severity === 'medium') ? 'medium' : 'low'] : 'transparent'
                const isSel = sel === i
                return (
                  <div key={i} ref={el => { paraRefs.current[i] = el }}>
                    <div onClick={() => !isSel && select(i)} style={{
                      display: 'flex', gap: '10px', padding: '5px 8px', cursor: isSel ? 'default' : 'pointer',
                      borderLeft: `3px solid ${color}`, background: isSel ? 'var(--color-surface-2)' : fs ? 'rgba(255,176,32,0.06)' : 'transparent',
                    }}>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--color-text-subtle)', width: '30px', flexShrink: 0, paddingTop: '3px' }}>{i}</span>
                      <span style={{ fontSize: '14px', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{p}</span>
                    </div>

                    {isSel && (
                      <div style={{ margin: '6px 0 14px 40px', border: '2px solid var(--color-border)', padding: '10px 12px', background: 'var(--color-surface)' }}>
                        {selFindings.map((f, k) => (
                          <p key={k} style={{ fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: SEV_COLOR[f.severity], fontWeight: 800 }}>● </span>
                            <code style={{ fontWeight: 700 }}>{f.type}</code> — {say(f)}
                          </p>
                        ))}

                        {span && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Sumber (baris {span[0]}–{span[1]})</div>
                            <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto', padding: '6px 8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                              {detail.source.slice(span[0], span[1] + 1).filter(l => l.trim()).join('\n')}
                            </div>
                          </div>
                        )}

                        {preview && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--fg-green,#28E272)' }}>Perbaikan otomatis (tanpa AI)</div>
                            <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', padding: '6px 8px', border: '1px solid var(--fg-green,#28E272)' }}>{preview}</div>
                            <button onClick={() => save(preview)} disabled={busy || disabled} style={{ ...small, marginTop: '4px', background: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)' }}>
                              <Wand2 size={12} /> TERAPKAN PERBAIKAN OTOMATIS
                            </button>
                          </div>
                        )}

                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Edit paragraf (baris kosong = pecah jadi beberapa paragraf)</div>
                          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={Math.min(12, Math.max(3, Math.ceil(draft.length / 90)))}
                            style={{ width: '100%', fontSize: '14px', lineHeight: 1.6, padding: '6px 8px', border: '2px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', resize: 'vertical', outline: 'none' }} />
                          <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '4px' }}>
                            <button onClick={() => save(draft)} disabled={busy || disabled || !draft.trim() || draft === p} style={{ ...small, background: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', opacity: (!draft.trim() || draft === p) ? 0.5 : 1 }}>
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SIMPAN
                            </button>
                            <button onClick={() => save('')} disabled={busy || disabled} style={{ ...small, background: 'var(--bg-red,#FF8A8A)', color: 'var(--on-accent,#111)' }}>
                              <Trash2 size={12} /> HAPUS PARAGRAF
                            </button>
                            <button onClick={askAi} disabled={suggesting || busy} style={{ ...small, background: 'var(--bg-purple,#C9A7FF)', color: 'var(--on-accent,#111)' }} title="Satu panggilan ke model worker series ini">
                              {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} MINTA SARAN AI
                            </button>
                            <button onClick={() => { setSelected(null); setSuggestion(null) }} style={{ ...small, background: 'transparent', marginLeft: 'auto' }}>TUTUP</button>
                          </div>
                        </div>

                        {suggestion && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--fg-purple,#C9A7FF)' }}>Saran AI</div>
                            {suggestion.del ? (
                              <p style={{ fontSize: '13px', padding: '6px 8px', border: '1px solid var(--fg-purple,#C9A7FF)' }}>Model menyarankan paragraf ini <strong>dihapus</strong>.</p>
                            ) : (
                              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', padding: '6px 8px', border: '1px solid var(--fg-purple,#C9A7FF)' }}>{suggestion.text}</div>
                            )}
                            <div className="flex gap-2" style={{ marginTop: '4px' }}>
                              <button onClick={() => save(suggestion.del ? '' : suggestion.text)} disabled={busy || disabled} style={{ ...small, background: 'var(--bg-purple,#C9A7FF)', color: 'var(--on-accent,#111)' }}>
                                TERAPKAN SARAN
                              </button>
                              {!suggestion.del && (
                                <button onClick={() => setDraft(suggestion.text)} style={{ ...small, background: 'transparent' }}>SALIN KE EDITOR</button>
                              )}
                            </div>
                          </div>
                        )}

                        {err && <p style={{ fontSize: '12px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 700, marginTop: '6px' }}>{err}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {!detail && err && <p style={{ padding: '20px', fontSize: '13px', color: 'var(--fg-red,#FF3C3C)' }}>{err}</p>}
      </div>
    </div>
  )
}
