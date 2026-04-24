/**
 * LWNTL Chapter List Component
 * Left panel in Series Settings — chapter list with search + status dots
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical, Edit, Trash2, Search, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Chapter, ChapterStatus } from '../types'

interface ChapterListProps {
  seriesId: string
  chapters: Chapter[]
  onAddChapter: () => void
  onEditChapter: (chapter: Chapter) => void
  onDeleteChapter: (chapter: Chapter) => void
  // Select mode
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

const statusColors: Record<ChapterStatus, string> = {
  pending:    '#999',
  processing: '#FFEF33',
  done:       '#28E272',
  error:      '#FF3C3C',
}

export function ChapterList({ seriesId, chapters, onAddChapter, onEditChapter, onDeleteChapter, selectMode = false, selectedIds, onToggleSelect }: ChapterListProps) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Sort chapters by number
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [chapters]
  )

  // Filter: hybrid — by number prefix OR title (case-insensitive contains)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((ch) => {
      const numStr = String(ch.chapterNumber)
      const title = ch.title?.toLowerCase() || ''
      return numStr.startsWith(q) || title.includes(q)
    })
  }, [sorted, search])

  // Autocomplete suggestions: top 5 matching chapters not already exact-shown
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || filtered.length === sorted.length) return []
    return filtered.slice(0, 5)
  }, [filtered, sorted.length, search])

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSuggestions])

  const handleSuggestionClick = (ch: Chapter) => {
    setSearch(`${t.chapter.chapter} ${ch.chapterNumber}${ch.title ? ` — ${ch.title}` : ''}`)
    setShowSuggestions(false)
    navigate(`/series/${seriesId}/chapter/${ch.id}`)
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '2.5px solid var(--color-border)',
        boxShadow: 'var(--neo-shadow)',
        minWidth: '220px',
        maxWidth: '280px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '2.5px solid var(--color-border)' }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--color-text)',
          }}
        >
          {t.chapter.chapterList}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {search.trim() ? `${filtered.length}/${chapters.length}` : chapters.length}
        </span>
      </div>

      {/* Search bar */}
      <div
        ref={searchRef}
        className="relative"
        style={{ borderBottom: '1px solid var(--color-separator)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <Search size={13} style={{ color: 'var(--color-text-subtle)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={t.chapter.searchPlaceholder}
            className="flex-1 text-sm outline-none"
            style={{
              border: 'none',
              padding: '2px 0',
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              background: 'transparent',
              color: 'var(--color-text)',
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowSuggestions(false) }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 z-50"
            style={{
              top: '100%',
              backgroundColor: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              boxShadow: 'var(--neo-shadow)',
            }}
          >
            {suggestions.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSuggestionClick(ch)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left"
                style={{
                  border: 'none',
                  borderBottom: `1px solid var(--color-separator)`,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: statusColors[ch.status],
                    border: '1.5px solid var(--color-border)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Bab {ch.chapterNumber}{ch.title ? ` — ${ch.title}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full p-4">
            <p style={{ fontSize: '13px', color: 'var(--color-text-subtle)', textAlign: 'center' }}>
              {chapters.length === 0 ? t.chapter.noChapters : t.chapter.notFound}
            </p>
          </div>
        )}
        {filtered.map((chapter) => (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            onEdit={onEditChapter}
            onDelete={onDeleteChapter}
            onClick={selectMode
              ? () => onToggleSelect?.(chapter.id)
              : () => navigate(`/series/${seriesId}/chapter/${chapter.id}`)
            }
            selectMode={selectMode}
            selected={selectedIds?.has(chapter.id) ?? false}
          />
        ))}
      </div>

      {/* Add button */}
      <div style={{ borderTop: '2.5px solid var(--color-border)' }}>
        <button
          onClick={onAddChapter}
          className="flex items-center justify-center gap-2 w-full py-3 font-bold transition-colors"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '13px',
            color: 'var(--color-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={16} />
          {t.chapter.addChapter}
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
  selectMode = false,
  selected = false,
}: {
  chapter: Chapter
  onEdit: (c: Chapter) => void
  onDelete: (c: Chapter) => void
  onClick: () => void
  selectMode?: boolean
  selected?: boolean
}) {
  const { t } = useI18n()
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

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer group"
      style={{
        borderBottom: `1px solid var(--color-separator)`,
        backgroundColor: selected ? 'rgba(0,247,255,0.08)' : 'transparent',
        borderLeft: selected ? '3px solid #00F7FF' : '3px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--color-surface-2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? 'rgba(0,247,255,0.08)' : 'transparent' }}
    >
      {/* Checkbox (select mode) or status dot (normal mode) */}
      {selectMode ? (
        <div
          style={{
            width: '16px', height: '16px', flexShrink: 0,
            border: `2px solid ${selected ? '#00F7FF' : 'var(--color-border)'}`,
            backgroundColor: selected ? '#00F7FF' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {selected && <span style={{ fontSize: '10px', fontWeight: 900, color: '#111', lineHeight: 1 }}>✓</span>}
        </div>
      ) : (
        <div
          style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: statusColors[chapter.status],
            border: '2px solid var(--color-border)', flexShrink: 0,
          }}
          title={t.chapter.status[chapter.status] || chapter.status}
        />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: '13px', fontWeight: 600, color: selected ? '#00F7FF' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.chapter.chapter} {chapter.chapterNumber}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </p>
      </div>

      {/* Status dot (shown in select mode next to text) or context menu (normal mode) */}
      {selectMode ? (
        <div
          style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: statusColors[chapter.status], flexShrink: 0,
          }}
          title={t.chapter.status[chapter.status]}
        />
      ) : (
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <MoreVertical size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full z-50"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '2.5px solid var(--color-border)',
                boxShadow: 'var(--neo-shadow)',
                minWidth: '140px',
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(chapter) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Edit size={12} /> {t.common.edit}
              </button>
              <div style={{ height: '2px', backgroundColor: 'var(--color-border)' }} />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(chapter) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#FF3C3C' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,60,60,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={12} /> {t.common.delete}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
