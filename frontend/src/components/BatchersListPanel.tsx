/**
 * BatchersListPanel - Global monitor for all active batch translations.
 * Live updates via Zustand subscription (no polling needed).
 */

import { useEffect, useState } from 'react'
import { X, Activity } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { getAllSeries, cancelTranslation } from '../api'

interface Props {
  open: boolean
  onClose: () => void
}

export function BatchersListPanel({ open, onClose }: Props) {
  const batches = useAppStore((s) => s.batches)
  const [seriesNames, setSeriesNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    getAllSeries()
      .then((list) => {
        const map: Record<string, string> = {}
        list.forEach((s) => { map[s.id] = s.title })
        setSeriesNames(map)
      })
      .catch(() => {})
  }, [open])

  const handleCancel = async (seriesId: string) => {
    try {
      await cancelTranslation(seriesId)
    } catch { /* ignore */ }
  }

  if (!open) return null

  const entries = Object.entries(batches)

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-end p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          maxHeight: '80vh',
          backgroundColor: 'var(--color-surface)',
          border: '2.5px solid var(--color-border)',
          boxShadow: 'var(--neo-shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '52px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
        >
          <div className="flex items-center gap-2">
            <Activity size={15} style={{ color: '#00F7FF' }} />
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '15px',
                color: 'var(--color-text)',
              }}
            >
              BATCH AKTIF
            </h2>
            {entries.length > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#00F7FF',
                  border: '1.5px solid #00F7FF',
                  padding: '1px 6px',
                  fontFamily: 'monospace',
                }}
              >
                {entries.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Activity size={28} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Tidak ada batch yang berjalan.
              </p>
            </div>
          ) : (
            entries.map(([seriesId, batch]) => {
              const title = seriesNames[seriesId] || seriesId
              const completed = batch.completed ?? 0
              const total = batch.total ?? 0
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              const isActive = batch.status === 'translating'
              const isDone = batch.status === 'done'
              const isCancelled = batch.status === 'cancelled'

              return (
                <div
                  key={seriesId}
                  style={{
                    border: '2.5px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    padding: '12px',
                  }}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p
                        className="truncate"
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: 'var(--color-text)',
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {title}
                      </p>
                      {batch.workerLabel && (
                        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                          {batch.workerLabel}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && <div className="w-2 h-2 bg-[#00F7FF] animate-pulse" />}
                      {isDone && (
                        <span style={{ fontSize: '10px', color: '#28E272', fontWeight: 700 }}>✓ SELESAI</span>
                      )}
                      {isCancelled && (
                        <span style={{ fontSize: '10px', color: '#666', fontWeight: 700 }}>DIBATALKAN</span>
                      )}
                      {isActive && (
                        <button
                          onClick={() => handleCancel(seriesId)}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#FF3C3C',
                            border: '1.5px solid #FF3C3C',
                            padding: '2px 8px',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          BATAL
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ flex: 1, height: '5px', backgroundColor: 'var(--color-border)' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: isDone ? '#28E272' : isCancelled ? '#555' : '#00F7FF',
                          transition: 'width 0.5s',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'monospace',
                        flexShrink: 0,
                      }}
                    >
                      {completed}/{total} ({pct}%)
                    </span>
                  </div>

                  {/* Current chapter */}
                  {isActive && batch.chapterNumber && (
                    <p style={{ fontSize: '11px', color: '#00F7FF' }}>
                      Bab {batch.chapterNumber}
                      {batch.chapterTitle ? ` — ${batch.chapterTitle}` : ''}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
