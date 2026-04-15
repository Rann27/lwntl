/**
 * LWNTL Glossary Table Component
 * Inline-editable table with search, hover preview, import/export
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search, Trash2, Check, X, Edit2, Download, Upload, FileJson, FileText } from 'lucide-react'
import type { GlossaryEntry } from '../types'
import { exportGlossaryFile } from '../api'
import { useI18n } from '../i18n'

interface GlossaryTableProps {
  entries: GlossaryEntry[]
  seriesId: string
  onAdd: () => void
  onEdit: (entry: GlossaryEntry, sourceTerm: string, translatedTerm: string, notes: string) => void
  onDelete: (entry: GlossaryEntry) => void
  onImport: (entries: Array<{ sourceTerm: string; translatedTerm: string; notes: string }>) => void
}

// ─── Hover Preview Tooltip (fixed-position, avoids overflow clipping) ────────

interface TooltipPos { x: number; y: number }

function GlossaryTooltip({ entry, pos }: { entry: GlossaryEntry | null; pos: TooltipPos | null }) {
  if (!entry || !pos) return null
  const date = entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString('id-ID') : '—'

  // Position to the left of the cursor, vertically centered around it
  const W = 240
  const left = Math.max(4, pos.x - W - 12)
  const top = pos.y - 60

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 9999,
        backgroundColor: 'var(--color-surface)',
        border: '2.5px solid var(--color-border)',
        boxShadow: 'var(--neo-shadow)',
        padding: '10px 12px',
        width: `${W}px`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
        Preview
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>Asli: </span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{entry.sourceTerm}</span>
      </div>
      <div style={{ marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>Terjemahan: </span>
        <span style={{ fontSize: '13px', color: 'var(--color-text)' }}>{entry.translatedTerm}</span>
      </div>
      {entry.notes && (
        <div style={{ marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>Catatan: </span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{entry.notes}</span>
        </div>
      )}
      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--color-separator)', fontSize: '10px', color: 'var(--color-text-subtle)' }}>
        Diperbarui: {date}
      </div>
    </div>
  )
}

// ─── Import/Export helpers ───────────────────────────────────────────────────

function buildJSON(entries: GlossaryEntry[]): string {
  const data = entries.map(({ sourceTerm, translatedTerm, notes }) => ({ sourceTerm, translatedTerm, notes }))
  return JSON.stringify(data, null, 2)
}

function buildCSV(entries: GlossaryEntry[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = 'sourceTerm,translatedTerm,notes'
  const rows = entries.map(({ sourceTerm, translatedTerm, notes }) =>
    `${esc(sourceTerm)},${esc(translatedTerm)},${esc(notes)}`
  )
  return header + '\n' + rows.join('\n')
}

function parseImportedFile(text: string, filename: string): Array<{ sourceTerm: string; translatedTerm: string; notes: string }> | null {
  try {
    if (filename.endsWith('.json')) {
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return null
      return data.map((row: any) => ({
        sourceTerm:     String(row.sourceTerm || row.source_term || row.source || '').trim(),
        translatedTerm: String(row.translatedTerm || row.translated_term || row.translation || '').trim(),
        notes:          String(row.notes || row.note || '').trim(),
      })).filter(r => r.sourceTerm && r.translatedTerm)
    } else {
      // CSV
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) return null
      // Skip header row
      const rows = lines.slice(1)
      return rows.map(line => {
        // simple CSV parse (handles quoted fields)
        const cols = line.match(/("([^"]|"")*"|[^,]*)(,("([^"]|"")*"|[^,]*))*/)
          ? line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'))
          : line.split(',')
        return {
          sourceTerm:     (cols[0] || '').trim(),
          translatedTerm: (cols[1] || '').trim(),
          notes:          (cols[2] || '').trim(),
        }
      }).filter(r => r.sourceTerm && r.translatedTerm)
    }
  } catch {
    return null
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function GlossaryTable({ entries, seriesId, onAdd, onEdit, onDelete, onImport }: GlossaryTableProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editTranslated, setEditTranslated] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [tooltipEntry, setTooltipEntry] = useState<GlossaryEntry | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExportMenu])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(
      (e) =>
        e.sourceTerm.toLowerCase().includes(q) ||
        e.translatedTerm.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q)
    )
  }, [entries, search])

  const startEdit = (entry: GlossaryEntry) => {
    setEditingId(entry.id)
    setEditSource(entry.sourceTerm)
    setEditTranslated(entry.translatedTerm)
    setEditNotes(entry.notes)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = () => {
    if (!editingId) return
    const entry = entries.find(e => e.id === editingId)
    if (!entry) return
    onEdit(entry, editSource, editTranslated, editNotes)
    setEditingId(null)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseImportedFile(text, file.name)
      if (parsed && parsed.length > 0) {
        onImport(parsed)
      } else {
        alert('Format file tidak valid atau tidak ada entri yang bisa diimpor.')
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid var(--color-border)' }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text)' }}>
          {t.seriesSettings.glossary}
        </span>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {entries.length} {t.seriesSettings.addEntry.replace('+ ', '').toLowerCase()}
          </span>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import glossary (JSON/CSV)"
            style={{ border: '1.5px solid var(--color-border)', background: 'transparent', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Upload size={11} /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          {/* Export */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export glossary"
              style={{ border: '1.5px solid var(--color-border)', background: 'transparent', cursor: 'pointer', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Download size={11} /> Export
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-full z-50"
                style={{ backgroundColor: 'var(--color-surface)', border: '2px solid var(--color-border)', boxShadow: 'var(--neo-shadow)', minWidth: '130px' }}
              >
                <button
                  onClick={async () => {
                    setShowExportMenu(false)
                    await exportGlossaryFile(seriesId, 'json', buildJSON(entries))
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileJson size={12} /> Export JSON
                </button>
                <div style={{ height: '1px', backgroundColor: 'var(--color-separator)' }} />
                <button
                  onClick={async () => {
                    setShowExportMenu(false)
                    await exportGlossaryFile(seriesId, 'csv', buildCSV(entries))
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)', textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <FileText size={12} /> Export CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: `1px solid var(--color-separator)` }}>
        <div className="flex items-center gap-2">
          <Search size={14} style={{ color: 'var(--color-text-subtle)', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.seriesSettings.searchGlossary}
            className="flex-1 text-sm outline-none"
            style={{ border: 'none', padding: '4px 0', fontFamily: "'Inter', sans-serif", background: 'transparent', color: 'var(--color-text)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <th className="text-left px-3 py-2" style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.sourceTerm}</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.translatedTerm}</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.notes}</th>
              <th className="px-2 py-2" style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8" style={{ color: 'var(--color-text-subtle)', fontSize: '13px' }}>
                  {entries.length === 0 ? t.seriesSettings.noGlossary : t.chapter.notFound}
                </td>
              </tr>
            )}
            {filtered.map((entry) => (
              <tr
                key={entry.id}
                style={{ borderBottom: `1px solid var(--color-separator)` }}
                onMouseEnter={(e) => {
                  if (editingId === entry.id) return
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setTooltipEntry(entry)
                  setTooltipPos({ x: rect.left, y: rect.top + rect.height / 2 })
                }}
                onMouseLeave={() => { setTooltipEntry(null); setTooltipPos(null) }}
                onMouseMove={(e) => {
                  if (tooltipEntry?.id === entry.id) {
                    setTooltipPos({ x: e.clientX, y: e.clientY })
                  }
                }}
              >
                {editingId === entry.id ? (
                  <>
                    <td className="px-2 py-1.5">
                      <input value={editSource} onChange={(e) => setEditSource(e.target.value)} className="neo-input" style={{ padding: '4px 8px', fontSize: '12px' }} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={editTranslated} onChange={(e) => setEditTranslated(e.target.value)} className="neo-input" style={{ padding: '4px 8px', fontSize: '12px' }} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="neo-input" style={{ padding: '4px 8px', fontSize: '12px' }} />
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={saveEdit} className="flex items-center justify-center w-7 h-7" style={{ border: '2px solid var(--color-border)', backgroundColor: '#28E272', cursor: 'pointer' }}>
                          <Check size={12} />
                        </button>
                        <button onClick={cancelEdit} className="flex items-center justify-center w-7 h-7" style={{ border: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', cursor: 'pointer' }}>
                          <X size={12} style={{ color: 'var(--color-text)' }} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2" style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {entry.sourceTerm}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>{entry.translatedTerm}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text-muted)' }}>{entry.notes || '—'}</td>
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => startEdit(entry)}
                          className="flex items-center justify-center w-7 h-7"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Edit"
                        >
                          <Edit2 size={12} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                        <button
                          onClick={() => onDelete(entry)}
                          className="flex items-center justify-center w-7 h-7"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Hapus"
                        >
                          <Trash2 size={12} style={{ color: '#FF3C3C' }} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      <div style={{ borderTop: '2.5px solid var(--color-border)' }}>
        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-2 w-full py-3 font-bold transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: 'var(--color-text)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={16} />
          {t.seriesSettings.addEntry}
        </button>
      </div>

      {/* Fixed-position tooltip — renders outside overflow context */}
      <GlossaryTooltip entry={tooltipEntry} pos={tooltipPos} />
    </div>
  )
}
