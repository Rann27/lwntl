import { useState, useEffect, useRef } from 'react'
import { X, Save, BookText } from 'lucide-react'
import type { Chapter } from '../types'
import { updateChapterSummary } from '../api'
import { useToast } from '../hooks/useToast'

interface Props {
  open: boolean
  onClose: () => void
  seriesId: string
  chapters: Chapter[]
  onChapterUpdated: (updated: Chapter) => void
}

export function RollingMemoryModal({ open, onClose, seriesId, chapters, onChapterUpdated }: Props) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setDraftText('')
    }
  }, [open])

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(draftText.length, draftText.length)
    }
  }, [editingId])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) { setEditingId(null); setDraftText('') }
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, editingId])

  const chaptersWithSummary = chapters.filter(c => c.summary)

  const startEdit = (ch: Chapter) => {
    setEditingId(ch.id)
    setDraftText(ch.summary ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraftText('')
  }

  const saveEdit = async (chapterId: string) => {
    setSaving(true)
    try {
      const updated = await updateChapterSummary(seriesId, chapterId, draftText)
      onChapterUpdated(updated)
      setEditingId(null)
      setDraftText('')
      toast.success('Summary saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const clearSummary = async (ch: Chapter) => {
    setSaving(true)
    try {
      const updated = await updateChapterSummary(seriesId, ch.id, '')
      onChapterUpdated(updated)
      toast.success('Summary cleared')
    } catch {
      toast.error('Failed to clear')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const chapterLabel = (ch: Chapter) =>
    ch.title ? `Ch ${ch.chapterNumber} — ${ch.title}` : `Chapter ${ch.chapterNumber}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col"
        style={{
          width: '780px',
          maxWidth: '95vw',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-page,#F8F3EA)',
          border: '3px solid #111',
          boxShadow: '6px 6px 0px #111',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '2.5px solid #111', flexShrink: 0, backgroundColor: '#111' }}
        >
          <div className="flex items-center gap-3">
            <BookText size={16} style={{ color: 'var(--fg-cyan,#00F7FF)' }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff' }}>
              ROLLING MEMORY
            </span>
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#666)', fontWeight: 600 }}>
              {chaptersWithSummary.length} / {chapters.length} chapters summarized
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted,#888)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <div className="px-5 py-3" style={{ borderBottom: '2px solid #e8e3da', flexShrink: 0 }}>
          <p style={{ fontSize: '12px', color: 'var(--fg-muted,#666)', lineHeight: 1.5 }}>
            Rolling memory adalah ringkasan per-chapter yang otomatis dibuat setelah translasi selesai.
            Dipakai sebagai konteks cerita untuk translasi chapter berikutnya. Kamu bisa edit atau hapus manual di sini.
          </p>
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {chapters.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p style={{ color: 'var(--line,#ccc)', fontSize: '13px' }}>No chapters yet.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {chapters
                .slice()
                .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))
                .map((ch, i) => {
                  const isEditing = editingId === ch.id
                  const hasSummary = !!ch.summary

                  return (
                    <div
                      key={ch.id}
                      style={{
                        borderBottom: '1.5px solid #e8e3da',
                        backgroundColor: isEditing ? 'var(--tint-yellow,#fffef5)' : (i % 2 === 0 ? 'var(--bg-surface,#fff)' : 'var(--bg-surface,#faf6ee)'),
                      }}
                    >
                      {/* Chapter header row */}
                      <div className="flex items-center justify-between px-5 py-2.5" style={{ gap: '12px' }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: hasSummary ? 'var(--bg-green,#28E272)' : '#ddd',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>
                            {chapterLabel(ch)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isEditing && (
                            <button
                              onClick={() => startEdit(ch)}
                              style={{
                                padding: '3px 10px',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                border: '2px solid #111',
                                backgroundColor: 'var(--bg-cyan,#00F7FF)',
                                cursor: 'pointer',
                                letterSpacing: '0.3px',
                              }}
                            >
                              {hasSummary ? 'EDIT' : '+ ADD'}
                            </button>
                          )}
                          {!isEditing && hasSummary && (
                            <button
                              onClick={() => clearSummary(ch)}
                              disabled={saving}
                              style={{
                                padding: '3px 10px',
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                border: '2px solid #111',
                                backgroundColor: 'var(--bg-red,#FFE0E0)',
                                cursor: 'pointer',
                                letterSpacing: '0.3px',
                                opacity: saving ? 0.5 : 1,
                              }}
                            >
                              CLEAR
                            </button>
                          )}
                          {isEditing && (
                            <>
                              <button
                                onClick={() => saveEdit(ch.id)}
                                disabled={saving}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  border: '2px solid #111',
                                  backgroundColor: 'var(--bg-green,#28E272)',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  letterSpacing: '0.3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  opacity: saving ? 0.6 : 1,
                                }}
                              >
                                <Save size={10} />
                                {saving ? 'SAVING...' : 'SAVE'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  border: '2px solid #111',
                                  backgroundColor: 'var(--bg-surface-2,#eee)',
                                  cursor: 'pointer',
                                  letterSpacing: '0.3px',
                                }}
                              >
                                CANCEL
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Summary content / editor */}
                      {isEditing ? (
                        <div className="px-5 pb-4">
                          <textarea
                            ref={textareaRef}
                            value={draftText}
                            onChange={e => setDraftText(e.target.value)}
                            rows={6}
                            style={{
                              width: '100%',
                              border: '2px solid #111',
                              padding: '10px 12px',
                              fontSize: '12px',
                              fontFamily: "'Inter', sans-serif",
                              lineHeight: 1.6,
                              resize: 'vertical',
                              outline: 'none',
                              backgroundColor: 'var(--bg-surface,#fff)',
                              boxSizing: 'border-box',
                            }}
                            placeholder="Write chapter summary for rolling context..."
                          />
                          <div style={{ fontSize: '11px', color: 'var(--fg-subtle,#aaa)', marginTop: '4px' }}>
                            {draftText.length} chars · Esc to cancel
                          </div>
                        </div>
                      ) : hasSummary ? (
                        <div
                          className="px-5 pb-3"
                          style={{ fontSize: '12px', color: 'var(--fg-muted,#555)', lineHeight: 1.65, whiteSpace: 'pre-wrap', cursor: 'text' }}
                          onClick={() => startEdit(ch)}
                          title="Click to edit"
                        >
                          {ch.summary}
                        </div>
                      ) : (
                        <div className="px-5 pb-3" style={{ fontSize: '11px', color: 'var(--line,#ccc)', fontStyle: 'italic' }}>
                          No summary yet — will be auto-generated after translation.
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-2.5"
          style={{ borderTop: '2px solid #e8e3da', flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--bg-green,#28E272)', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#888)' }}>Has summary</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ddd', display: 'inline-block', marginLeft: '8px' }} />
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#888)' }}>No summary</span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '5px 16px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              border: '2px solid #111',
              backgroundColor: '#111',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}
