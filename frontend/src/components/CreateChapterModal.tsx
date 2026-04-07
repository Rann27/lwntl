/**
 * LWNTL Create Chapter Modal - Single & Bulk
 */

import { useState, useEffect, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { Plus, X, Upload, GripVertical, Trash2 } from 'lucide-react'

interface BulkEntry {
  id: string
  filename: string
  number: number
  title: string
  content: string
}

interface CreateChapterModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (number: number, title: string, rawContent: string) => void
  onBulkSubmit: (chapters: { number: number; title: string; rawContent: string }[]) => Promise<void>
  nextChapterNumber: number
  loading?: boolean
}

export function CreateChapterModal({
  open, onClose, onSubmit, onBulkSubmit, nextChapterNumber, loading,
}: CreateChapterModalProps) {
  const [tab, setTab] = useState<'single' | 'bulk'>('single')

  // Single tab state
  const [number, setNumber] = useState(nextChapterNumber)
  const [title, setTitle] = useState('')
  const [rawContent, setRawContent] = useState('')

  // Bulk tab state
  const [entries, setEntries] = useState<BulkEntry[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setNumber(nextChapterNumber)
      setTitle('')
      setRawContent('')
      setEntries([])
      setTab('single')
      setIsDragOver(false)
    }
  }, [open, nextChapterNumber])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!number) return
    onSubmit(number, title.trim(), rawContent)
  }

  // Read txt files and append to entries list
  const processFiles = (files: File[]) => {
    const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'))
    if (!txtFiles.length) return

    const readers = txtFiles.map(file =>
      new Promise<Omit<BulkEntry, 'number'>>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const content = (ev.target?.result as string) || ''
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            filename: file.name,
            title: file.name.replace(/\.txt$/i, ''),
            content,
          })
        }
        reader.readAsText(file, 'utf-8')
      })
    )

    Promise.all(readers).then(newEntries => {
      setEntries(prev => {
        const combined = [
          ...prev,
          ...newEntries.map((e, i) => ({
            ...e,
            number: nextChapterNumber + prev.length + i,
          })),
        ]
        return combined
      })
    })
  }

  const handleDropZoneDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files))
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const updateEntry = (id: string, field: 'number' | 'title', value: string | number) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  // Drag-to-reorder rows
  const handleRowDragStart = (index: number) => {
    dragIndexRef.current = index
  }

  const handleRowDragOver = (e: DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    setEntries(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(index, 0, item)
      dragIndexRef.current = index
      return arr
    })
  }

  const handleRowDragEnd = () => {
    dragIndexRef.current = null
  }

  const handleBulkSubmit = async () => {
    if (!entries.length) return
    setBulkLoading(true)
    try {
      await onBulkSubmit(entries.map(e => ({
        number: e.number,
        title: e.title,
        rawContent: e.content,
      })))
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    // Backdrop: no onClick close (intentional per requirement)
    <div className="neo-modal-backdrop">
      <div
        className="neo-modal"
        style={{
          width: '50%',
          maxWidth: 'none',
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '2.5px solid #111', flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <Plus size={20} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px' }}>
              TAMBAH BAB
            </h2>
          </div>
          <button
            onClick={onClose}
            className="hover:opacity-70"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2.5px solid #111', flexShrink: 0 }}>
          {(['single', 'bulk'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 28px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                border: 'none',
                borderRight: '2px solid #eee',
                cursor: 'pointer',
                background: tab === t ? '#00F7FF' : 'transparent',
                color: '#111',
                transition: 'background 0.1s',
              }}
            >
              {t === 'single' ? 'Single' : 'Bulk'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>

          {/* ── SINGLE TAB ── */}
          {tab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex gap-4">
                  <div style={{ width: '130px' }}>
                    <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Nomor Bab
                    </label>
                    <input
                      type="number"
                      value={number}
                      onChange={(e) => setNumber(parseInt(e.target.value) || 0)}
                      className="neo-input"
                      min={1}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Judul (Opsional)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Contoh: The Return"
                      className="neo-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Konten Raw
                  </label>
                  <textarea
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Paste konten bab di sini..."
                    className="neo-textarea"
                    style={{ minHeight: '360px', fontFamily: 'monospace', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div
                className="flex justify-end gap-3 px-6 py-4"
                style={{ borderTop: '2.5px solid #111', flexShrink: 0 }}
              >
                <button type="button" onClick={onClose} disabled={loading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={!number || loading}
                  className="neo-button"
                  style={{ opacity: number && !loading ? 1 : 0.5 }}
                >
                  {loading ? 'MEMBUAT...' : 'BUAT BAB'}
                </button>
              </div>
            </form>
          )}

          {/* ── BULK TAB ── */}
          {tab === 'bulk' && (
            <div className="flex flex-col h-full">

              {/* Drop zone */}
              <div className="px-6 pt-5 pb-4" style={{ flexShrink: 0 }}>
                <div
                  className="flex flex-col items-center justify-center gap-2"
                  style={{
                    border: `2.5px dashed ${isDragOver ? '#00F7FF' : '#aaa'}`,
                    background: isDragOver ? '#e6fffe' : '#fafaf8',
                    padding: '28px 20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isDragOver ? '4px 4px 0px #00F7FF' : 'none',
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDropZoneDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={28} style={{ color: isDragOver ? '#00a8ad' : '#aaa' }} />
                  <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: isDragOver ? '#111' : '#666' }}>
                    {isDragOver ? 'Lepaskan file di sini' : 'Drag & drop file .txt di sini'}
                  </p>
                  <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>
                    atau klik untuk pilih file — bisa multiple, hanya .txt
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileInput}
                  />
                </div>
              </div>

              {/* Table */}
              <div
                className="flex-1 overflow-y-auto px-6"
                style={{ minHeight: 0 }}
              >
                {entries.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ color: '#ccc', fontSize: '13px' }}>Belum ada file yang diunggah</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr style={{ borderBottom: '2.5px solid #111' }}>
                        <th style={{ width: '28px', padding: '6px 4px' }} />
                        <th style={{ width: '82px', padding: '6px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: '#666' }}>
                          No.
                        </th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: '#666' }}>
                          Judul
                        </th>
                        <th style={{ width: '90px', padding: '6px 8px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: '#666' }}>
                          Karakter
                        </th>
                        <th style={{ width: '28px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => (
                        <tr
                          key={entry.id}
                          draggable
                          onDragStart={() => handleRowDragStart(idx)}
                          onDragOver={(e) => handleRowDragOver(e, idx)}
                          onDragEnd={handleRowDragEnd}
                          style={{ borderBottom: '1.5px solid #eee', background: '#fff' }}
                        >
                          {/* Drag handle */}
                          <td style={{ padding: '5px 4px', textAlign: 'center', cursor: 'grab', color: '#ccc' }}>
                            <GripVertical size={14} />
                          </td>
                          {/* Chapter number */}
                          <td style={{ padding: '5px 8px' }}>
                            <input
                              type="number"
                              value={entry.number}
                              onChange={(e) => updateEntry(entry.id, 'number', parseInt(e.target.value) || 0)}
                              min={1}
                              style={{
                                width: '64px',
                                border: '2px solid #111',
                                padding: '3px 6px',
                                fontSize: '13px',
                                fontWeight: 700,
                                background: '#F8F3EA',
                                outline: 'none',
                              }}
                            />
                          </td>
                          {/* Title */}
                          <td style={{ padding: '5px 8px' }}>
                            <input
                              type="text"
                              value={entry.title}
                              onChange={(e) => updateEntry(entry.id, 'title', e.target.value)}
                              style={{
                                width: '100%',
                                border: '2px solid #111',
                                padding: '3px 8px',
                                fontSize: '13px',
                                background: '#F8F3EA',
                                outline: 'none',
                              }}
                            />
                          </td>
                          {/* Char count */}
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: '#999', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                            {entry.content.length.toLocaleString()}
                          </td>
                          {/* Delete */}
                          <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => removeEntry(entry.id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#FF3C3C', padding: '2px', display: 'flex', alignItems: 'center' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderTop: '2.5px solid #111', flexShrink: 0 }}
              >
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 600 }}>
                  {entries.length > 0 ? `${entries.length} file dipilih` : 'Belum ada file'}
                </span>
                <div className="flex gap-3">
                  <button onClick={onClose} disabled={bulkLoading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>
                    BATAL
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={!entries.length || bulkLoading}
                    className="neo-button"
                    style={{ opacity: entries.length && !bulkLoading ? 1 : 0.5 }}
                  >
                    {bulkLoading ? 'MEMBUAT...' : `TAMBAH ${entries.length} BAB`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
