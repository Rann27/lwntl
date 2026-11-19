import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { X, Search, AlertTriangle, Copy, Check, Loader2, Undo2 } from 'lucide-react'
import type { Chapter, GlossaryEntry } from '../types'
import { unifyTermVariants, acceptTermVariants } from '../api'
import { useToast } from '../hooks/useToast'

interface TermRow {
  sourceTerm: string
  translatedTerm: string
  notes: string
  chapterLabel: string
  chapterNumber: number
  inGlossary: boolean
  isMain: boolean       // source + translation both match glossary = canonical
  isInconsistent: boolean
  /** Differs from the glossary only in the chapter's table: the text itself follows the glossary. */
  tableOnly: boolean
  /** Came from the fallback AI extraction (the model wrote no table), not from the model's own table. */
  extracted: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  chapters: Chapter[]
  seriesGlossary: GlossaryEntry[]
  seriesId: string
  /** Renderings the user marked as intended, per source term (lowercase). */
  accepted?: Record<string, string[]>
  /** Called after a unify/accept so the page reloads chapters, glossary and series. */
  onChanged: () => Promise<void> | void
}

// An honorific does not make a different rendering: Hosono-san is Hosono.
const HONORIFIC_TAIL = /[-\s](san|kun|chan|sama|senpai|sensei|dono|nee|nii|tan|nim|ssi)\b/gi

/**
 * Typography never makes a different rendering: full-width forms, curly vs
 * straight apostrophes and quotes, and dash styles are folded together, so
 * "Hero’s Party" and "Hero's Party" are the same.
 */
function normText(t: string): string {
  return (t ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC`]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
}

function renderingKey(t: string): string {
  return normText(t).replace(HONORIFIC_TAIL, '').trim()
}

/** The chapter's translated text without its trailing glossary table, normalised like renderingKey. */
function chapterText(ch: Chapter): string {
  return normText((ch.translatedContent ?? '').split('\n').filter(l => !l.trim().startsWith('|')).join('\n'))
}

/** English plural and possessive forms are the same rendering: heroes → hero, elves → elf. */
function stemWord(w: string): string {
  if (w.endsWith("'s")) w = w.slice(0, -2)
  else if (w.endsWith("s'")) w = w.slice(0, -1)
  if (w.length <= 3) return w
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.endsWith('ves')) return w.slice(0, -3) + 'f'
  if (w.endsWith('fe')) return w.slice(0, -2) + 'f'
  if (/(oes|ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2)
  if (/[^s]s$/.test(w)) return w.slice(0, -1)
  return w
}

const stemKey = (key: string) => key.split(' ').map(stemWord).join(' ')

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whole-word match on normalised text, so "runa" is not found inside "runaway". */
function occursIn(key: string, text: string): boolean {
  return !!key && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(key)}(?![\\p{L}\\p{N}])`, 'u').test(text)
}

export interface TermVariant {
  form: string
  /** Every spelling folded into this rendering (plural, possessive...). */
  forms: string[]
  key: string
  /** Chapters whose TEXT uses this rendering (not just their glossary table). */
  chapters: string[]
  fromGlossary: boolean
}

export interface TermVariantGroup {
  key: string
  sourceTerm: string
  glossaryRendering?: string
  variants: TermVariant[]
  flagged: boolean
}

/**
 * Source terms rendered more than one way IN THE TEXT.
 *
 * The chapters' glossary tables only nominate candidate renderings; where each
 * one is really used comes from scanning every chapter's text, so a glossary
 * rendering the tables never mention still shows the chapters that use it.
 * Not evidence of a different rendering:
 *   - a rendering that is another glossary entry's translation: a nickname row
 *     saying "Runa" finds "Runa" because Runa is a character;
 *   - a shorter rendering that only occurs inside a longer one of the same term
 *     ("resurrection" inside "resurrection of the dead");
 *   - honorifics and typography (see normText).
 * Renderings the user accepted stop the flag until a new one appears.
 */
