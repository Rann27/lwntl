/**
 * LWNTL Group Picker Modal
 * Lets the user pick a group (or root) to move a series into.
 */

import { X, Folder } from 'lucide-react'
import { useI18n } from '../i18n'
import type { SeriesGroup, Series } from '../types'

interface GroupPickerModalProps {
  open: boolean
  series: Series | null
  groups: SeriesGroup[]
  onClose: () => void
  onPick: (series: Series, groupId: string | null) => void
}

interface TreeNode {
  group: SeriesGroup
  depth: number
}

function buildTree(groups: SeriesGroup[]): TreeNode[] {
  const nodes: TreeNode[] = []
  const byParent = new Map<string | null, SeriesGroup[]>()
  for (const g of groups) {
    const key = g.parentId ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(g)
  }
  function visit(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) || []
    children.sort((a, b) => a.name.localeCompare(b.name))
    for (const g of children) {
      nodes.push({ group: g, depth })
      visit(g.id, depth + 1)
    }
  }
  visit(null, 0)
  return nodes
}

export function GroupPickerModal({ open, series, groups, onClose, onPick }: GroupPickerModalProps) {
  const { t } = useI18n()
  if (!open || !series) return null

  const tree = buildTree(groups)

  const Option = ({ groupId, name, color, depth }: {
    groupId: string | null
    name: string
    color?: string
    depth?: number
  }) => {
    const isCurrentGroup = series.groupId === groupId
    return (
      <button
        onClick={() => { onPick(series, groupId); onClose() }}
        disabled={isCurrentGroup}
        className="flex items-center gap-2 w-full text-left"
        style={{
          padding: `10px 16px 10px ${16 + (depth || 0) * 20}px`,
          border: 'none',
          borderBottom: '1px solid var(--color-separator)',
          background: isCurrentGroup ? 'var(--color-surface-2)' : 'transparent',
          cursor: isCurrentGroup ? 'default' : 'pointer',
          color: isCurrentGroup ? 'var(--color-text-muted)' : 'var(--color-text)',
        }}
        onMouseEnter={(e) => { if (!isCurrentGroup) e.currentTarget.style.backgroundColor = 'var(--color-surface-2)' }}
        onMouseLeave={(e) => { if (!isCurrentGroup) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        {color !== undefined ? (
          <Folder size={14} style={{ color, fill: color, fillOpacity: 0.25, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 14, height: 14, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '13px', fontWeight: isCurrentGroup ? 700 : 600 }}>
          {name}
          {isCurrentGroup && <span style={{ marginLeft: 8, fontSize: '11px', opacity: 0.6 }}>✓ sekarang</span>}
        </span>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '2.5px solid var(--color-border)',
          boxShadow: 'var(--neo-shadow-lg)',
          width: '100%',
          maxWidth: '360px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '2.5px solid var(--color-border)' }}
        >
          <div>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '14px',
                textTransform: 'uppercase',
                color: 'var(--color-text)',
              }}
            >
              {t.group.moveModalTitle}
            </span>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {series.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Options list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Root / ungrouped */}
          <Option groupId={null} name={t.group.ungrouped} depth={0} />

          {tree.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              {t.common.noData}
            </div>
          )}
          {tree.map(({ group, depth }) => (
            <Option key={group.id} groupId={group.id} name={group.name} color={group.color} depth={depth} />
          ))}
        </div>
      </div>
    </div>
  )
}
