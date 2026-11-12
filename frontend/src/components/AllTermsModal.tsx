import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { X, Search, AlertTriangle, Copy, Check } from 'lucide-react'
import type { Chapter, GlossaryEntry } from '../types'

interface TermRow {
  sourceTerm: string
  translatedTerm: string
  notes: string
  chapterLabel: string
  chapterNumber: number
  inGlossary: boolean
  isMain: boolean       // source + translation both match glossary = canonical
  isInconsistent: boolean
  /** Differs from the glossary only in the chapter's table — the text itself follows the glossary. */
  tableOnly: boolean
  /** Came from the fallback AI extraction (the model wrote no table), not from the model's own table. */
  extracted: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  chapters: Chapter[]
  seriesGlossary: GlossaryEntry[]
}

// An honorific does not make a different rendering: Hosono-san is Hosono.
const HONORIFIC_TAIL = /[-\s](san|kun|chan|sama|senpai|sensei|dono|nee|nii|tan|nim|ssi)\b/gi

function renderingKey(t: string): string {
  return (t ?? '').toLowerCase().replace(HONORIFIC_TAIL, '').replace(/\s+/g, ' ').trim()
}

/** The chapter's translated text without its trailing glossary table. */
function chapterText(ch: Chapter): string {
  return (ch.translatedContent ?? '').split('\n').filter(l => !l.trim().startsWith('|')).join('\n').toLowerCase()
}

/**
 * Source terms rendered more than one way IN THE TEXT. A table row whose rendering
 * never appears in its chapter is the table's (or the fallback extraction's)
 * mistake, not the translation's, so it does not count; neither does an honorific.
 */
export function inconsistentTermKeys(chapters: Chapter[], glossary: GlossaryEntry[] = []): Set<string> {
  const termMap = new Map<string, Set<string>>()
  const glossaryMap = new Map(glossary.map(e => [e.sourceTerm.trim().toLowerCase(), renderingKey(e.translatedTerm)]))
  for (const ch of chapters) {
    const text = chapterText(ch)
    for (const e of ch.glossaryUpdates?.entries ?? []) {
      const key = (e.sourceTerm ?? '').trim().toLowerCase()
      const t = (e.translatedTerm ?? '').trim()
      if (!key || !t || !text.includes(t.toLowerCase())) continue
      if (!termMap.has(key)) termMap.set(key, new Set(glossaryMap.has(key) ? [glossaryMap.get(key)!] : []))
      termMap.get(key)!.add(renderingKey(t))
    }
  }
  const keys = new Set<string>()
  for (const [k, renderings] of termMap) if (renderings.size > 1) keys.add(k)
  return keys
}

/** Returns count of source terms rendered 2+ ways in the translated text */
export function countInconsistencies(chapters: Chapter[], glossary: GlossaryEntry[] = []): number {
  return inconsistentTermKeys(chapters, glossary).size
}

function CopyCell({ text, style, bold }: { text: string; style?: React.CSSProperties; bold?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [text])

  return (
    <span
      onClick={copy}
      title="Click to copy"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        fontFamily: bold ? 'monospace' : undefined,
        fontWeight: bold ? 700 : undefined,
        ...style,
      }}
    >
      {text}
      {copied
        ? <Check size={11} style={{ color: 'var(--fg-green,#28E272)', flexShrink: 0 }} />
        : <Copy size={10} style={{ color: 'var(--fg-subtle,#bbb)', flexShrink: 0, opacity: 0 }} className="copy-icon" />
      }
    </span>
  )
}

