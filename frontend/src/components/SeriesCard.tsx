/**
 * LWNTL Series Card Component
 * Card with accent bar, title, language, progress, and context menu
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Edit, Settings, Trash2 } from 'lucide-react'
import type { Series, Chapter } from '../types'

interface SeriesCardProps {
  series: Series
  chapters: Chapter[]
  onEdit: (series: Series) => void
  onDelete: (series: Series) => void
}

export function SeriesCard({ series, chapters, onEdit, onDelete }: SeriesCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const totalChapters = chapters.length
  const doneChapters = chapters.filter(c => c.status === 'done').length
  const progress = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0

  // Close menu on outside click
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

  return (
    <div
      className="neo-card cursor-pointer transition-all duration-150"
      style={{
        boxShadow: menuOpen ? '2px 2px 0px var(--color-border)' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!menuOpen) {
          e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-border)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-border)'
        setMenuOpen(false)
      }}
      onClick={() => navigate(`/series/${series.id}/settings`)}
    >
      {/* Accent Bar */}
      <div style={{ height: '6px', backgroundColor: '#00F7FF', borderBottom: '2.5px solid var(--color-border)' }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <h3
            className="flex-1 mr-2"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: '1.2',
              color: 'var(--color-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {series.title}
          </h3>

          {/* Menu button */}
          <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
              className="flex items-center justify-center w-8 h-8 transition-colors"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MoreVertical size={18} style={{ color: 'var(--color-text-muted)' }} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '2.5px solid var(--color-border)',
                  boxShadow: 'var(--neo-shadow)',
                  minWidth: '180px',
                  zIndex: 50,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onEdit(series)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Edit size={14} />
                  Edit Series
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    navigate(`/series/${series.id}/settings`)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Settings size={14} />
                  Pengaturan Series
                </button>
                <div style={{ height: '2.5px', backgroundColor: 'var(--color-border)' }} />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onDelete(series)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#FF3C3C' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Trash2 size={14} />
                  Hapus Series
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Language & chapter count */}
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          {series.sourceLanguage} → {series.targetLanguage || 'Indonesian'} &nbsp;•&nbsp; {totalChapters} bab
        </p>

        {/* Progress bar */}
        <div className="neo-progress" style={{ height: '20px', marginBottom: '6px' }}>
          <div
            className="neo-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress text */}
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {doneChapters} / {totalChapters} selesai ({progress}%)
        </p>
      </div>
    </div>
  )
}
