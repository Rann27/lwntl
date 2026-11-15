import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
/**
 * LWNTL Edit Chapter Modal
 */

import { useState, useEffect } from 'react'
import { Edit, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Chapter } from '../types'

interface EditChapterModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (chapterId: string, number: string, title: string, rawContent: string) => void
  chapter: Chapter | null
  loading?: boolean
}

export function EditChapterModal({ open, onClose, onSubmit, chapter, loading }: EditChapterModalProps) {
  const { t } = useI18n()
  const [number, setNumber] = useState('')
  const [title, setTitle] = useState('')
  const [rawContent, setRawContent] = useState('')

  useEffect(() => {
    if (open && chapter) {
      setNumber(chapter.chapterNumber)
      setTitle(chapter.title)
      setRawContent(chapter.rawContent)
    }
  }, [open, chapter])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !chapter) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!number) return
    onSubmit(chapter.id, number, title.trim(), rawContent)
  }

  return (
    <ModalSurface label="Edit chapter" onClose={onClose} className="ui-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ui-modal" style={{ maxWidth: '560px', animation: 'slideUp 150ms ease' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Edit size={20} />
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px' }}>
                {t.modal.editChapter}
              </h2>
            </div>
            <Button aria-label="Close" variant="ghost" onClick={onClose} className="hover:opacity-70" style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={20} />
            </Button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-4 mb-4">
              <div style={{ width: '120px' }}>
                <Label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>
                  {t.modal.chapterNumber}
                </Label>
                <Input aria-label={t.modal.chapterNumber} type="text" value={number} onChange={(e) => setNumber(e.target.value)} className="ui-input" placeholder="1" />
              </div>
              <div className="flex-1">
                <Label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>
                  {t.modal.chapterTitle}
                </Label>
                <Input aria-label={t.modal.chapterTitle} type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="ui-input" />
              </div>
            </div>

            <div className="mb-6">
              <Label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>
                {t.modal.chapterContent}
              </Label>
              <Textarea aria-label={t.modal.chapterContent}
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                className="ui-textarea"
                style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={onClose} disabled={loading} className="" style={{ color: 'var(--foreground)',  backgroundColor: 'var(--bg-surface-2,#F0F0F0)' }}>
                {t.common.cancel}
              </Button>
              <Button variant="default" type="submit" disabled={!number || loading} className="" style={{ opacity: number && !loading ? 1 : 0.5 }}>
                {loading ? t.common.saving : t.modal.save}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalSurface>
  )
}