export function AllTermsModal({ open, onClose, chapters, seriesGlossary }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'inconsistent' | 'main'>('all')
  const [collapseMain, setCollapseMain] = useState(false)
  const [sortBy, setSortBy] = useState<'chapter' | 'source'>('chapter')
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

  // Map: source (lower) → canonical rendering key from the series glossary
  const glossaryMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of seriesGlossary) {
      m.set(e.sourceTerm.trim().toLowerCase(), renderingKey(e.translatedTerm ?? ''))
    }
    return m
  }, [seriesGlossary])

  const inconsistentKeys = useMemo(() => inconsistentTermKeys(chapters, seriesGlossary), [chapters, seriesGlossary])

  const allRows = useMemo<TermRow[]>(() => {
    const rows: TermRow[] = []
    for (const ch of chapters) {
      const entries = ch.glossaryUpdates?.entries ?? []
      if (!entries.length) continue
      const label = ch.title
        ? `Ch ${ch.chapterNumber} — ${ch.title}`
        : `Chapter ${ch.chapterNumber}`
      const text = chapterText(ch)
      for (const e of entries) {
        const srcKey = (e.sourceTerm ?? '').trim().toLowerCase()
        const tKey = renderingKey(e.translatedTerm ?? '')
        const glossaryTranslation = glossaryMap.get(srcKey)
        const inGlossary = glossaryMap.has(srcKey)
        const isMain = inGlossary && glossaryTranslation === tKey
        const tableOnly = inGlossary && !isMain && !text.includes((e.translatedTerm ?? '').trim().toLowerCase())
        rows.push({
          sourceTerm: e.sourceTerm,
          translatedTerm: e.translatedTerm,
          notes: e.notes,
          chapterLabel: label,
          chapterNumber: Number(ch.chapterNumber),
          inGlossary,
          isMain,
          isInconsistent: inconsistentKeys.has(srcKey),
          tableOnly,
          extracted: (e as { origin?: string }).origin === 'extracted',
        })
      }
    }
    rows.sort((a, b) => a.chapterNumber - b.chapterNumber)
    return rows
  }, [chapters, glossaryMap, inconsistentKeys])

  const inconsistentCount = useMemo(
    () => new Set(allRows.filter(r => r.isInconsistent).map(r => r.sourceTerm.trim().toLowerCase())).size,
    [allRows]
  )

  const filtered = useMemo(() => {
    let base = allRows
    if (filter === 'inconsistent') base = allRows.filter(r => r.isInconsistent)
    else if (filter === 'main') base = allRows.filter(r => r.isMain)

    if (query.trim()) {
      const q = query.toLowerCase()
      base = base.filter(r =>
        r.sourceTerm.toLowerCase().includes(q) ||
        r.translatedTerm.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.chapterLabel.toLowerCase().includes(q)
      )
    }

    // Sort
    if (sortBy === 'source') {
      base = [...base].sort((a, b) =>
        a.sourceTerm.localeCompare(b.sourceTerm) || a.chapterNumber - b.chapterNumber
      )
    }

    // Collapse MAIN: keep only first occurrence per source term among MAIN rows
    if (collapseMain) {
      const seenMain = new Set<string>()
      base = base.filter(r => {
        if (!r.isMain) return true
        const key = r.sourceTerm.trim().toLowerCase()
        if (seenMain.has(key)) return false
        seenMain.add(key)
        return true
      })
    }

    return base
  }, [allRows, query, filter, sortBy, collapseMain])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`.copy-icon { transition: opacity 0.1s } tr:hover .copy-icon { opacity: 1 !important }`}</style>
      <div
        className="flex flex-col"
        style={{
          width: '900px',
          maxWidth: '96vw',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-page,#F8F3EA)',
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
            <span style={{ fontSize: '12px', color: 'var(--fg-muted,#888)', fontWeight: 600 }}>
              {filtered.length} / {allRows.length}
            </span>
            {inconsistentCount > 0 && (
              <span
                className="flex items-center gap-1"
                style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 800, backgroundColor: 'var(--bg-red,#FF3C3C)', color: '#fff', border: '2px solid #111', letterSpacing: '0.3px' }}
              >
                <AlertTriangle size={11} />
                {inconsistentCount} INCONSISTENC{inconsistentCount === 1 ? 'Y' : 'IES'}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-accent,#111)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Filter tabs + Search */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '2px solid var(--line,#eee)', flexShrink: 0 }}>
          <div className="flex" style={{ border: '2px solid #111', flexShrink: 0 }}>
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} color="#111">
              ALL ({allRows.length})
            </FilterBtn>
            <FilterBtn active={filter === 'main'} onClick={() => setFilter('main')} color="var(--fg-blue,#1565C0)" borderRight>
              ★ MAIN ({allRows.filter(r => r.isMain).length})
            </FilterBtn>
            <FilterBtn active={filter === 'inconsistent'} onClick={() => setFilter('inconsistent')} color="var(--fg-red,#FF3C3C)">
              <AlertTriangle size={10} style={{ display: 'inline', marginRight: 4 }} />
              INCONSISTENT ({inconsistentCount})
            </FilterBtn>
          </div>

          <div className="flex items-center gap-2 flex-1" style={{ border: '2px solid #111', backgroundColor: 'var(--bg-surface,#fff)', padding: '5px 10px' }}>
            <Search size={13} style={{ color: 'var(--fg-muted,#888)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search source term, translation, notes, or chapter..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: "'Inter', sans-serif" }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-subtle,#aaa)', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Options row: sort + collapse */}
        <div className="flex items-center gap-4 px-4 py-2" style={{ borderBottom: '1px solid var(--line,#eee)', flexShrink: 0, backgroundColor: 'var(--bg-surface,#fafaf8)' }}>
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--fg-muted,#888)' }}>Sort:</span>
            <div className="flex" style={{ border: '1.5px solid var(--line,#ccc)' }}>
              <button
                onClick={() => setSortBy('chapter')}
                style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: 'none', borderRight: '1.5px solid var(--line,#ccc)', cursor: 'pointer', backgroundColor: sortBy === 'chapter' ? '#111' : 'transparent', color: sortBy === 'chapter' ? '#fff' : 'var(--fg-muted,#666)' }}
              >
                By Chapter
              </button>
              <button
                onClick={() => setSortBy('source')}
                style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', backgroundColor: sortBy === 'source' ? '#111' : 'transparent', color: sortBy === 'source' ? '#fff' : 'var(--fg-muted,#666)' }}
              >
                By Source Term
              </button>
            </div>
          </div>

          {/* Collapse MAIN toggle */}
          <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: 'var(--fg-muted,#888)' }}>
              Collapse MAIN duplicates:
            </span>
            <button
              onClick={() => setCollapseMain(v => !v)}
              style={{
                padding: '3px 12px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                border: '1.5px solid',
                cursor: 'pointer',
                borderColor: collapseMain ? 'var(--fg-blue,#1565C0)' : 'var(--line,#ccc)',
                backgroundColor: collapseMain ? 'var(--bg-blue,#1565C0)' : 'transparent',
                color: collapseMain ? '#fff' : 'var(--fg-muted,#888)',
                letterSpacing: '0.3px',
              }}
            >
              {collapseMain ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-1.5" style={{ borderBottom: '1px solid var(--line,#eee)', flexShrink: 0, backgroundColor: 'var(--bg-surface,#fafaf8)' }}>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#888)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Status:</span>
          <span style={{ ...legendBadge, borderColor: 'var(--fg-blue,#1565C0)', backgroundColor: 'var(--tint-blue,#e8f0fe)', color: 'var(--fg-blue,#1565C0)' }}>★ MAIN</span>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#666)' }}>= source + translation match glossary (patokan)</span>
          <span style={{ ...legendBadge, borderColor: 'var(--fg-orange,#f59e0b)', backgroundColor: 'var(--tint-orange,#fffbeb)', color: 'var(--fg-orange,#b45309)' }}>MISMATCH</span>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#666)' }}>= source ada di glossary, tapi terjemahan beda</span>
          <span style={{ ...legendBadge, borderColor: 'var(--line,#ddd)', backgroundColor: 'transparent', color: 'var(--fg-subtle,#aaa)' }}>EXTRACTED</span>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#666)' }}>= belum masuk glossary</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              {filter === 'inconsistent' && inconsistentCount === 0 ? (
                <>
                  <span style={{ fontSize: '28px' }}>✓</span>
                  <p style={{ color: 'var(--fg-green,#28E272)', fontSize: '13px', fontWeight: 700 }}>No inconsistencies found!</p>
                </>
              ) : (
                <p style={{ color: 'var(--line,#ccc)', fontSize: '13px' }}>No terms found.</p>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-page,#F8F3EA)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2.5px solid #111' }}>
                  <th style={thStyle}>Source Term</th>
                  <th style={thStyle}>Translation</th>
                  <th style={{ ...thStyle, width: '26%' }}>Notes</th>
                  <th style={{ ...thStyle, width: '18%' }}>Chapter</th>
                  <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const bg = row.isInconsistent
                    ? (i % 2 === 0 ? 'var(--fg-red,#fff5f5)' : 'var(--fg-red,#ffeeee)')
                    : (i % 2 === 0 ? '#fff' : '#faf6ee')
                  const borderLeft = row.isInconsistent ? '3px solid var(--fg-red,#FF3C3C)' : '3px solid transparent'
                  const srcColor = row.isInconsistent ? 'var(--fg-red,#cc1111)' : '#111'
                  const badge = statusBadge(row)

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #e8e3da', backgroundColor: bg, borderLeft }}>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-1.5">
                          {row.isInconsistent && <span title="Inconsistent"><AlertTriangle size={11} style={{ color: 'var(--fg-red,#FF3C3C)', flexShrink: 0 }} /></span>}
                          <CopyCell text={row.sourceTerm} bold style={{ color: srcColor }} />
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <CopyCell text={row.translatedTerm} style={{ color: srcColor }} />
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--fg-muted,#888)' }}>{row.notes}</td>
                      <td style={{ ...tdStyle, color: 'var(--fg-muted,#666)', fontSize: '11px' }}>{row.chapterLabel}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={badge.style}>{badge.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {inconsistentCount > 0 && (
          <div className="flex items-center gap-2 px-5 py-2" style={{ borderTop: '2px solid var(--line,#eee)', flexShrink: 0, backgroundColor: 'var(--tint-red,#fff8f8)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--fg-red,#FF3C3C)' }} />
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#888)' }}>
              Filter <strong>MAIN</strong> untuk lihat mana yang jadi patokan, lalu fix inkonsistensi dengan update glossary series.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterBtn({ active, onClick, color, children, borderRight }: {
  active: boolean; onClick: () => void; color: string; children: React.ReactNode; borderRight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        border: 'none',
        borderRight: borderRight ? '2px solid #111' : undefined,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: active ? color : 'transparent',
        color: active ? '#fff' : color === 'var(--on-accent,#111)' ? 'var(--fg-muted,#555)' : color,
      }}
    >
      {children}
    </button>
  )
}

function statusBadge(row: TermRow): { label: string; style: React.CSSProperties } {
  if (row.isMain) return {
    label: '★ MAIN',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', border: '1.5px solid var(--fg-blue,#1565C0)', backgroundColor: 'var(--tint-blue,#e8f0fe)', color: 'var(--fg-blue,#1565C0)' },
  }
  if (row.tableOnly) return {
    label: 'HANYA TABEL',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', border: '1.5px solid var(--fg-subtle,#bbb)', backgroundColor: 'transparent', color: 'var(--fg-muted,#888)' },
  }
  if (row.inGlossary) return {
    label: 'MISMATCH',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', border: '1.5px solid var(--fg-orange,#f59e0b)', backgroundColor: 'var(--tint-orange,#fffbeb)', color: 'var(--fg-orange,#b45309)' },
  }
  return {
    label: 'EXTRACTED',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', border: '1.5px solid var(--line,#ddd)', backgroundColor: 'transparent', color: 'var(--fg-subtle,#aaa)' },
  }
}

const legendBadge: React.CSSProperties = {
  display: 'inline-block', padding: '1px 5px', fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.3px', border: '1.5px solid',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: '11px',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--fg-muted,#555)',
}

const tdStyle: React.CSSProperties = {
  padding: '7px 12px', verticalAlign: 'top',
}
