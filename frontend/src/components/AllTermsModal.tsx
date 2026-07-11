import { useMemo, useState, useRef, useEffect } from 'react'
import { X, Search, AlertTriangle } from 'lucide-react'
import type { Chapter, GlossaryEntry } from '../types'

interface TermRow {
  sourceTerm: string
  translatedTerm: string
  notes: string
  chapterLabel: string
  chapterNumber: number
  inGlossary: boolean
  isInconsistent: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  chapters: Chapter[]
  seriesGlossary: GlossaryEntry[]
}

/** Returns count of source terms that have 2+ distinct translations across all chapters */
export function countInconsistencies(chapters: Chapter[]): number {
  const termMap = new Map<string, Set<string>>()
  for (const ch of chapters) {
    for (const e of ch.glossaryUpdates?.entries ?? []) {
      const key = (e.sourceTerm ?? '').trim().toLowerCase()
      if (!key) continue
      if (!termMap.has(key)) termMap.set(key, new Set())
      const t = (e.translatedTerm ?? '').trim().toLowerCase()
      if (t) termMap.get(key)!.add(t)
    }
  }
  let count = 0
  for (const [, translations] of termMap) {
    if (translations.size > 1) count++
  }
  return count
}

export function AllTermsModal({ open, onClose, chapters, seriesGlossary }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'inconsistent'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const glossarySet = useMemo(
    () => new Set(seriesGlossary.map(e => e.sourceTerm.trim().toLowerCase())),
    [seriesGlossary]
  )

  // Build set of source terms that have 2+ distinct translations
  const inconsistentKeys = useMemo(() => {
    const termMap = new Map<string, Set<string>>()
    for (const ch of chapters) {
      for (const e of ch.glossaryUpdates?.entries ?? []) {
        const key = (e.sourceTerm ?? '').trim().toLowerCase()
        if (!key) continue
        if (!termMap.has(key)) termMap.set(key, new Set())
        const t = (e.translatedTerm ?? '').trim().toLowerCase()
        if (t) termMap.get(key)!.add(t)
      }
    }
    const keys = new Set<string>()
    for (const [k, translations] of termMap) {
      if (translations.size > 1) keys.add(k)
    }
    return keys
  }, [chapters])

  const allRows = useMemo<TermRow[]>(() => {
    const rows: TermRow[] = []
    for (const ch of chapters) {
      const entries = ch.glossaryUpdates?.entries ?? []
      if (!entries.length) continue
      const label = ch.title
        ? `Ch ${ch.chapterNumber} — ${ch.title}`
        : `Chapter ${ch.chapterNumber}`
      for (const e of entries) {
        const key = (e.sourceTerm ?? '').trim().toLowerCase()
        rows.push({
          sourceTerm: e.sourceTerm,
          translatedTerm: e.translatedTerm,
          notes: e.notes,
          chapterLabel: label,
          chapterNumber: Number(ch.chapterNumber),
          inGlossary: glossarySet.has(key),
          isInconsistent: inconsistentKeys.has(key),
        })
      }
    }
    rows.sort((a, b) => a.chapterNumber - b.chapterNumber)
    return rows
  }, [chapters, glossarySet, inconsistentKeys])

  const inconsistentCount = useMemo(
    () => new Set(allRows.filter(r => r.isInconsistent).map(r => r.sourceTerm.trim().toLowerCase())).size,
    [allRows]
  )

  const filtered = useMemo(() => {
    let base = filter === 'inconsistent' ? allRows.filter(r => r.isInconsistent) : allRows
    if (!query.trim()) return base
    const q = query.toLowerCase()
    return base.filter(r =>
      r.sourceTerm.toLowerCase().includes(q) ||
      r.translatedTerm.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q) ||
      r.chapterLabel.toLowerCase().includes(q)
    )
  }, [allRows, query, filter])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col"
        style={{
          width: '860px',
          maxWidth: '95vw',
          maxHeight: '88vh',
          backgroundColor: '#F8F3EA',
          border: '3px solid #111',
          boxShadow: '6px 6px 0px #111',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '2.5px solid #111', flexShrink: 0 }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ALL EXTRACTED TERMS
            </span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>
              {filtered.length} / {allRows.length}
            </span>
            {inconsistentCount > 0 && (
              <span
                className="flex items-center gap-1"
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: '#FF3C3C',
                  color: '#fff',
                  border: '2px solid #111',
                  letterSpacing: '0.3px',
                }}
              >
                <AlertTriangle size={11} />
                {inconsistentCount} INCONSISTENC{inconsistentCount === 1 ? 'Y' : 'IES'}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#111' }}>
            <X size={18} />
          </button>
        </div>

        {/* Filter tabs + Search */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '2px solid #eee', flexShrink: 0 }}>
          {/* Filter buttons */}
          <div className="flex" style={{ border: '2px solid #111', flexShrink: 0 }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filter === 'all' ? '#111' : 'transparent',
                color: filter === 'all' ? '#fff' : '#555',
                borderRight: '2px solid #111',
              }}
            >
              ALL ({allRows.length})
            </button>
            <button
              onClick={() => setFilter('inconsistent')}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: filter === 'inconsistent' ? '#FF3C3C' : 'transparent',
                color: filter === 'inconsistent' ? '#fff' : inconsistentCount > 0 ? '#FF3C3C' : '#aaa',
              }}
            >
              <AlertTriangle size={11} />
              INCONSISTENT ({inconsistentCount})
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1" style={{ border: '2px solid #111', backgroundColor: '#fff', padding: '5px 10px' }}>
            <Search size={13} style={{ color: '#888', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search source term, translation, notes, or chapter..."
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: '13px', fontFamily: "'Inter', sans-serif",
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#aaa', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              {filter === 'inconsistent' && inconsistentCount === 0 ? (
                <>
                  <span style={{ fontSize: '28px' }}>✓</span>
                  <p style={{ color: '#28E272', fontSize: '13px', fontWeight: 700 }}>No inconsistencies found!</p>
                </>
              ) : (
                <p style={{ color: '#ccc', fontSize: '13px' }}>No terms found.</p>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F8F3EA', zIndex: 1 }}>
                <tr style={{ borderBottom: '2.5px solid #111' }}>
                  <th style={thStyle}>Source Term</th>
                  <th style={thStyle}>Translation</th>
                  <th style={{ ...thStyle, width: '28%' }}>Notes</th>
                  <th style={{ ...thStyle, width: '20%' }}>Chapter</th>
                  <th style={{ ...thStyle, width: '95px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #e8e3da',
                      backgroundColor: row.isInconsistent
                        ? (i % 2 === 0 ? '#fff5f5' : '#ffeeee')
                        : (i % 2 === 0 ? '#fff' : '#faf6ee'),
                      borderLeft: row.isInconsistent ? '3px solid #FF3C3C' : '3px solid transparent',
                    }}
                  >
                    <td style={tdStyle}>
                      <div className="flex items-center gap-1.5">
                        {row.isInconsistent && (
                          <span title="Inconsistent translation across chapters">
                            <AlertTriangle size={12} style={{ color: '#FF3C3C', flexShrink: 0 }} />
                          </span>
                        )}
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: row.isInconsistent ? '#cc1111' : '#111' }}>
                          {row.sourceTerm}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: row.isInconsistent ? '#cc1111' : '#111' }}>
                      {row.translatedTerm}
                    </td>
                    <td style={{ ...tdStyle, color: '#888' }}>{row.notes}</td>
                    <td style={{ ...tdStyle, color: '#666', fontSize: '11px' }}>{row.chapterLabel}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        border: '1.5px solid',
                        borderColor: row.inGlossary ? '#28E272' : '#ddd',
                        backgroundColor: row.inGlossary ? '#e6fff0' : 'transparent',
                        color: row.inGlossary ? '#1a8a4a' : '#aaa',
                      }}>
                        {row.inGlossary ? 'In Glossary' : 'Extracted'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer hint */}
        {inconsistentCount > 0 && (
          <div
            className="flex items-center gap-2 px-5 py-2"
            style={{ borderTop: '2px solid #eee', flexShrink: 0, backgroundColor: '#fff8f8' }}
          >
            <AlertTriangle size={12} style={{ color: '#FF3C3C' }} />
            <span style={{ fontSize: '11px', color: '#888' }}>
              Inconsistency = same source term with different translations across chapters. Fix by updating your series glossary.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: '#555',
}

const tdStyle: React.CSSProperties = {
  padding: '7px 12px',
  verticalAlign: 'top',
}
