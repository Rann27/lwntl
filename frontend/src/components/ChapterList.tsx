import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
/**
 * LWNTL Chapter List Component
 * Left panel in Series Settings: chapter list with search + status dots
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical, Edit, Trash2, Search, X, Download, CopyCheck } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Chapter, ChapterStatus } from '../types'

interface ChapterListProps {
  seriesId: string
  chapters: Chapter[]
  onAddChapter: () => void
  onEditChapter: (chapter: Chapter) => void
  onDeleteChapter: (chapter: Chapter) => void
  onExportChapter?: (chapter: Chapter) => void
  onMarkRawDone?: (chapter: Chapter) => void
  // Select mode
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

const statusColors: Record<ChapterStatus, string> = {
  pending:    'var(--muted-foreground)',
  processing: 'var(--fg-yellow,#FFEF33)',
  done:       'var(--fg-green,#28E272)',
  error:      'var(--fg-red,#FF3C3C)',
}

export function ChapterList({ seriesId, chapters, onAddChapter, onEditChapter, onDeleteChapter, onExportChapter, onMarkRawDone, selectMode = false, selectedIds, onToggleSelect }: ChapterListProps) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Sort chapters by number
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [chapters]
  )

  // Filter: hybrid: by number prefix OR title (case-insensitive contains)
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
    setSearch(`${t.chapter.chapter} ${ch.chapterNumber}${ch.title ? `: ${ch.title}` : ''}`)
    setShowSuggestions(false)
    navigate(`/series/${seriesId}/chapter/${ch.id}`)
  }

  return (
    <div
      className="chapter-list flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ borderRadius: 'var(--radius)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '14px',
            textTransform: 'none',
            letterSpacing: 'normal',
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
          <Input aria-label={t.chapter.searchPlaceholder}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={t.chapter.searchPlaceholder}
            className="flex-1 text-sm outline-none"
            style={{ borderRadius: 'var(--radius)',
              border: 'none',
              padding: '2px 0',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              background: 'transparent',
              color: 'var(--color-text)',
            }}
          />
          {search && (
            <Button aria-label="Close" variant="ghost"
              onClick={() => { setSearch(''); setShowSuggestions(false) }}
              style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0 }}
            >
              <X size={12} />
            </Button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 z-50"
            style={{ borderRadius: 'var(--radius)',
              top: '100%',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {suggestions.map((ch) => (
              <Button variant="ghost"
                key={ch.id}
                onClick={() => handleSuggestionClick(ch)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left"
                style={{ borderRadius: 'var(--radius)',
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
                    border: '1px solid var(--color-border)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.title || `${t.chapter.chapter} ${ch.chapterNumber}`}
                </span>
              </Button>
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
            onExport={onExportChapter}
            onMarkRawDone={onMarkRawDone}
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
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <Button variant="ghost"
          onClick={onAddChapter}
          className="flex items-center justify-center gap-2 w-full h-9 font-semibold transition-colors"
          style={{ borderRadius: 'var(--radius)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={15} />
          {t.chapter.addChapter}
        </Button>
      </div>
    </div>
  )
}

function ChapterItem({
  chapter,
  onEdit,
  onDelete,
  onExport,
  onMarkRawDone,
  onClick,
  selectMode = false,
  selected = false,
}: {
  chapter: Chapter
  onEdit: (c: Chapter) => void
  onDelete: (c: Chapter) => void
  onExport?: (c: Chapter) => void
  onMarkRawDone?: (c: Chapter) => void
  onClick: () => void
  selectMode?: boolean
  selected?: boolean
}) {
  const { t } = useI18n()
  return (
    <div
      className="flex items-center gap-2.5 pl-3 pr-1.5 py-1.5 cursor-pointer group"
      style={{
        borderBottom: `1px solid var(--color-separator)`,
        backgroundColor: selected ? 'var(--accent)' : 'transparent',
        borderLeft: selected ? '1px solid var(--fg-cyan,#00F7FF)' : '1px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--color-surface-2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = selected ? 'var(--accent)' : 'transparent' }}
    >
      {/* Checkbox (select mode) or status dot (normal mode) */}
      {selectMode ? (
        <div
          style={{ borderRadius: 'var(--radius)',
            width: '16px', height: '16px', flexShrink: 0,
            border: `1px solid ${selected ? 'var(--primary)' : 'var(--color-border)'}`,
            backgroundColor: selected ? 'var(--primary)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {selected && <span style={{ fontSize: '10px', fontWeight: 650, color: 'var(--primary-foreground)', lineHeight: 1 }}>✓</span>}
        </div>
      ) : (
        <div
          style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: statusColors[chapter.status],
            border: '1px solid var(--color-border)', flexShrink: 0,
          }}
          title={t.chapter.status[chapter.status] || chapter.status}
        />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: '13px', fontWeight: 600, color: selected ? 'var(--fg-cyan,#00F7FF)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chapter.title || `${t.chapter.chapter} ${chapter.chapterNumber}`}
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
        // Portaled menu: never clipped by the scrolling list. React still bubbles
        // portal clicks to this row, so they are stopped here.
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More options" variant="ghost" size="icon-xs"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity">
                <MoreVertical size={14} style={{ color: 'var(--color-text-muted)' }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(chapter)}><Edit />{t.common.edit}</DropdownMenuItem>
              {onExport && chapter.status === 'done' && (
                <DropdownMenuItem onClick={() => onExport(chapter)}><Download />Export .docx</DropdownMenuItem>
              )}
              {onMarkRawDone && chapter.status !== 'processing' && chapter.rawContent?.trim() && (
                <DropdownMenuItem onClick={() => onMarkRawDone(chapter)} title={t.batch.markRawDoneHint}>
                  <CopyCheck />{t.batch.markRawDone}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(chapter)}><Trash2 />{t.common.delete}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
