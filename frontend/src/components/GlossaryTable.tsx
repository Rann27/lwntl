/**
 * LWNTL Glossary Table Component
 * Inline-editable table with search, add, delete
 */

import { useState, useMemo } from 'react'
import { Plus, Search, Trash2, Check, X, Edit2 } from 'lucide-react'
import type { GlossaryEntry } from '../types'

interface GlossaryTableProps {
  entries: GlossaryEntry[]
  seriesId: string
  onAdd: () => void
  onEdit: (entry: GlossaryEntry, sourceTerm: string, translatedTerm: string, notes: string) => void
  onDelete: (entry: GlossaryEntry) => void
}

export function GlossaryTable({ entries, onAdd, onEdit, onDelete }: GlossaryTableProps) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editTranslated, setEditTranslated] = useState('')
  const [editNotes, setEditNotes] = useState('')

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

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = () => {
    if (!editingId) return
    const entry = entries.find(e => e.id === editingId)
    if (!entry) return
    onEdit(entry, editSource, editTranslated, editNotes)
    setEditingId(null)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#fff', border: '2.5px solid #111', boxShadow: '4px 4px 0px #111' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid #111' }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          GLOSSARY
        </span>
        <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>
          {entries.length} entri
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid #eee' }}>
        <div className="flex items-center gap-2">
          <Search size={14} style={{ color: '#999', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari istilah..."
            className="flex-1 text-sm outline-none"
            style={{ border: 'none', padding: '4px 0', fontFamily: "'Inter', sans-serif" }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2.5px solid #111', backgroundColor: '#F8F3EA' }}>
              <th className="text-left px-3 py-2" style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Istilah Asli</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Terjemahan</th>
              <th className="text-left px-3 py-2" style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Catatan</th>
              <th className="px-2 py-2" style={{ width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8" style={{ color: '#999', fontSize: '13px' }}>
                  {entries.length === 0 ? 'Belum ada entri glossary' : 'Tidak ditemukan'}
                </td>
              </tr>
            )}
            {filtered.map((entry) => (
              <tr
                key={entry.id}
                style={{ borderBottom: '1px solid #eee' }}
                className="hover:bg-gray-50"
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
                        <button
                          onClick={saveEdit}
                          className="flex items-center justify-center w-7 h-7 hover:bg-green-50"
                          style={{ border: '2px solid #111', backgroundColor: '#28E272', cursor: 'pointer' }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center justify-center w-7 h-7 hover:bg-gray-100"
                          style={{ border: '2px solid #111', backgroundColor: '#F0F0F0', cursor: 'pointer' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2" style={{ fontWeight: 600 }}>{entry.sourceTerm}</td>
                    <td className="px-3 py-2">{entry.translatedTerm}</td>
                    <td className="px-3 py-2" style={{ color: '#666' }}>{entry.notes || '—'}</td>
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => startEdit(entry)}
                          className="flex items-center justify-center w-7 h-7 hover:bg-gray-100 opacity-0 group-hover:opacity-100"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          title="Edit"
                        >
                          <Edit2 size={12} style={{ color: '#666' }} />
                        </button>
                        <button
                          onClick={() => onDelete(entry)}
                          className="flex items-center justify-center w-7 h-7 hover:bg-red-50"
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
      <div style={{ borderTop: '2.5px solid #111' }}>
        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-2 w-full py-3 font-bold hover:bg-gray-50 transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px', color: '#111' }}
        >
          <Plus size={16} />
          ENTRI
        </button>
      </div>
    </div>
  )
}