export function termVariantGroups(chapters: Chapter[], glossary: GlossaryEntry[] = [], accepted: Record<string, string[]> = {}): TermVariantGroup[] {
  const entryBySource = new Map<string, GlossaryEntry>()
  const owners = new Map<string, Set<string>>()
  for (const e of glossary) {
    for (const s of [e.sourceTerm, ...(e.aliases ?? [])]) entryBySource.set(s.trim().toLowerCase(), e)
    const rk = renderingKey(e.translatedTerm)
    if (!owners.has(rk)) owners.set(rk, new Set())
    owners.get(rk)!.add(e.id)
  }

  // Candidates per source term, nominated by the chapters' tables.
  const cands = new Map<string, { sourceTerm: string; forms: Map<string, string> }>()
  for (const ch of chapters) {
    for (const e of ch.glossaryUpdates?.entries ?? []) {
      const key = (e.sourceTerm ?? '').trim().toLowerCase()
      const form = (e.translatedTerm ?? '').trim()
      const rk = renderingKey(form)
      if (!key || !rk) continue
      const own = entryBySource.get(key)?.id
      const ownedBy = owners.get(rk)
      if (ownedBy && !(own && ownedBy.has(own))) continue
      if (!cands.has(key)) cands.set(key, { sourceTerm: e.sourceTerm.trim(), forms: new Map() })
      const g = cands.get(key)!
      if (!g.forms.has(rk)) g.forms.set(rk, form)
    }
  }

  const texts = chapters.map(ch => ({
    label: ch.title ? `Ch ${ch.chapterNumber}: ${ch.title}` : `Ch ${ch.chapterNumber}`,
    text: chapterText(ch),
  }))

  const out: TermVariantGroup[] = []
  for (const [key, g] of cands) {
    const entry = entryBySource.get(key)
    const glossaryKey = entry ? renderingKey(entry.translatedTerm) : ''
    if (entry && glossaryKey) g.forms.set(glossaryKey, entry.translatedTerm)
    if (g.forms.size < 2) continue

    const forms = [...g.forms.entries()]
    const perForm = forms.map(([rk, form]) => {
      const longer = forms.map(([k]) => k).filter(k => k !== rk && k.includes(rk))
      const used = texts.filter(({ text }) => {
        let t = text
        for (const l of longer) t = t.split(l).join(' ')
        return occursIn(rk, t)
      }).map(x => x.label)
      return { form, rk, used }
    })

    // Fold plural/possessive spellings into one rendering.
    const merged = new Map<string, TermVariant>()
    for (const { form, rk, used } of perForm) {
      const sk = stemKey(rk)
      const isGlossary = rk === glossaryKey
      const v = merged.get(sk)
      if (!v) {
        merged.set(sk, { form, forms: [form], key: sk, chapters: [...used], fromGlossary: isGlossary })
        continue
      }
      v.forms.push(form)
      for (const c of used) if (!v.chapters.includes(c)) v.chapters.push(c)
      if (isGlossary) { v.fromGlossary = true; v.form = form }
    }
    const order = texts.map(x => x.label)
    for (const v of merged.values()) v.chapters.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const variants = [...merged.values()]

    const shown = variants
      .filter(v => v.chapters.length > 0 || v.fromGlossary)
      .sort((a, b) => Number(b.fromGlossary) - Number(a.fromGlossary) || b.chapters.length - a.chapters.length)
    const distinct = new Set(shown.map(v => v.key))
    const acc = new Set(accepted[key] ?? [])
    const flagged = distinct.size > 1 && (acc.size === 0 || [...distinct].some(k => !acc.has(k)))
    out.push({ key, sourceTerm: g.sourceTerm, glossaryRendering: entry?.translatedTerm, variants: shown, flagged })
  }
  return out
}

export function inconsistentTermKeys(chapters: Chapter[], glossary: GlossaryEntry[] = [], accepted: Record<string, string[]> = {}): Set<string> {
  return new Set(termVariantGroups(chapters, glossary, accepted).filter(g => g.flagged).map(g => g.key))
}

