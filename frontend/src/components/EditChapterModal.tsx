/**
 * LWNTL Edit Chapter Modal
 */

import { useState, useEffect } from 'react'
import { Edit, X } from 'lucide-react'
import type { Chapter } from '../types'

interface EditChapterModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (chapterId: string, number: number, title: string, rawContent: string) => void
  chapter: Chapter | null
  loading?: boolean
}

export function EditChapterModal({ open, onClose, onSubmit, chapter, loading }: EditChapterModalProps) {
  const [number, setNumber] = useState(0)
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
    <div className="neo-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="neo-modal" style={{ maxWidth: '560px', animation: 'slideUp 150ms ease' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Edit size={20} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px' }}>
                EDIT BAB
              </h2>
            </div>
            <button onClick={onClose} className="hover:opacity-70" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-4 mb-4">
              <div style={{ width: '120px' }}>
                <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Nomor Bab
                </label>
                <input type="number" value={number} onChange={(e) => setNumber(parseInt(e.target.value) || 0)} className="neo-input" min={1} />
              </div>
              <div className="flex-1">
                <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Judul (opsional)
                </label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="neo-input" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Konten Raw
              </label>
              <textarea
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                className="neo-textarea"
                style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={loading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>
                BATAL
              </button>
              <button type="submit" disabled={!number || loading} className="neo-button" style={{ opacity: number && !loading ? 1 : 0.5 }}>
                {loading ? 'MENYIMPAN...' : 'SIMPAN'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}