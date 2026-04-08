/**
 * LWNTL Glossary Update Panel
 * Shows AI-extracted terms with status vs series glossary and per-entry add action.
 */

import { useState } from 'react'
import { ChevronDown, BookOpen, Plus, Check } from 'lucide-react'
import type { GlossaryUpdates, GlossaryEntry } from '../types'

interface GlossaryUpdatePanelProps {
  updates: GlossaryUpdates | null
  seriesGlossary: GlossaryEntry[]
  onAddEntry: (sourceTerm: string, translatedTerm: string, notes: string) => Promise<void>
  loading?: boolean
}

export function GlossaryUpdatePanel({ updates, seriesGlossary, onAddEntry, loading }: GlossaryUpdatePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [addedTerms, setAddedTerms] = useState<Set<string>>(new Set())
  const [addingTerm, setAddingTerm] = useState<string | null>(null)
  const [addingAll, setAddingAll] = useState(false)

  const entries = updates?.entries || []
  const entryCount = entries.length
  const hasError = updates?.error

  const isInGlossary = (sourceTerm: string): boolean => {
    const key = sourceTerm.toLowerCase().trim()
    if (addedTerms.has(key)) return true
    return seriesGlossary.some(g => g.sourceTerm.toLowerCase().trim() === key)
  }

  const pendingEntries = entries.filter(e => !isInGlossary(e.sourceTerm))

  const handleAdd = async (sourceTerm: string, translatedTerm: string, notes: string) => {
    setAddingTerm(sourceTerm)
    try {
      await onAddEntry(sourceTerm, translatedTerm, notes)
      setAddedTerms(prev => new Set([...prev, sourceTerm.toLowerCase().trim()]))
    } finally {
      setAddingTerm(null)
    }
  }

  const handleAddAll = async () => {
    setAddingAll(true)
    try {
      for (const entry of pendingEntries) {
        await onAddEntry(entry.sourceTerm, entry.translatedTerm, entry.notes)
        setAddedTerms(prev => new Set([...prev, entry.sourceTerm.toLowerCase().trim()]))
      }
    } finally {
      setAddingAll(false)
    }
  }

  return (
    <div style={{
      borderTop: '4px solid #00F7FF',
      backgroundColor: 'var(--color-surface)',
      borderLeft: '2.5px solid var(--color-border)',
      borderRight: '2.5px solid var(--color-border)',
      borderBottom: '2.5px solid var(--color-border)',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-2.5 transition-colors"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', width: '100%' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            size={16}
            style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms ease', color: 'var(--color-text)' }}
          />
          <BookOpen size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-text)' }}>
            UPDATE GLOSSARY ({entryCount})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasError && (
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#FF3C3C', padding: '2px 6px', border: '2px solid #FF3C3C', textTransform: 'uppercase' }}>
              ERROR
            </span>
          )}
          {pendingEntries.length > 0 && !expanded && (
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#111', background: '#28E272', padding: '2px 6px', border: '2px solid var(--color-border)', textTransform: 'uppercase' }}>
              {pendingEntries.length} BELUM DITAMBAHKAN
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ maxHeight: '300px', overflowY: 'auto', borderTop: '1px solid var(--color-separator)' }}>
          {entryCount === 0 ? (
            <div className="px-4 py-4 text-center" style={{ color: 'var(--color-text-subtle)', fontSize: '12px' }}>
              {hasError
                ? `Gagal mengekstrak glossary: ${updates?.error}`
                : 'Belum ada update glossary. Jalankan terjemahan untuk mengekstrak istilah.'}
            </div>
          ) : (
            <>
              {pendingEntries.length > 0 && (
                <div className="px-4 py-2" style={{ borderBottom: `1px solid var(--color-separator)` }}>
                  <button
                    onClick={handleAddAll}
                    disabled={addingAll || loading}
                    className="neo-button text-xs flex items-center gap-1"
                    style={{ padding: '6px 12px', fontSize: '11px', opacity: addingAll || loading ? 0.5 : 1 }}
                  >
                    <Plus size={12} />
                    {addingAll ? 'MENAMBAHKAN...' : `TAMBAHKAN SEMUA YANG BELUM ADA (${pendingEntries.length})`}
                  </button>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid var(--color-border)`, backgroundColor: 'var(--color-surface-2)' }}>
                    <th className="text-left px-3 py-1.5" style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Istilah Asli</th>
                    <th className="text-left px-3 py-1.5" style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Terjemahan</th>
                    <th className="text-left px-3 py-1.5" style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Catatan</th>
                    <th className="px-3 py-1.5" style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '90px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Status</th>
                    <th className="px-3 py-1.5" style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '110px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const inGlossary = isInGlossary(entry.sourceTerm)
                    const isBeingAdded = addingTerm === entry.sourceTerm

                    return (
                      <tr key={i} style={{ borderBottom: `1px solid var(--color-separator)`, opacity: inGlossary ? 0.6 : 1 }}>
                        <td className="px-3 py-1.5" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{entry.sourceTerm}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--color-text)' }}>{entry.translatedTerm}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--color-text-muted)' }}>{entry.notes || '—'}</td>

                        <td className="px-3 py-1.5" style={{ textAlign: 'center' }}>
                          {inGlossary ? (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '2px 6px', border: `1.5px solid var(--color-separator)`, textTransform: 'uppercase' }}>
                              Ada
                            </span>
                          ) : (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#111', background: '#FFEF33', padding: '2px 6px', border: '1.5px solid #111', textTransform: 'uppercase' }}>
                              Belum Ada
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-1.5" style={{ textAlign: 'center' }}>
                          {inGlossary ? (
                            <span style={{ color: '#28E272', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '10px', fontWeight: 700 }}>
                              <Check size={11} /> Ditambahkan
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAdd(entry.sourceTerm, entry.translatedTerm, entry.notes)}
                              disabled={isBeingAdded || addingAll || loading}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 10px',
                                border: '2px solid var(--color-border)',
                                background: isBeingAdded ? 'var(--color-surface-2)' : '#00F7FF',
                                color: '#111',
                                cursor: isBeingAdded || addingAll ? 'not-allowed' : 'pointer',
                                opacity: isBeingAdded || addingAll ? 0.6 : 1,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                boxShadow: '2px 2px 0px var(--color-border)',
                                transition: 'all 0.1s',
                              }}
                            >
                              {isBeingAdded ? '...' : 'Tambahkan'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}
