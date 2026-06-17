/**
 * LWNTL Group Form Modal
 * Used for creating new groups and renaming existing ones.
 * Includes a color swatch picker.
 */

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n'
import { GROUP_COLORS } from './GroupCard'
import type { SeriesGroup } from '../types'

interface GroupFormModalProps {
  open: boolean
  mode: 'create' | 'rename' | 'color'
  group?: SeriesGroup | null
  onClose: () => void
  onSubmit: (name: string, color: string) => void
  loading?: boolean
}

export function GroupFormModal({ open, mode, group, onClose, onSubmit, loading }: GroupFormModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0].value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(group?.name || '')
    setColor(group?.color || GROUP_COLORS[0].value)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, group])

  if (!open) return null

  const showNameField = mode !== 'color'
  const showColorField = true

  const title =
    mode === 'create' ? t.home.addGroup :
    mode === 'rename' ? t.group.rename :
    t.group.changeColor

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (showNameField && !name.trim()) return
    onSubmit(showNameField ? name.trim() : (group?.name || ''), color)
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
          maxWidth: '380px',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '2.5px solid var(--color-border)' }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '15px',
              textTransform: 'uppercase',
              color: 'var(--color-text)',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Name field */}
          {showNameField && (
            <div>
              <label
                style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}
              >
                {mode === 'create' ? t.group.newGroupName : t.group.editGroupName}
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder={t.group.newGroupName}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Color swatches */}
          {showColorField && (
            <div>
              <label
                style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}
              >
                {t.group.colorLabel}
              </label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: c.value,
                      border: color === c.value
                        ? '3px solid var(--color-text)'
                        : '2.5px solid var(--color-border)',
                      cursor: 'pointer',
                      boxShadow: color === c.value ? '2px 2px 0 var(--color-text)' : 'none',
                      transition: 'box-shadow 0.1s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 font-bold text-sm"
              style={{
                border: '2.5px solid var(--color-border)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || (showNameField && !name.trim())}
              className="flex-1 py-2.5 font-bold text-sm neo-button"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {loading ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
