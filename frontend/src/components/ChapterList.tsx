/**
 * LWNTL Chapter List Component
 * Left panel in Series Settings - lists chapters with status dots
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical, Edit, Trash2 } from 'lucide-react'
import type { Chapter, ChapterStatus } from '../types'

interface ChapterListProps {
  seriesId: string
  chapters: Chapter[]
  onAddChapter: () => void
  onEditChapter: (chapter: Chapter) => void
  onDeleteChapter: (chapter: Chapter) => void
}

const statusColors: Record<ChapterStatus, string> = {
  pending: '#999',
  processing: '#FFEF33',
  done: '#28E272',
  error: '#FF3C3C',
}

const statusLabels: Record<ChapterStatus, string> = {
  pending: 'Belum',
  processing: 'Proses',
  done: 'Selesai',
  error: 'Error',
}

export function ChapterList({ seriesId, chapters, onAddChapter, onEditChapter, onDeleteChapter }: ChapterListProps) {
  const navigate = useNavigate()

  // Sort chapters by number
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: '#fff',
        border: '2.5px solid #111',
        boxShadow: '4px 4px 0px #111',
        minWidth: '220px',
        maxWidth: '280px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '2.5px solid #111' }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          DAFTAR BAB
        </span>
        <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>
          {chapters.length}
        </span>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-full p-4">
            <p style={{ fontSize: '13px', color: '#999', textAlign: 'center' }}>
              Belum ada bab
            </p>
          </div>
        )}
        {sorted.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            onEdit={onEditChapter}
            onDelete={onDeleteChapter}
            onClick={() => navigate(`/series/${seriesId}/chapter/${chapter.id}`)}
          />
        ))}
      </div>

      {/* Add button */}
      <div style={{ borderTop: '2.5px solid #111' }}>
        <button
          onClick={onAddChapter}
          className="flex items-center justify-center gap-2 w-full py-3 font-bold hover:bg-gray-50 transition-colors"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '13px',
            color: '#111',
          }}
        >
          <Plus size={16} />
          TAMBAH BAB
        </button>
      </div>
    </div>
  )
}

function ChapterItem({
  chapter,
  onEdit,
  onDelete,
  onClick,
}: {
  chapter: Chapter
  onEdit: (c: Chapter) => void
  onDelete: (c: Chapter) => void
  onClick: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const statusColor = statusColors[chapter.status]
  const statusLabel = statusLabels[chapter.status]

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors group"
      style={{ borderBottom: '1px solid #eee' }}
      onClick={onClick}
    >
      {/* Status dot */}
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: statusColor,
          border: '2px solid #111',
          flexShrink: 0,
        }}
        title={statusLabel}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Bab {chapter.chapterNumber}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </p>
      </div>

      {/* Menu */}
      <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          <MoreVertical size={14} style={{ color: '#666' }} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full z-50"
            style={{
              backgroundColor: '#fff',
              border: '2.5px solid #111',
              boxShadow: '4px 4px 0px #111',
              minWidth: '140px',
              zIndex: 50,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(chapter) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold hover:bg-gray-100"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <Edit size={12} /> Edit
            </button>
            <div style={{ height: '2px', backgroundColor: '#111' }} />
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(chapter) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold hover:bg-red-50"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#FF3C3C' }}
            >
              <Trash2 size={12} /> Hapus
            </button>
          </div>
        )}
      </div>
    </div>
  )
}