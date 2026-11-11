/**
 * AgentRunModal
 *
 * Starts the autonomous agent loop for a series: every unfinished chapter is
 * translated, each chapter is then reviewed and repaired by a tool-using agent,
 * and a final volume pass fixes cross-chapter name/term drift.
 *
 * The run is resumable: chapters already reviewed are skipped unless
 * "review again" is ticked, so a cancelled run picks up where it stopped.
 */

import { useState } from 'react'
import { X, Bot, Play } from 'lucide-react'
import { useI18n } from '../i18n'
import type { AgentReviewMode, Chapter } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  chapters: Chapter[]
  onStart: (opts: { brief: string; review: AgentReviewMode; volumePass: boolean; rereview: boolean; safeFixes: boolean }) => void
}

export function AgentRunModal({ open, onClose, chapters, onStart }: Props) {
  const { t } = useI18n()
  const [brief, setBrief] = useState('')
  const [review, setReview] = useState<AgentReviewMode>('full')
  const [volumePass, setVolumePass] = useState(true)
  const [rereview, setRereview] = useState(false)
  const [safeFixes, setSafeFixes] = useState(true)

  if (!open) return null

  const toTranslate = chapters.filter(c => c.status !== 'done').length
  const reviewed = chapters.filter(c => c.status === 'done' && c.agentReview).length
  const toReview = chapters.length - (rereview ? 0 : reviewed)

  const start = () => {
    onStart({ brief, review, volumePass, rereview, safeFixes })
    onClose()
  }

  const optionStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 10px',
    border: '2px solid var(--color-border)',
    backgroundColor: active ? '#C9A7FF' : 'var(--color-surface)',
    color: active ? '#111' : 'var(--color-text)',
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
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: '#C9A7FF', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <Bot size={17} color="#111" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t.agent.title}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', display: 'flex' }}>
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
              { label: t.agent.statTranslate, value: toTranslate },
              { label: t.agent.statReview, value: Math.max(toReview, 0) },
              { label: t.agent.statSkip, value: rereview ? 0 : reviewed },
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
              <button type="button" style={optionStyle(review === 'full')} onClick={() => setReview('full')}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{t.agent.reviewFull}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t.agent.reviewFullDesc}</div>
              </button>
              <button type="button" style={optionStyle(review === 'findings')} onClick={() => setReview('findings')}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{t.agent.reviewFindings}</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>{t.agent.reviewFindingsDesc}</div>
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2" style={{ fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={safeFixes} onChange={e => setSafeFixes(e.target.checked)} style={{ marginTop: '2px', accentColor: '#C9A7FF' }} />
            <span><strong>{t.agent.safeFixes}</strong><br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.safeFixesDesc}</span></span>
          </label>

          <label className="flex items-start gap-2" style={{ fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={volumePass} onChange={e => setVolumePass(e.target.checked)} style={{ marginTop: '2px', accentColor: '#C9A7FF' }} />
            <span><strong>{t.agent.volumePass}</strong><br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.volumePassDesc}</span></span>
          </label>

          <label className="flex items-start gap-2" style={{ fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={rereview} onChange={e => setRereview(e.target.checked)} style={{ marginTop: '2px', accentColor: '#C9A7FF' }} />
            <span><strong>{t.agent.rereview}</strong><br /><span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{t.agent.rereviewDesc}</span></span>
          </label>

          <p style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-muted)', borderLeft: '3px solid #C9A7FF', paddingLeft: '8px' }}>
            {t.agent.note}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: '2.5px solid var(--color-border)', flexShrink: 0 }}>
          <button onClick={onClose} className="neo-button" style={{ fontSize: '12px', backgroundColor: 'var(--color-surface-2)' }}>
            {t.common.cancel}
          </button>
          <button
            onClick={start}
            disabled={chapters.length === 0}
            className="neo-button"
            style={{ fontSize: '12px', backgroundColor: '#C9A7FF', color: '#111', opacity: chapters.length === 0 ? 0.5 : 1 }}
          >
            <Play size={13} style={{ display: 'inline', marginRight: '6px' }} />
            {t.agent.start}
          </button>
        </div>
      </div>
    </div>
  )
}
