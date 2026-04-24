/**
 * LWNTL Edit Raw Content Modal
 * Isolated modal so typing never triggers main page re-renders
 */

import { useState, useEffect, useRef } from 'react'
import { FileText, X, AlertTriangle } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Chapter } from '../types'

interface EditRawModalProps {
  open: boolean
  chapter: Chapter | null
  onClose: () => void
  onSave: (rawContent: string) => Promise<void>
}

export function EditRawModal({ open, chapter, onClose, onSave }: EditRawModalProps) {
  const { t } = useI18n()
  const [rawContent, setRawContent] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && chapter) {
      setRawContent(chapter.rawContent || '')
      // Focus textarea after render
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open, chapter])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !chapter) return null

  const hasTranslation = !!chapter.translatedContent

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(rawContent)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="neo-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="neo-modal"
        style={{ maxWidth: '780px', width: '90vw', animation: 'slideUp 150ms ease' }}
      >
        <div className="p-6 flex flex-col" style={{ maxHeight: '85vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--color-text)' }}>
                {t.chapter.rawContent} — {t.common.edit}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Bab {chapter.chapterNumber}{chapter.title ? ` — ${chapter.title}` : ''}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              className="hover:opacity-70"
            >
              <X size={20} />
            </button>
          </div>

          {/* Warning note when chapter already has a translation */}
          {hasTranslation && (
            <div
              className="flex items-start gap-2 px-3 py-2 mb-4"
              style={{
                backgroundColor: 'rgba(255, 239, 51, 0.12)',
                border: '2px solid #FFEF33',
                fontSize: '12px',
                lineHeight: '1.5',
                color: 'var(--color-text)',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={13} style={{ color: '#FFEF33', flexShrink: 0, marginTop: '1px' }} />
              <span>{t.chapter.rawEditedAfterTranslation}</span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={rawContent}
            onChange={(e) => setRawContent(e.target.value)}
            className="neo-textarea"
            style={{
              flex: 1,
              minHeight: '400px',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'none',
              overflowY: 'auto',
            }}
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-4" style={{ flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>
              {rawContent.length.toLocaleString()} karakter
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="neo-button"
                style={{ backgroundColor: '#F0F0F0', opacity: saving ? 0.5 : 1 }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="neo-button"
                style={{ backgroundColor: '#28E272', color: '#111', opacity: saving ? 0.5 : 1 }}
              >
                {saving ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
