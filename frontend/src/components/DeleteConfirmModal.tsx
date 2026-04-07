/**
 * LWNTL Delete Confirm Modal
 * Neobrutalism styled confirmation dialog with delayed confirm button
 */

import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle, X } from 'lucide-react'

interface DeleteConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  entityType: 'series' | 'chapter' | 'glossary'
  entityName: string
  details?: string[]
  loading?: boolean
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  details = [],
  loading = false,
}: DeleteConfirmModalProps) {
  const [canConfirm, setCanConfirm] = useState(false)

  // Enable confirm button after 1.5 seconds
  useEffect(() => {
    if (!open) {
      setCanConfirm(false)
      return
    }
    const timer = setTimeout(() => setCanConfirm(true), 1500)
    return () => clearTimeout(timer)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const typeLabel = entityType === 'series' ? 'SERIES' : entityType === 'chapter' ? 'BAB' : 'ENTRI'

  return (
    <div
      className="neo-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="neo-modal"
        style={{ maxWidth: '480px', animation: 'slideUp 150ms ease' }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trash2 size={22} style={{ color: '#FF3C3C' }} />
              <h2
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '20px',
                  color: '#111',
                }}
              >
                HAPUS {typeLabel}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="hover:opacity-70 transition-opacity"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Entity name highlight */}
          <p className="mb-3" style={{ fontSize: '14px', color: '#666' }}>
            Kamu akan menghapus:
          </p>
          <div
            className="mb-4 p-3"
            style={{
              border: '2.5px solid #111',
              backgroundColor: 'rgba(0, 247, 255, 0.1)',
            }}
          >
            <p
              style={{
                fontWeight: 700,
                fontSize: '16px',
                color: '#111',
              }}
            >
              "{entityName}"
            </p>
          </div>

          {/* Details */}
          {details.length > 0 && (
            <div className="mb-4">
              <p className="mb-2" style={{ fontSize: '14px', color: '#666' }}>
                Ini akan menghapus permanen:
              </p>
              <ul style={{ paddingLeft: '1.2rem', listStyle: 'disc' }}>
                {details.map((d, i) => (
                  <li key={i} style={{ fontSize: '14px', color: '#111' }}>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning */}
          <div
            className="flex items-center gap-2 mb-6 p-3"
            style={{
              backgroundColor: 'rgba(255, 60, 60, 0.08)',
              border: '2.5px solid #FF3C3C',
            }}
          >
            <AlertTriangle size={18} style={{ color: '#FF3C3C', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#FF3C3C' }}>
              TINDAKAN INI TIDAK BISA DIBATALKAN
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="neo-button"
              style={{ backgroundColor: '#F0F0F0' }}
            >
              BATAL
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || loading}
              className="neo-button neo-button-error"
              style={{
                opacity: canConfirm && !loading ? 1 : 0.5,
                cursor: canConfirm && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? 'MENGHAPUS...' : 'HAPUS PERMANEN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}