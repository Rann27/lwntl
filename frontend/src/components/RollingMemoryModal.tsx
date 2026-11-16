import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
      if (e.key === 'Escape' && !e.defaultPrevented) {
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
    ch.title ? `Ch ${ch.chapterNumber}: ${ch.title}` : `Chapter ${ch.chapterNumber}`

  return (
    <ModalSurface label="Rolling memory" onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col"
        style={{ borderRadius: 'var(--radius)',
          width: '780px',
          maxWidth: '95vw',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-page,#F8F3EA)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--muted)' }}
        >
          <div className="flex items-center gap-3">
            <BookText size={16} style={{ color: 'var(--fg-cyan,#00F7FF)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 650, fontSize: '14px', textTransform: 'none', letterSpacing: 'normal', color: 'var(--foreground)' }}>
              Rolling memory
            </span>
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#666)', fontWeight: 600 }}>
              {chaptersWithSummary.length} / {chapters.length} chapters summarized
            </span>
          </div>
          <Button aria-label="Close" variant="ghost" onClick={onClose} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted,#888)' }}>
            <X size={18} />
          </Button>
        </div>

        {/* Description */}
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <p style={{ fontSize: '12px', color: 'var(--fg-muted,#666)', lineHeight: 1.5 }}>
            Rolling memory adalah ringkasan per-chapter yang otomatis dibuat setelah translasi selesai.
            Dipakai sebagai konteks cerita untuk translasi chapter berikutnya. Kamu bisa edit atau hapus manual di sini.
          </p>
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {chapters.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p style={{ color: 'var(--muted-foreground)', fontSize: '13px' }}>No chapters yet.</p>
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
                        borderBottom: '1px solid var(--border)',
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
                              backgroundColor: hasSummary ? 'var(--fg-green)' : 'var(--border)',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                            {chapterLabel(ch)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isEditing && (
                            <Button variant="ghost"
                              onClick={() => startEdit(ch)}
                              style={{ color: 'var(--foreground)',  borderRadius: 'var(--radius)',
                                padding: '3px 10px',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'none',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--bg-cyan,#00F7FF)',
                                cursor: 'pointer',
                                letterSpacing: 'normal',
                              }}
                            >
                              {hasSummary ? 'Edit' : '+ Add'}
                            </Button>
                          )}
                          {!isEditing && hasSummary && (
                            <Button variant="ghost"
                              onClick={() => clearSummary(ch)}
                              disabled={saving}
                              style={{ color: 'var(--foreground)',  borderRadius: 'var(--radius)',
                                padding: '3px 10px',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'none',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--bg-red,#FFE0E0)',
                                cursor: 'pointer',
                                letterSpacing: 'normal',
                                opacity: saving ? 0.5 : 1,
                              }}
                            >
                              Clear
                            </Button>
                          )}
                          {isEditing && (
                            <>
                              <Button variant="ghost"
                                onClick={() => saveEdit(ch.id)}
                                disabled={saving}
                                style={{ color: 'var(--foreground)',  borderRadius: 'var(--radius)',
                                  padding: '3px 10px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  textTransform: 'none',
                                  border: '1px solid var(--border)',
                                  backgroundColor: 'var(--bg-green,#28E272)',
                                  cursor: saving ? 'not-allowed' : 'pointer',
                                  letterSpacing: 'normal',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  opacity: saving ? 0.6 : 1,
                                }}
                              >
                                <Save size={10} />
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button variant="ghost"
                                onClick={cancelEdit}
                                style={{ color: 'var(--foreground)',  borderRadius: 'var(--radius)',
                                  padding: '3px 10px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  textTransform: 'none',
                                  border: '1px solid var(--border)',
                                  backgroundColor: 'var(--bg-surface-2,#eee)',
                                  cursor: 'pointer',
                                  letterSpacing: 'normal',
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Summary content / editor */}
                      {isEditing ? (
                        <div className="px-5 pb-4">
                          <Textarea aria-label="Write chapter summary for rolling context..."
                            ref={textareaRef}
                            value={draftText}
                            onChange={e => setDraftText(e.target.value)}
                            rows={6}
                            style={{ borderRadius: 'var(--radius)',
                              width: '100%',
                              border: '1px solid var(--border)',
                              padding: '10px 12px',
                              fontSize: '12px',
                              fontFamily: 'var(--font-body)',
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
                        <div className="px-5 pb-3" style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                          No summary yet: will be auto-generated after translation.
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
          style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--fg-green)', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#888)' }}>Has summary</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--muted)', display: 'inline-block', marginLeft: '8px' }} />
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#888)' }}>No summary</span>
          </div>
          <Button variant="ghost"
            onClick={onClose}
            style={{ borderRadius: 'var(--radius)',
              padding: '5px 16px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'none',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
              cursor: 'pointer',
            }}
          >
            Close
          </Button>
        </div>
      </div>
    </ModalSurface>
  )
}
