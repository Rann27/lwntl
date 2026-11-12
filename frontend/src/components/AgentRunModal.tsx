/**
 * AgentRunModal
 *
 * Starts the agent review for a series — the QA stage after batch translation.
 * Each translated chapter gets the safe mechanical fixes, then a review and
 * repair session with a tool-using agent; a final volume pass fixes
 * cross-chapter name/term drift. Untranslated chapters are skipped.
 *
 * The run is resumable: chapters already reviewed are skipped unless
 * "review again" is ticked, so a cancelled run picks up where it stopped.
 */

import { useEffect, useState } from 'react'
import { X, Bot, Play, History, Loader2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { listAgentBackups, restoreAgentBackup } from '../api'
import type { AgentBackup } from '../api'
import type { AgentReviewMode, Chapter } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  seriesId: string
  chapters: Chapter[]
  onStart: (opts: { brief: string; review: AgentReviewMode; volumePass: boolean; rereview: boolean; safeFixes: boolean }) => void
  /** Called after a backup was restored, so the page reloads its chapters. */
  onRestored?: () => void
}

export function AgentRunModal({ open, onClose, seriesId, chapters, onStart, onRestored }: Props) {
  const { t } = useI18n()
  const [brief, setBrief] = useState('')
  const [review, setReview] = useState<AgentReviewMode>('findings')
  const [volumePass, setVolumePass] = useState(true)
  const [rereview, setRereview] = useState(false)
  const [safeFixes, setSafeFixes] = useState(true)
  const [backups, setBackups] = useState<AgentBackup[]>([])
  const [restoreGlossary, setRestoreGlossary] = useState(false)
  const [restoring, setRestoring] = useState('')
  const [restoreMsg, setRestoreMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setRestoreMsg('')
    listAgentBackups(seriesId).then(setBackups).catch(() => setBackups([]))
  }, [open, seriesId])

  if (!open) return null

  const restore = async (b: AgentBackup) => {
    const when = new Date(b.createdAt).toLocaleString('id-ID')
    if (!confirm(`Kembalikan semua bab ke keadaan sebelum agent run ${when}?` +
      (restoreGlossary ? ' Glosarium juga dikembalikan.' : '') +
      ' Versi sekarang tetap disimpan di riwayat versi tiap bab.')) return
    setRestoring(b.id); setRestoreMsg('')
    try {
      const r = await restoreAgentBackup(seriesId, b.id, restoreGlossary)
      setRestoreMsg(`${r.chapters} bab dikembalikan${r.glossary ? ' beserta glosarium' : ''}.`)
      onRestored?.()
    } catch (e) {
      setRestoreMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setRestoring('')
    }
  }

  const translated = chapters.filter(c => c.status === 'done')
  const untranslated = chapters.length - translated.length
  const reviewed = translated.filter(c => c.agentReview).length
  const toReview = translated.length - (rereview ? 0 : reviewed)

  const start = () => {
    onStart({ brief, review, volumePass, rereview, safeFixes })
    onClose()
  }

  const optionStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 10px',
    border: '2px solid var(--color-border)',
    backgroundColor: active ? 'var(--bg-purple,#C9A7FF)' : 'var(--color-surface)',
    color: active ? 'var(--on-accent,#111)' : 'var(--color-text)',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: active ? '3px 3px 0 #111' : 'none',
  })

  return (
    <div className="neo-modal-backdrop" style={{ zIndex: 210 }} onClick={onClose}>
      <div
        className="neo-modal"
        style={{ width: '640px', maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--bg-purple,#C9A7FF)', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <Bot size={17} color="#111" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--on-accent,#111)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t.agent.title}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-accent,#111)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4" style={{ overflowY: 'auto', minHeight: 0 }}>
          <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            {t.agent.description}
          </p>

          {/* What the run will do */}
          <div className="flex gap-2" style={{ fontSize: '11px' }}>
            {[
              { label: t.agent.statReview, value: Math.max(toReview, 0) },
              { label: t.agent.statSkip, value: rereview ? 0 : reviewed },
              { label: t.agent.statUntranslated, value: untranslated },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, border: '2px solid var(--color-border)', padding: '6px 8px', backgroundColor: 'var(--color-surface-2)' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                <div style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Brief */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{t.agent.briefLabel}</label>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              rows={4}
              placeholder={t.agent.briefPlaceholder}
              style={{ width: '100%', border: '2px solid var(--color-border)', padding: '8px', fontSize: '12px', background: 'var(--color-surface)', color: 'var(--color-text)', resize: 'vertical', outline: 'none' }}
            />
          </div>

          {/* Review depth */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{t.agent.reviewLabel}</label>
            <div className="flex gap-2">
              <button type="button" style={optionStyle(review === 'findings')} onClick={() => setReview('findings')}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{t.agent.reviewFindings}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t.agent.reviewFindingsDesc}</div>
              </button>
              <button type="button" style={optionStyle(review === 'full')} onClick={() => setReview('full')}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{t.agent.reviewFull}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t.agent.reviewFullDesc}</div>
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2" style={{ fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={safeFixes} onChange={e => setSafeFixes(e.target.checked)} style={{ marginTop: '2px', accentColor: 'var(--fg-purple,#C9A7FF)' }} />
            <span><strong>{t.agent.safeFixes}</strong><br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.safeFixesDesc}</span></span>
          </label>

          <label className="flex items-start gap-2" style={{ fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={volumePass} onChange={e => setVolumePass(e.target.checked)} style={{ marginTop: '2px', accentColor: 'var(--fg-purple,#C9A7FF)' }} />
            <span><strong>{t.agent.volumePass}</strong><br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.volumePassDesc}</span></span>
          </label>

          <label className="flex items-start gap-2" style={{ fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={rereview} onChange={e => setRereview(e.target.checked)} style={{ marginTop: '2px', accentColor: 'var(--fg-purple,#C9A7FF)' }} />
            <span><strong>{t.agent.rereview}</strong><br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.rereviewDesc}</span></span>
          </label>

          <p style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-muted)', borderLeft: '3px solid var(--fg-purple,#C9A7FF)', paddingLeft: '8px' }}>
            {t.agent.note}
          </p>

          {/* Backups — a whole-series snapshot is taken before every run */}
          <div className="flex flex-col gap-1.5" style={{ border: '2px solid var(--color-border)', padding: '8px 10px' }}>
            <div className="flex items-center gap-2">
              <History size={13} />
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>{t.agent.backupTitle}</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{t.agent.backupDesc}</p>
            {backups.length === 0 ? (
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.backupNone}</p>
            ) : (
              <>
                {backups.map(b => (
                  <div key={b.id} className="flex items-center gap-2" style={{ fontSize: '12px' }}>
                    <span style={{ fontFamily: 'monospace' }}>{new Date(b.createdAt).toLocaleString('id-ID')}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>· {b.chapters} bab · {b.glossary} entri glosarium</span>
                    <button onClick={() => restore(b)} disabled={!!restoring} className="flex items-center gap-1"
                      style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 800, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase' }}>
                      {restoring === b.id && <Loader2 size={10} className="animate-spin" />} {t.agent.backupRestore}
                    </button>
                  </div>
                ))}
                <label className="flex items-center gap-2" style={{ fontSize: '11px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={restoreGlossary} onChange={e => setRestoreGlossary(e.target.checked)} style={{ accentColor: 'var(--fg-purple,#C9A7FF)' }} />
                  {t.agent.backupGlossary}
                </label>
              </>
            )}
            {restoreMsg && <p style={{ fontSize: '11px', fontWeight: 700 }}>{restoreMsg}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: '2.5px solid var(--color-border)', flexShrink: 0 }}>
          <button onClick={onClose} className="neo-button" style={{ fontSize: '12px', backgroundColor: 'var(--color-surface-2)' }}>
            {t.common.cancel}
          </button>
          <button
            onClick={start}
            disabled={translated.length === 0}
            className="neo-button"
            style={{ fontSize: '12px', backgroundColor: 'var(--bg-purple,#C9A7FF)', color: 'var(--on-accent,#111)', opacity: translated.length === 0 ? 0.5 : 1 }}
          >
            <Play size={13} style={{ display: 'inline', marginRight: '6px' }} />
            {t.agent.start}
          </button>
        </div>
      </div>
    </div>
  )
}
