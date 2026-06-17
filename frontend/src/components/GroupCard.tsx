/**
 * LWNTL Group Card Component
 * Folder-style card for series groups in the home grid
 */

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Folder, Edit, Trash2, FolderPlus, Palette } from 'lucide-react'
import { useI18n } from '../i18n'
import type { SeriesGroup, Series, Chapter } from '../types'

export const GROUP_COLORS = [
  { value: '#00F7FF', label: 'Cyan' },
  { value: '#FFEF33', label: 'Yellow' },
  { value: '#28E272', label: 'Green' },
  { value: '#FF3C3C', label: 'Red' },
  { value: '#FF8C00', label: 'Orange' },
  { value: '#C084FC', label: 'Purple' },
  { value: '#F472B6', label: 'Pink' },
]

interface GroupCardProps {
  group: SeriesGroup
  allGroups: SeriesGroup[]
  allSeries: Series[]
  chaptersMap: Record<string, Chapter[]>
  depth: number
  onOpen: (group: SeriesGroup) => void
  onRename: (group: SeriesGroup) => void
  onChangeColor: (group: SeriesGroup) => void
  onAddSubGroup: (group: SeriesGroup) => void
  onDelete: (group: SeriesGroup) => void
  // Drag-and-drop
  onDropSeries?: (seriesId: string, groupId: string) => void
  anyDragging?: boolean
}

function countDescendants(
  groupId: string,
  allGroups: SeriesGroup[],
  allSeries: Series[],
  chaptersMap: Record<string, Chapter[]>,
): { seriesCount: number; done: number; total: number } {
  // Collect all group ids in this subtree
  const subtreeIds = new Set<string>([groupId])
  let changed = true
  while (changed) {
    changed = false
    for (const g of allGroups) {
      if (g.parentId && subtreeIds.has(g.parentId) && !subtreeIds.has(g.id)) {
        subtreeIds.add(g.id)
        changed = true
      }
    }
  }
  let seriesCount = 0
  let done = 0
  let total = 0
  for (const s of allSeries) {
    if (s.groupId && subtreeIds.has(s.groupId)) {
      seriesCount++
      const chs = chaptersMap[s.id] || []
      total += chs.length
      done += chs.filter((c) => c.status === 'done').length
    }
  }
  return { seriesCount, done, total }
}

export function GroupCard({
  group,
  allGroups,
  allSeries,
  chaptersMap,
  depth,
  onOpen,
  onRename,
  onChangeColor,
  onAddSubGroup,
  onDelete,
  onDropSeries,
  anyDragging,
}: GroupCardProps) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const directSubGroups = allGroups.filter((g) => g.parentId === group.id).length
  const { seriesCount, done, total } = countDescendants(group.id, allGroups, allSeries, chaptersMap)
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const canAddSubGroup = depth < 2 // max depth is 2 (0-indexed) → 3 levels

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
        boxShadow: isDragOver
          ? `0 0 0 3px ${group.color}, 4px 4px 0px var(--color-border)`
          : menuOpen ? '2px 2px 0px var(--color-border)' : undefined,
        outline: isDragOver ? `3px solid ${group.color}` : 'none',
        outlineOffset: '2px',
      }}
      onMouseEnter={(e) => {
        if (!menuOpen && !anyDragging) e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-border)'
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-border)'
        setMenuOpen(false)
      }}
      onClick={() => !anyDragging && onOpen(group)}
      // Drop zone
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('series-id')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const seriesId = e.dataTransfer.getData('series-id')
        if (seriesId && onDropSeries) onDropSeries(seriesId, group.id)
      }}
    >
      {/* Color accent bar — pulses when drag target */}
      <div style={{
        height: isDragOver ? '10px' : '6px',
        backgroundColor: group.color,
        borderBottom: '2.5px solid var(--color-border)',
        transition: 'height 0.15s ease',
      }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
            <Folder
              size={20}
              style={{ color: group.color, flexShrink: 0, fill: group.color, fillOpacity: 0.2 }}
            />
            <h3
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
              {group.name}
            </h3>
          </div>

          {/* Menu button */}
          <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="flex items-center justify-center w-8 h-8 transition-colors"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MoreVertical size={18} style={{ color: 'var(--color-text-muted)' }} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '2.5px solid var(--color-border)',
                  boxShadow: 'var(--neo-shadow)',
                  minWidth: '180px',
                }}
              >
                <MenuItem icon={<Edit size={13} />} label={t.group.rename} onClick={() => { setMenuOpen(false); onRename(group) }} />
                <MenuItem icon={<Palette size={13} />} label={t.group.changeColor} onClick={() => { setMenuOpen(false); onChangeColor(group) }} />
                {canAddSubGroup && (
                  <MenuItem icon={<FolderPlus size={13} />} label={t.group.addSubGroup} onClick={() => { setMenuOpen(false); onAddSubGroup(group) }} />
                )}
                <div style={{ height: '2.5px', backgroundColor: 'var(--color-border)' }} />
                <MenuItem icon={<Trash2 size={13} />} label={t.group.delete} onClick={() => { setMenuOpen(false); onDelete(group) }} danger />
              </div>
            )}
          </div>
        </div>

        {/* Subtitle */}
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          {seriesCount} {t.group.series}
          {directSubGroups > 0 && <> &nbsp;•&nbsp; {directSubGroups} {t.group.subgroups}</>}
        </p>

        {/* Progress bar */}
        <div className="neo-progress" style={{ height: '20px', marginBottom: '6px' }}>
          <div className="neo-progress-fill" style={{ width: `${progress}%`, backgroundColor: group.color }} />
        </div>

        {/* Progress text */}
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {done} / {total} {t.group.translated} ({progress}%)
        </p>

        {/* Drop indicator */}
        {isDragOver && (
          <div
            style={{
              marginTop: '10px',
              padding: '6px 10px',
              backgroundColor: group.color,
              color: '#111',
              fontSize: '11px',
              fontWeight: 800,
              textAlign: 'center',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.5px',
            }}
          >
            PINDAHKAN KE SINI
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold transition-colors"
      style={{
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        color: disabled ? 'var(--color-text-subtle)' : danger ? '#FF3C3C' : 'var(--color-text)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = danger ? 'rgba(255,60,60,0.08)' : 'var(--color-surface-2)'
      }}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}
