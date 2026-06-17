/**
 * LWNTL Create Chapter Modal - Single, Bulk TXT, Bulk Docx/PDF
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DragEvent } from 'react'
import { Plus, X, Upload, GripVertical, Trash2, Eye, Loader2, AlertCircle, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { useI18n } from '../i18n'
import { parseDocument } from '../api'
import { MarkdownRenderer } from './MarkdownRenderer'

// ── Types ────────────────────────────────────────────────────────────────────

interface BulkEntry {
  id: string
  filename: string
  number: string
  title: string
  content: string
}

interface DocEntry {
  id: string
  filename: string
  number: string
  title: string
  content: string
  parsing: boolean
  error: string | null
}

interface CreateChapterModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (number: string, title: string, rawContent: string) => void
  onBulkSubmit: (chapters: { number: string; title: string; rawContent: string }[]) => Promise<void>
  nextChapterNumber: string
  loading?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip "data:...;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateChapterModal({
  open, onClose, onSubmit, onBulkSubmit, nextChapterNumber, loading,
}: CreateChapterModalProps) {
  const { t: tx } = useI18n()
  const [tab, setTab] = useState<'single' | 'bulk' | 'pdf1' | 'pdf2' | 'docx'>('single')

  // Single tab
  const [number, setNumber] = useState<string>(nextChapterNumber)
  const [title, setTitle] = useState('')
  const [rawContent, setRawContent] = useState('')

  // Bulk TXT tab
  const [entries, setEntries] = useState<BulkEntry[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bulk Doc/PDF tab
  const [docEntries, setDocEntries] = useState<DocEntry[]>([])
  const [docIsDragOver, setDocIsDragOver] = useState(false)
  const [docBulkLoading, setDocBulkLoading] = useState(false)
  const docFileInputRef = useRef<HTMLInputElement>(null)
  const docDragIndexRef = useRef<number | null>(null)
  const [previewEntry, setPreviewEntry] = useState<DocEntry | null>(null)

  // Preview search state
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIdx, setMatchIdx] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const previewContentRef = useRef<HTMLDivElement>(null)
  const previewSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setNumber(nextChapterNumber)
      setTitle('')
      setRawContent('')
      setEntries([])
      setDocEntries([])
      setTab('single')
      setIsDragOver(false)
      setDocIsDragOver(false)
      setPreviewEntry(null)
    }
  }, [open, nextChapterNumber])

  // Reset search when preview entry changes
  useEffect(() => {
    setSearchQuery('')
    setMatchCount(0)
    setMatchIdx(0)
  }, [previewEntry?.id])

  // Highlight matching text in the preview DOM
  useEffect(() => {
    const container = previewContentRef.current
    if (!container) return

    // Remove old highlights
    container.querySelectorAll('mark[data-search]').forEach(m => {
      const parent = m.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m)
        parent.normalize()
      }
    })

    if (!searchQuery.trim()) {
      setMatchCount(0)
      setMatchIdx(0)
      return
    }

    const lq = searchQuery.toLowerCase()
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)

    let count = 0
    textNodes.forEach(textNode => {
      const text = textNode.textContent || ''
      const lower = text.toLowerCase()
      if (!lower.includes(lq)) return
      const parts: Node[] = []
      let pos = 0
      let idx = lower.indexOf(lq, pos)
      while (idx !== -1) {
        if (idx > pos) parts.push(document.createTextNode(text.slice(pos, idx)))
        const mark = document.createElement('mark')
        mark.setAttribute('data-search', String(count++))
        mark.textContent = text.slice(idx, idx + lq.length)
        mark.style.cssText = 'background:#FFE066;border-radius:2px;outline:1px solid #FFAA00;'
        parts.push(mark)
        pos = idx + lq.length
        idx = lower.indexOf(lq, pos)
      }
      if (pos < text.length) parts.push(document.createTextNode(text.slice(pos)))
      const parent = textNode.parentNode
      if (parent) {
        const frag = document.createDocumentFragment()
        parts.forEach(p => frag.appendChild(p))
        parent.replaceChild(frag, textNode)
      }
    })

    setMatchCount(count)
    setMatchIdx(count > 0 ? 1 : 0)
  }, [searchQuery, previewEntry])

  // Scroll to active match
  useEffect(() => {
    const container = previewContentRef.current
    if (!container || matchIdx === 0 || matchCount === 0) return
    const marks = container.querySelectorAll('mark[data-search]')
    marks.forEach((m, i) => {
      (m as HTMLElement).style.background = i === matchIdx - 1 ? '#FF9900' : '#FFE066'
    })
    const target = marks[matchIdx - 1] as HTMLElement
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [matchIdx, matchCount])

  const goNext = useCallback(() => setMatchIdx(i => matchCount > 0 ? (i % matchCount) + 1 : 0), [matchCount])
  const goPrev = useCallback(() => setMatchIdx(i => matchCount > 0 ? ((i - 2 + matchCount) % matchCount) + 1 : 0), [matchCount])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewEntry) { setPreviewEntry(null); return }
        onClose()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && previewEntry) {
        e.preventDefault()
        previewSearchRef.current?.focus()
        previewSearchRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, previewEntry])

  if (!open) return null

  // ── Single tab ────────────────────────────────────────────────────────────

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!number) return
    onSubmit(number, title.trim(), rawContent)
  }

  // ── Bulk TXT tab ──────────────────────────────────────────────────────────

  const processTxtFiles = (files: File[]) => {
    const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'))
    if (!txtFiles.length) return
    const readers = txtFiles.map(file =>
      new Promise<Omit<BulkEntry, 'number'>>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            filename: file.name,
            title: file.name.replace(/\.txt$/i, ''),
            content: (ev.target?.result as string) || '',
          })
        }
        reader.readAsText(file, 'utf-8')
      })
    )
    Promise.all(readers).then(newEntries => {
      setEntries(prev => [
        ...prev,
        ...newEntries.map((e, i) => ({
          ...e,
          number: String(parseFloat(nextChapterNumber || '1') + prev.length + i),
        })),
      ])
    })
  }

  const handleBulkSubmit = async () => {
    if (!entries.length) return
    setBulkLoading(true)
    try {
      await onBulkSubmit(entries.map(e => ({ number: e.number, title: e.title, rawContent: e.content })))
    } finally {
      setBulkLoading(false)
    }
  }

  // drag-to-reorder (shared logic, parameterised by setter + ref)
  const makeRowHandlers = <T,>(
    index: number,
    ref: React.MutableRefObject<number | null>,
    setter: React.Dispatch<React.SetStateAction<T[]>>,
  ) => ({
    draggable: true as const,
    onDragStart: () => { ref.current = index },
    onDragOver: (e: DragEvent<HTMLTableRowElement>) => {
      e.preventDefault()
      const from = ref.current
      if (from === null || from === index) return
      setter(prev => {
        const arr = [...prev]
        const [item] = arr.splice(from, 1)
        arr.splice(index, 0, item)
        ref.current = index
        return arr
      })
    },
    onDragEnd: () => { ref.current = null },
  })

  // ── Bulk Doc/PDF/Docx tabs ────────────────────────────────────────────────

  // Derive parse mode and accepted extensions from active tab
  const docAccept = tab === 'docx' ? '.docx' : '.pdf'
  const docParseMode = tab === 'pdf2' ? 'flow' : 'standard'

  const switchDocTab = (newTab: 'pdf1' | 'pdf2' | 'docx') => {
    setDocEntries([])
    setDocIsDragOver(false)
    setTab(newTab)
  }

  const processDocFiles = async (files: File[]) => {
    const ext = docAccept
    const supported = files.filter(f => f.name.toLowerCase().endsWith(ext))
    if (!supported.length) return

    // Add placeholder entries immediately so the user sees progress
    const placeholders: DocEntry[] = supported.map((f, i) => ({
      id: `doc-${Date.now()}-${i}-${Math.random()}`,
      filename: f.name,
      number: String(parseFloat(nextChapterNumber || '1') + docEntries.length + i),
      title: f.name.replace(/\.(docx|pdf)$/i, ''),
      content: '',
      parsing: true,
      error: null,
    }))

    setDocEntries(prev => [...prev, ...placeholders])

    // Parse sequentially
    const mode = docParseMode
    for (let i = 0; i < supported.length; i++) {
      const file = supported[i]
      const placeholder = placeholders[i]
      try {
        const b64 = await fileToBase64(file)
        const result = await parseDocument(file.name, b64, mode)
        setDocEntries(prev => prev.map(e =>
          e.id === placeholder.id
            ? { ...e, parsing: false, title: result.title, content: result.content }
            : e
        ))
      } catch (err: any) {
        setDocEntries(prev => prev.map(e =>
          e.id === placeholder.id
            ? { ...e, parsing: false, error: err.message || 'Parse failed' }
            : e
        ))
      }
    }
  }

  const handleDocBulkSubmit = async () => {
    const ready = docEntries.filter(e => !e.parsing && !e.error && e.content)
    if (!ready.length) return
    setDocBulkLoading(true)
    try {
      await onBulkSubmit(ready.map(e => ({ number: e.number, title: e.title, rawContent: e.content })))
    } finally {
      setDocBulkLoading(false)
    }
  }

  const removeDocEntry = (id: string) => setDocEntries(prev => prev.filter(e => e.id !== id))
  const updateDocEntry = (id: string, field: 'number' | 'title', value: string) =>
    setDocEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))

  const docReadyCount = docEntries.filter(e => !e.parsing && !e.error && e.content).length
  const docParsingCount = docEntries.filter(e => e.parsing).length

  // ── Shared table styles ───────────────────────────────────────────────────

  const thStyle: React.CSSProperties = {
    padding: '6px 8px', textAlign: 'left', fontWeight: 700,
    textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: '#666',
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="neo-modal-backdrop">
      {/* Preview overlay */}
      {previewEntry && (
        <div
          className="neo-modal-backdrop"
          style={{ zIndex: 60 }}
          onClick={() => setPreviewEntry(null)}
        >
          <div
            className="neo-modal"
            style={{ width: '60%', maxWidth: 'none', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Preview header */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '2.5px solid #111', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto', minWidth: 0 }}>
                Preview — {previewEntry.filename}
              </span>

              {/* Search bar */}
              <div className="flex items-center gap-1" style={{ flex: '1 1 0', minWidth: 0, maxWidth: '340px', marginLeft: 'auto' }}>
                <div className="flex items-center" style={{ border: '2px solid #111', background: '#fff', flex: 1, minWidth: 0 }}>
                  <Search size={13} style={{ marginLeft: '7px', color: '#888', flexShrink: 0 }} />
                  <input
                    ref={previewSearchRef}
                    type="text"
                    placeholder="Cari... (Ctrl+F)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
                      if (e.key === 'Escape') { setSearchQuery(''); e.stopPropagation() }
                    }}
                    style={{
                      border: 'none', outline: 'none', padding: '4px 6px',
                      fontSize: '12px', width: '100%', background: 'transparent',
                    }}
                  />
                  {matchCount > 0 && (
                    <span style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap', paddingRight: '6px', fontVariantNumeric: 'tabular-nums' }}>
                      {matchIdx}/{matchCount}
                    </span>
                  )}
                  {searchQuery && matchCount === 0 && (
                    <span style={{ fontSize: '11px', color: '#FF3C3C', whiteSpace: 'nowrap', paddingRight: '6px' }}>0</span>
                  )}
                </div>
                <button
                  onClick={goPrev} disabled={matchCount === 0}
                  style={{ border: '2px solid #111', background: '#fff', cursor: matchCount > 0 ? 'pointer' : 'default', padding: '3px 4px', display: 'flex', opacity: matchCount > 0 ? 1 : 0.35, flexShrink: 0 }}>
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={goNext} disabled={matchCount === 0}
                  style={{ border: '2px solid #111', background: '#fff', cursor: matchCount > 0 ? 'pointer' : 'default', padding: '3px 4px', display: 'flex', opacity: matchCount > 0 ? 1 : 0.35, flexShrink: 0 }}>
                  <ChevronDown size={13} />
                </button>
              </div>

              <button onClick={() => setPreviewEntry(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, marginLeft: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4" ref={previewContentRef}>
              <MarkdownRenderer content={previewEntry.content} />
            </div>
          </div>
        </div>
      )}

      <div
        className="neo-modal"
        style={{ width: '50%', maxWidth: 'none', height: '90vh', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '2.5px solid #111', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <Plus size={20} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px' }}>
              {tx.chapter.addChapter.replace('+ ', '')}
            </h2>
          </div>
          <button onClick={onClose} className="hover:opacity-70" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '2.5px solid #111', flexShrink: 0 }}>
          {([
            ['single', 'Single'],
            ['bulk',   'Bulk TXT'],
            ['pdf1',   'PDF'],
            ['pdf2',   'PDF ↵'],
            ['docx',   'Docx'],
          ] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => {
                if (tabKey === 'pdf1' || tabKey === 'pdf2' || tabKey === 'docx') {
                  switchDocTab(tabKey)
                } else {
                  setTab(tabKey)
                }
              }}
              style={{
                padding: '10px 16px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                border: 'none', borderRight: '2px solid #eee',
                cursor: 'pointer',
                background: tab === tabKey ? '#00F7FF' : 'transparent',
                color: '#111', transition: 'background 0.1s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>

          {/* ── SINGLE ── */}
          {tab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex gap-4">
                  <div style={{ width: '130px' }}>
                    <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {tx.modal.chapterNumber}
                    </label>
                    <input type="text" value={number} onChange={e => setNumber(e.target.value)} className="neo-input" placeholder="1" />
                  </div>
                  <div className="flex-1">
                    <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {tx.modal.chapterTitle}
                    </label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={tx.modal.chapterTitlePlaceholder} className="neo-input" />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {tx.modal.chapterContent}
                  </label>
                  <textarea
                    value={rawContent} onChange={e => setRawContent(e.target.value)}
                    placeholder={tx.modal.chapterContentPlaceholder}
                    className="neo-textarea"
                    style={{ minHeight: '360px', fontFamily: 'monospace', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '2.5px solid #111', flexShrink: 0 }}>
                <button type="button" onClick={onClose} disabled={loading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>
                  {tx.common.cancel}
                </button>
                <button type="submit" disabled={!number || loading} className="neo-button" style={{ opacity: number && !loading ? 1 : 0.5 }}>
                  {loading ? tx.common.loading : tx.modal.create}
                </button>
              </div>
            </form>
          )}

          {/* ── BULK TXT ── */}
          {tab === 'bulk' && (
            <div className="flex flex-col h-full">
              <div className="px-6 pt-5 pb-4" style={{ flexShrink: 0 }}>
                <div
                  className="flex flex-col items-center justify-center gap-2"
                  style={{
                    border: `2.5px dashed ${isDragOver ? '#00F7FF' : '#aaa'}`,
                    background: isDragOver ? '#e6fffe' : '#fafaf8',
                    padding: '28px 20px', cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: isDragOver ? '4px 4px 0px #00F7FF' : 'none',
                  }}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files) processTxtFiles(Array.from(e.dataTransfer.files)) }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={28} style={{ color: isDragOver ? '#00a8ad' : '#aaa' }} />
                  <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: isDragOver ? '#111' : '#666' }}>
                    {isDragOver ? '↓' : 'Drag & drop .txt'}
                  </p>
                  <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>.txt</p>
                  <input ref={fileInputRef} type="file" accept=".txt" multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) { processTxtFiles(Array.from(e.target.files)); e.target.value = '' } }} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6" style={{ minHeight: 0 }}>
                {entries.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ color: '#ccc', fontSize: '13px' }}>{tx.common.noData}</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr style={{ borderBottom: '2.5px solid #111' }}>
                        <th style={{ width: '28px', padding: '6px 4px' }} />
                        <th style={{ width: '82px', ...thStyle }}>No.</th>
                        <th style={{ ...thStyle }}>Judul</th>
                        <th style={{ width: '90px', ...thStyle, textAlign: 'right' }}>Karakter</th>
                        <th style={{ width: '28px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => (
                        <tr key={entry.id} {...makeRowHandlers(idx, dragIndexRef, setEntries)}
                          style={{ borderBottom: '1.5px solid #eee', background: '#fff' }}>
                          <td style={{ padding: '5px 4px', textAlign: 'center', cursor: 'grab', color: '#ccc' }}>
                            <GripVertical size={14} />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input type="text" value={entry.number}
                              onChange={e => setEntries(prev => prev.map(en => en.id === entry.id ? { ...en, number: e.target.value } : en))}
                              style={{ width: '64px', border: '2px solid #111', padding: '3px 6px', fontSize: '13px', fontWeight: 700, background: '#F8F3EA', outline: 'none' }} />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input type="text" value={entry.title}
                              onChange={e => setEntries(prev => prev.map(en => en.id === entry.id ? { ...en, title: e.target.value } : en))}
                              style={{ width: '100%', border: '2px solid #111', padding: '3px 8px', fontSize: '13px', background: '#F8F3EA', outline: 'none' }} />
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: '#999', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                            {entry.content.length.toLocaleString()}
                          </td>
                          <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                            <button onClick={() => setEntries(prev => prev.filter(e => e.id !== entry.id))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#FF3C3C', padding: '2px', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '2.5px solid #111', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 600 }}>
                  {entries.length > 0 ? `${entries.length}` : tx.common.noData}
                </span>
                <div className="flex gap-3">
                  <button onClick={onClose} disabled={bulkLoading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>{tx.common.cancel}</button>
                  <button onClick={handleBulkSubmit} disabled={!entries.length || bulkLoading} className="neo-button" style={{ opacity: entries.length && !bulkLoading ? 1 : 0.5 }}>
                    {bulkLoading ? tx.common.loading : `${tx.common.add} ${entries.length}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PDF 1 / PDF 2 / DOCX ── */}
          {(tab === 'pdf1' || tab === 'pdf2' || tab === 'docx') && (
            <div className="flex flex-col h-full">
              {/* Drop zone */}
              <div className="px-6 pt-5 pb-4" style={{ flexShrink: 0 }}>
                <div
                  className="flex flex-col items-center justify-center gap-2"
                  style={{
                    border: `2.5px dashed ${docIsDragOver ? '#FF8C00' : '#aaa'}`,
                    background: docIsDragOver ? '#fff8ed' : '#fafaf8',
                    padding: '28px 20px', cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: docIsDragOver ? '4px 4px 0px #FF8C00' : 'none',
                  }}
                  onDragOver={e => { e.preventDefault(); setDocIsDragOver(true) }}
                  onDragLeave={() => setDocIsDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDocIsDragOver(false); if (e.dataTransfer.files) processDocFiles(Array.from(e.dataTransfer.files)) }}
                  onClick={() => docFileInputRef.current?.click()}
                >
                  <Upload size={28} style={{ color: docIsDragOver ? '#FF8C00' : '#aaa' }} />
                  <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: docIsDragOver ? '#111' : '#666' }}>
                    {docIsDragOver ? '↓' : `Drag & drop ${docAccept}`}
                  </p>
                  <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>
                    {tab === 'pdf2' ? `${docAccept} — paragraph reconstruction` : docAccept}
                  </p>
                  <input ref={docFileInputRef} type="file" accept={docAccept} multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) { processDocFiles(Array.from(e.target.files)); e.target.value = '' } }} />
                </div>

                {docParsingCount > 0 && (
                  <div className="flex items-center gap-2 mt-2 px-1" style={{ fontSize: '12px', color: '#666' }}>
                    <Loader2 size={13} className="animate-spin" />
                    Parsing {docParsingCount} file{docParsingCount > 1 ? 's' : ''}...
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto px-6" style={{ minHeight: 0 }}>
                {docEntries.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p style={{ color: '#ccc', fontSize: '13px' }}>{tx.common.noData}</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr style={{ borderBottom: '2.5px solid #111' }}>
                        <th style={{ width: '28px', padding: '6px 4px' }} />
                        <th style={{ width: '82px', ...thStyle }}>No.</th>
                        <th style={{ ...thStyle }}>Judul</th>
                        <th style={{ width: '90px', ...thStyle, textAlign: 'right' }}>Karakter</th>
                        <th style={{ width: '36px', ...thStyle, textAlign: 'center' }}>Preview</th>
                        <th style={{ width: '28px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {docEntries.map((entry, idx) => (
                        <tr key={entry.id}
                          {...(!entry.parsing ? makeRowHandlers(idx, docDragIndexRef, setDocEntries) : {})}
                          style={{ borderBottom: '1.5px solid #eee', background: entry.error ? '#fff5f5' : '#fff' }}>
                          <td style={{ padding: '5px 4px', textAlign: 'center', cursor: entry.parsing ? 'default' : 'grab', color: '#ccc' }}>
                            {entry.parsing ? <Loader2 size={13} className="animate-spin" style={{ color: '#aaa' }} /> : <GripVertical size={14} />}
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input type="text" value={entry.number} disabled={entry.parsing}
                              onChange={e => updateDocEntry(entry.id, 'number', e.target.value)}
                              style={{ width: '64px', border: '2px solid #111', padding: '3px 6px', fontSize: '13px', fontWeight: 700, background: entry.parsing ? '#eee' : '#F8F3EA', outline: 'none' }} />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            {entry.error ? (
                              <div className="flex items-center gap-1" style={{ color: '#FF3C3C', fontSize: '12px' }}>
                                <AlertCircle size={13} />
                                <span title={entry.error}>{entry.filename} — {entry.error.slice(0, 60)}</span>
                              </div>
                            ) : (
                              <input type="text" value={entry.title} disabled={entry.parsing}
                                onChange={e => updateDocEntry(entry.id, 'title', e.target.value)}
                                style={{ width: '100%', border: '2px solid #111', padding: '3px 8px', fontSize: '13px', background: entry.parsing ? '#eee' : '#F8F3EA', outline: 'none' }} />
                            )}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: '#999', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                            {entry.parsing ? '…' : entry.content.length.toLocaleString()}
                          </td>
                          <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                            {!entry.parsing && !entry.error && entry.content && (
                              <button
                                onClick={() => setPreviewEntry(entry)}
                                title="Preview hasil parsing"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#0077FF', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Eye size={14} />
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                            <button onClick={() => removeDocEntry(entry.id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#FF3C3C', padding: '2px', display: 'flex', alignItems: 'center' }}>
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
              <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '2.5px solid #111', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', color: '#666', fontWeight: 600 }}>
                  {docEntries.length > 0
                    ? `${docReadyCount} siap${docParsingCount > 0 ? `, ${docParsingCount} parsing...` : ''}`
                    : tx.common.noData}
                </span>
                <div className="flex gap-3">
                  <button onClick={onClose} disabled={docBulkLoading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>{tx.common.cancel}</button>
                  <button
                    onClick={handleDocBulkSubmit}
                    disabled={!docReadyCount || docBulkLoading || docParsingCount > 0}
                    className="neo-button"
                    style={{ opacity: docReadyCount && !docBulkLoading && !docParsingCount ? 1 : 0.5, backgroundColor: '#FFCF77' }}
                  >
                    {docBulkLoading ? tx.common.loading : `${tx.common.add} ${docReadyCount}`}
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