/** Number of source terms rendered 2+ ways in the translated text (and not accepted). */
export function countInconsistencies(chapters: Chapter[], glossary: GlossaryEntry[] = [], accepted: Record<string, string[]> = {}): number {
  return inconsistentTermKeys(chapters, glossary, accepted).size
}

/** One inconsistent term: pick the right rendering and unify, or accept the variation. */
function TermGroupCard({ group, seriesId, onChanged }: { group: TermVariantGroup; seriesId: string; onChanged: () => Promise<void> | void }) {
  const toast = useToast()
  const [choice, setChoice] = useState(group.glossaryRendering ?? group.variants[0]?.form ?? '')
  const [busy, setBusy] = useState<'' | 'unify' | 'accept'>('')
  const others = group.variants.filter(v => v.key !== stemKey(renderingKey(choice)))

  const unify = async () => {
    if (!others.length) return
    const list = others.map(o => `"${o.form}"`).join(', ')
    if (!window.confirm(`Ganti ${list} menjadi "${choice}" di semua bab?\n\nVersi lama tiap bab yang berubah diarsipkan ke riwayat versi.`)) return
    setBusy('unify')
    try {
      const r = await unifyTermVariants(seriesId, group.sourceTerm, choice, others.flatMap(o => o.forms))
      toast.success(`${group.sourceTerm}: ${r.replaced} kemunculan diganti menjadi "${choice}"`)
      await onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const accept = async () => {
    setBusy('accept')
    try {
      await acceptTermVariants(seriesId, group.sourceTerm, group.variants.map(v => v.key))
      toast.info(`${group.sourceTerm}: variasi ditandai disengaja`)
      await onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card" style={{ borderLeft: '3px solid var(--fg-red)' }}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--color-separator)' }}>
        <AlertTriangle size={13} style={{ color: 'var(--fg-red)', flexShrink: 0 }} />
        <span className="font-mono text-sm font-bold">{group.sourceTerm}</span>
        <span className="text-xs text-muted-foreground">{group.variants.length} bentuk</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" onClick={unify} disabled={!!busy || !others.length} className="h-7 gap-1.5 text-xs">
            {busy === 'unify' && <Loader2 size={12} className="animate-spin" />}
            Samakan ke "{choice}"
          </Button>
          <Button size="sm" variant="ghost" onClick={accept} disabled={!!busy} className="h-7 text-xs"
            title="Variasi ini disengaja (mis. frasa deskriptif). Istilah ini tidak ditandai lagi sampai muncul bentuk baru.">
            {busy === 'accept' && <Loader2 size={12} className="animate-spin" />}
            Abaikan
          </Button>
        </div>
      </div>
      <fieldset className="flex flex-col py-1">
        <legend className="sr-only">Bentuk yang benar untuk {group.sourceTerm}</legend>
        {group.variants.map(v => (
          <label key={v.key} className="flex cursor-pointer items-start gap-2.5 px-3 py-1.5 hover:bg-muted">
            <input type="radio" name={`variant-${group.key}`} checked={stemKey(renderingKey(choice)) === v.key}
              onChange={() => setChoice(v.form)} className="mt-1 accent-[var(--primary)]" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{v.form}</span>
                {v.fromGlossary && (
                  <span className="rounded px-1.5 text-[10px] font-semibold" style={{ background: 'var(--bg-blue)', color: 'var(--fg-blue)' }}>Glossary</span>
                )}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {v.chapters.length ? `Dipakai di ${v.chapters.join(' · ')}` : 'Tidak ditemukan di teks bab mana pun'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  )
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

export function AllTermsModal({ open, onClose, chapters, seriesGlossary, seriesId, accepted = {}, onChanged }: Props) {
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
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

  const groups = useMemo(() => termVariantGroups(chapters, seriesGlossary, accepted), [chapters, seriesGlossary, accepted])
  const inconsistentKeys = useMemo(() => new Set(groups.filter(g => g.flagged).map(g => g.key)), [groups])
  const acceptedTerms = useMemo(() => groups.filter(g => !g.flagged && (accepted[g.key]?.length ?? 0) > 0), [groups, accepted])
  const toast = useToast()
  const undoAccept = async (g: TermVariantGroup) => {
    try { await acceptTermVariants(seriesId, g.sourceTerm, []); await onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  const allRows = useMemo<TermRow[]>(() => {
    const rows: TermRow[] = []
    for (const ch of chapters) {
      const entries = ch.glossaryUpdates?.entries ?? []
      if (!entries.length) continue
      const label = ch.title
        ? `Ch ${ch.chapterNumber}: ${ch.title}`
        : `Chapter ${ch.chapterNumber}`
      const text = chapterText(ch)
      for (const e of entries) {
        const srcKey = (e.sourceTerm ?? '').trim().toLowerCase()
        const tKey = renderingKey(e.translatedTerm ?? '')
        const glossaryTranslation = glossaryMap.get(srcKey)
        const inGlossary = glossaryMap.has(srcKey)
        const isMain = inGlossary && glossaryTranslation === tKey
        const tableOnly = inGlossary && !isMain && !text.includes(normText(e.translatedTerm ?? '').trim())
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
    <ModalSurface label="Extracted terms" onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`.copy-icon { transition: opacity 0.1s } tr:hover .copy-icon { opacity: 1 !important }`}</style>
      <div
        className="flex flex-col"
        style={{ borderRadius: 'var(--radius)',
          width: '900px',
          maxWidth: '96vw',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-page,#F8F3EA)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 650, fontSize: '14px', textTransform: 'none', letterSpacing: 'normal' }}>
              All extracted terms
            </span>
            <span style={{ fontSize: '12px', color: 'var(--fg-muted,#888)', fontWeight: 600 }}>
              {filtered.length} / {allRows.length}
            </span>
            {inconsistentCount > 0 && (
              <span
                className="flex items-center gap-1"
                style={{ borderRadius: 'var(--radius)',  padding: '2px 8px', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--bg-red,#FF3C3C)', color: 'var(--fg-red)', border: '1px solid var(--border)', letterSpacing: 'normal' }}
              >
                <AlertTriangle size={11} />
                {inconsistentCount} {inconsistentCount === 1 ? 'inconsistency' : 'inconsistencies'}
              </span>
            )}
          </div>
          <Button aria-label="Close" variant="ghost" onClick={onClose} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--on-accent,#111)' }}>
            <X size={18} />
          </Button>
        </div>

        {/* Filter tabs + Search */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--line,var(--border))', flexShrink: 0 }}>
          <div className="flex" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--border)', flexShrink: 0 }}>
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} color="var(--foreground)">
              All ({allRows.length})
            </FilterBtn>
            <FilterBtn active={filter === 'main'} onClick={() => setFilter('main')} color="var(--fg-blue,#1565C0)" borderRight>
              ★ Main ({allRows.filter(r => r.isMain).length})
            </FilterBtn>
            <FilterBtn active={filter === 'inconsistent'} onClick={() => setFilter('inconsistent')} color="var(--fg-red,#FF3C3C)">
              <AlertTriangle size={10} style={{ display: 'inline', marginRight: 4 }} />
              Inconsistent ({inconsistentCount})
            </FilterBtn>
          </div>

          <div className="flex items-center gap-2 flex-1" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface,#fff)', padding: '5px 10px' }}>
            <Search size={13} style={{ color: 'var(--fg-muted,#888)', flexShrink: 0 }} />
            <Input aria-label="Search source term, translation, notes, or chapter..."
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search source term, translation, notes, or chapter..."
              style={{ borderRadius: 'var(--radius)',  flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'var(--font-body)' }}
            />
            {query && (
              <Button aria-label="Close" variant="ghost" onClick={() => setQuery('')} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-subtle,#aaa)', padding: 0 }}>
                <X size={12} />
              </Button>
            )}
          </div>
        </div>

        {/* Options row and legend: only for the flat table views */}
        {filter !== 'inconsistent' && (<>
        <div className="flex items-center gap-4 px-4 py-2" style={{ borderBottom: '1px solid var(--line,var(--border))', flexShrink: 0, backgroundColor: 'var(--bg-surface,#fafaf8)' }}>
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', color: 'var(--fg-muted,#888)' }}>Sort:</span>
            <div className="flex" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--line,#ccc)' }}>
              <Button variant="ghost"
                onClick={() => setSortBy('chapter')}
                style={{ borderRadius: 'var(--radius)',  padding: '3px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'none', border: 'none', borderRight: '1px solid var(--line,#ccc)', cursor: 'pointer', backgroundColor: sortBy === 'chapter' ? 'var(--accent)' : 'transparent', color: sortBy === 'chapter' ? 'var(--foreground)' : 'var(--fg-muted,#666)' }}
              >
                By Chapter
              </Button>
              <Button variant="ghost"
                onClick={() => setSortBy('source')}
                style={{ borderRadius: 'var(--radius)',  padding: '3px 10px', fontSize: '10px', fontWeight: 600, textTransform: 'none', border: 'none', cursor: 'pointer', backgroundColor: sortBy === 'source' ? 'var(--accent)' : 'transparent', color: sortBy === 'source' ? 'var(--foreground)' : 'var(--fg-muted,#666)' }}
              >
                By Source Term
              </Button>
            </div>
          </div>

          {/* Collapse MAIN toggle */}
          <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', color: 'var(--fg-muted,#888)' }}>
              Collapse main duplicates:
            </span>
            <Button variant="ghost"
              onClick={() => setCollapseMain(v => !v)}
              style={{ borderRadius: 'var(--radius)',
                padding: '3px 12px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'none',
                border: '1px solid',
                cursor: 'pointer',
                borderColor: collapseMain ? 'var(--fg-blue,#1565C0)' : 'var(--line,#ccc)',
                backgroundColor: collapseMain ? 'var(--bg-blue,#1565C0)' : 'transparent',
                color: collapseMain ? 'var(--foreground)' : 'var(--fg-muted,#888)',
                letterSpacing: 'normal',
              }}
            >
              {collapseMain ? 'On' : 'Off'}
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-1.5" style={{ borderBottom: '1px solid var(--line,var(--border))', flexShrink: 0, backgroundColor: 'var(--bg-surface,#fafaf8)' }}>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#888)', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>Status:</span>
          <span style={{ ...legendBadge, borderColor: 'var(--fg-blue,#1565C0)', backgroundColor: 'var(--tint-blue,#e8f0fe)', color: 'var(--fg-blue,#1565C0)' }}>★ Main</span>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#666)' }}>= source + translation match glossary (patokan)</span>
          <span style={{ ...legendBadge, borderColor: 'var(--fg-orange,#f59e0b)', backgroundColor: 'var(--tint-orange,#fffbeb)', color: 'var(--fg-orange,#b45309)' }}>Mismatch</span>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#666)' }}>= source ada di glossary, tapi terjemahan beda</span>
          <span style={{ ...legendBadge, borderColor: 'var(--line,var(--border))', backgroundColor: 'transparent', color: 'var(--fg-subtle,#aaa)' }}>Extracted</span>
          <span style={{ fontSize: '10px', color: 'var(--fg-muted,#666)' }}>= belum masuk glossary</span>
        </div>
        </>)}

        {/* Table */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {filter === 'inconsistent' ? (
            // Grouped per term: the glossary rendering (pre-pass included) sits on top.
            <div className="flex flex-col gap-2.5 p-3">
              {inconsistentCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Pilih bentuk yang benar lalu <strong>Samakan</strong>: bentuk lain diganti di semua bab dan versi lama diarsipkan.
                  Frasa deskriptif sering wajar diterjemahkan beragam; untuk itu pilih <strong>Abaikan</strong>.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10">
                  <span style={{ fontSize: '28px' }}>✓</span>
                  <p style={{ color: 'var(--fg-green)', fontSize: '13px', fontWeight: 600 }}>No inconsistencies found!</p>
                </div>
              )}
              {groups.filter(g => g.flagged && (!query.trim() || g.sourceTerm.toLowerCase().includes(query.toLowerCase()) || g.variants.some(v => v.form.toLowerCase().includes(query.toLowerCase()))))
                .map(g => <TermGroupCard key={g.key} group={g} seriesId={seriesId} onChanged={onChanged} />)}
              {acceptedTerms.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Diabaikan:</span>
                  {acceptedTerms.map(g => (
                    <Button key={g.key} variant="outline" size="xs" onClick={() => undoAccept(g)} title="Tandai lagi istilah ini" className="gap-1 font-mono">
                      {g.sourceTerm} <Undo2 size={11} />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p style={{ color: 'var(--muted-foreground)', fontSize: '13px' }}>No terms found.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-page,#F8F3EA)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
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
                    ? 'var(--bg-red)'
                    : (i % 2 === 0 ? 'var(--card)' : 'color-mix(in srgb, var(--muted) 60%, var(--card))')
                  const borderLeft = row.isInconsistent ? '1px solid var(--fg-red,#FF3C3C)' : '1px solid transparent'
                  const srcColor = row.isInconsistent ? 'var(--fg-red)' : 'var(--foreground)'
                  const badge = statusBadge(row)

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', backgroundColor: bg, borderLeft }}>
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
        {inconsistentCount > 0 && filter !== 'inconsistent' && (
          <div className="flex items-center gap-2 px-5 py-2" style={{ borderTop: '1px solid var(--line,var(--border))', flexShrink: 0, backgroundColor: 'var(--tint-red,#fff8f8)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--fg-red,#FF3C3C)' }} />
            <span style={{ fontSize: '11px', color: 'var(--fg-muted,#888)' }}>
              Buka tab <strong>Inconsistent</strong>: tiap istilah bisa disamakan ke satu bentuk (bab yang berubah diarsipkan) atau diabaikan bila variasinya disengaja.
            </span>
          </div>
        )}
      </div>
    </ModalSurface>
  )
}

function FilterBtn({ active, onClick, color, children, borderRight }: {
  active: boolean; onClick: () => void; color: string; children: React.ReactNode; borderRight?: boolean
}) {
  return (
    <Button variant="ghost"
      onClick={onClick}
      style={{ borderRadius: 'var(--radius)',
        padding: '5px 12px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: 'normal',
        border: 'none',
        borderRight: borderRight ? '1px solid var(--border)' : undefined,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--accent-foreground)' : color === 'var(--on-accent,#111)' ? 'var(--fg-muted,#555)' : color,
      }}
    >
      {children}
    </Button>
  )
}

function statusBadge(row: TermRow): { label: string; style: React.CSSProperties } {
  if (row.isMain) return {
    label: '★ Main',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', border: '1.5px solid var(--fg-blue,#1565C0)', backgroundColor: 'var(--tint-blue,#e8f0fe)', color: 'var(--fg-blue,#1565C0)' },
  }
  if (row.tableOnly) return {
    label: 'Hanya tabel',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', border: '1.5px solid var(--fg-subtle,#bbb)', backgroundColor: 'transparent', color: 'var(--fg-muted,#888)' },
  }
  if (row.inGlossary) return {
    label: 'Mismatch',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', border: '1.5px solid var(--fg-orange,#f59e0b)', backgroundColor: 'var(--tint-orange,#fffbeb)', color: 'var(--fg-orange,#b45309)' },
  }
  return {
    label: 'Extracted',
    style: { display: 'inline-block', padding: '2px 6px', fontSize: '10px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', border: '1.5px solid var(--line,#ddd)', backgroundColor: 'transparent', color: 'var(--fg-subtle,#aaa)' },
  }
}

const legendBadge: React.CSSProperties = {
  display: 'inline-block', padding: '1px 5px', fontSize: '9px', fontWeight: 600,
  textTransform: 'none', letterSpacing: 'normal', border: '1.5px solid',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: '11px',
  fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: 'var(--fg-muted,#555)',
}

const tdStyle: React.CSSProperties = {
  padding: '7px 12px', verticalAlign: 'top',
}
