/**
 * LWNTL Chapter Workspace Page
 * Split view with raw content (left) and translated markdown (right)
 * Bottom: expandable glossary update panel
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Square, Download, RefreshCw, Save, AlertTriangle, Copy } from 'lucide-react'
import { Topbar } from '../components/Topbar'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { GlossaryUpdatePanel } from '../components/GlossaryUpdatePanel'
import { StatusBar } from '../components/StatusBar'
import ContextInfoBar from '../components/ContextInfoBar'
import { useToast } from '../hooks/useToast'
import { useTranslation } from '../hooks/useTranslation'
import {
  getChapter,
  getGlossary,
  startTranslation,
  cancelTranslation,
  exportChapter,
  addGlossaryEntry,
  getContextInfo,
  updateChapter,
} from '../api'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import type { Chapter, ContextInfo, GlossaryEntry } from '../types'

/** Remove the trailing glossary table from translated content (same logic as Python extractor). */
function stripGlossaryTable(content: string): string {
  if (!content) return content
  const lines = content.split('\n')

  // Strategy 1: last '---' followed by a pipe table
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^-{3,}\s*$/.test(lines[i].trim())) {
      const after = lines.slice(i + 1)
      if (after.some(l => /^\|.+\|$/.test(l.trim()))) {
        return lines.slice(0, i).join('\n').trimEnd()
      }
    }
  }

  // Strategy 2: last pipe table block + optional blank lines / bold heading above
  let end = lines.length - 1
  while (end >= 0 && !lines[end].trim()) end--

  if (end >= 0 && /^\|.+\|$/.test(lines[end].trim())) {
    let start = end
    while (start > 0 && /^\|.+\|$/.test(lines[start - 1].trim())) start--

    let stripFrom = start
    for (let i = start - 1; i >= Math.max(-1, start - 5); i--) {
      const s = lines[i].trim()
      if (!s || /^\*\*[^*]+\*\*[:\s]*$/.test(s)) { stripFrom = i } else break
    }
    return lines.slice(0, stripFrom).join('\n').trimEnd()
  }

  return content
}

export function ChapterWorkspacePage() {
  const { id: seriesId, chapterId } = useParams<{ id: string; chapterId: string }>()
  const toast = useToast()
  const { t } = useI18n()
  const { apiReady } = useAppStore()

  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null)
  const [seriesGlossary, setSeriesGlossary] = useState<GlossaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [splitPos, setSplitPos] = useState(50) // percentage

  const [isSavingRaw, setIsSavingRaw] = useState(false)
  const [isRawDirty, setIsRawDirty] = useState(false)
  const rawRef = useRef<HTMLTextAreaElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const wasTranslatingRef = useRef(false)

  const {
    isTranslating,
    status,
    streamingText,
    iteration,
    progress,
    glossaryUpdates,
    startTranslating,
  } = useTranslation(seriesId!, chapterId!)

  // Load chapter data + context info + series glossary
  const loadChapter = useCallback(async () => {
    if (!seriesId || !chapterId) return
    try {
      const [ch, gloss] = await Promise.all([
        getChapter(seriesId, chapterId),
        getGlossary(seriesId),
      ])
      setChapter(ch)
      setSeriesGlossary(gloss)
      try {
        const info = await getContextInfo(seriesId, chapterId)
        setContextInfo(info)
      } catch { /* non-critical */ }
    } catch {
      toast.error(t.chapter.translateFailed)
    } finally {
      setLoading(false)
    }
  }, [seriesId, chapterId])

  useEffect(() => {
    if (apiReady) loadChapter()
  }, [apiReady, loadChapter])

  useEffect(() => { setIsRawDirty(false) }, [chapter?.id])

  // Reload chapter when translation finishes (isTranslating: true → false)
  useEffect(() => {
    if (wasTranslatingRef.current && !isTranslating) {
      loadChapter()
    }
    wasTranslatingRef.current = isTranslating
  }, [isTranslating, loadChapter])

  // Start translation
  const handleStartTranslation = async () => {
    if (!seriesId || !chapterId) return
    try {
      startTranslating()
      await startTranslation(seriesId, chapterId)
    } catch (err: any) {
      toast.error(t.chapter.translateFailed + (err.message || ''))
    }
  }

  // Cancel translation
  const handleCancelTranslation = async () => {
    try {
      await cancelTranslation()
      toast.info(t.chapter.translationCancelled)
    } catch {
      toast.error(t.chapter.cancelFailed)
    }
  }

  // Export chapter
  const handleExport = async () => {
    if (!seriesId || !chapterId) return
    try {
      const result = await exportChapter(seriesId, chapterId)
      if (!result?.cancelled) {
        toast.success(result?.message || t.chapter.exportSuccess)
      }
    } catch (err: any) {
      toast.error(t.chapter.exportFailed + ' ' + (err.message || ''))
    }
  }

  // Add a single extracted entry to the series glossary
  const handleAddGlossaryEntry = async (sourceTerm: string, translatedTerm: string, notes: string) => {
    if (!seriesId) return
    const newEntry = await addGlossaryEntry(seriesId, sourceTerm, translatedTerm, notes)
    setSeriesGlossary(prev => [...prev, newEntry])
    toast.success(t.glossaryUpdates.entryAdded)
  }

  // Copy clean translation (strips glossary table)
  const handleCopyTranslation = async () => {
    const raw = isTranslating ? streamingText : chapter?.translatedContent || ''
    const clean = stripGlossaryTable(raw)
    try {
      await navigator.clipboard.writeText(clean)
      toast.success(t.chapter.copySuccess)
    } catch {
      toast.error(t.chapter.copyFailed)
    }
  }

  // Save raw content — reads from DOM ref, zero re-renders while typing
  const handleSaveRaw = async () => {
    if (!seriesId || !chapterId || !chapter) return
    const value = rawRef.current?.value ?? chapter.rawContent
    setIsSavingRaw(true)
    try {
      await updateChapter(seriesId, chapterId, chapter.chapterNumber, chapter.title, value)
      setIsRawDirty(false)
      await loadChapter()
      toast.success(t.chapter.rawSaved)
    } catch {
      toast.error(t.chapter.rawSaveFailed)
    } finally {
      setIsSavingRaw(false)
    }
  }

  // Track dirty state — fires on every input but only calls setState when status changes (max 2 re-renders per session)
  const handleRawInput = () => {
    const dirty = rawRef.current?.value !== chapter?.rawContent
    if (dirty !== isRawDirty) setIsRawDirty(dirty)
  }

  // Resizable divider
  const handleMouseDown = () => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setSplitPos(Math.max(20, Math.min(80, pct)))
    }
    const handleMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Determine display text
  // During translation: show live streamingText
  // After done: chapter state is reloaded, fall back streamingText while reload happens
  const translatedText = isTranslating
    ? streamingText
    : chapter?.translatedContent || streamingText || ''

  if (loading) {
    return (
      <div className="app-layout">
        <Topbar showBack title={t.common.loading} />
        <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
          <p style={{ color: 'var(--color-text-subtle)' }}>{t.chapter.loadingChapter}</p>
        </main>
      </div>
    )
  }

  if (!chapter) {
    return (
      <div className="app-layout">
        <Topbar showBack title={t.chapter.notFound} />
        <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
          <p style={{ color: 'var(--color-text-subtle)' }}>{t.chapter.chapterNotFound}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Topbar
        showBack
        title={chapter.title || `${t.chapter.chapter} ${chapter.chapterNumber}`}
        subtitle={`${seriesId ? 'Series' : ''}`}
      />

      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: 'var(--color-surface)', borderBottom: '2.5px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
            {t.chapter.chapter} {chapter.chapterNumber}
          </span>
          {chapter.title && (
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>— {chapter.title}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Translate / Cancel button */}
          {isTranslating ? (
            <button
              onClick={handleCancelTranslation}
              className="neo-button neo-button-error flex items-center gap-1"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <Square size={14} />
              {t.common.cancel}
            </button>
          ) : chapter?.status === 'done' ? (
            <button
              onClick={handleStartTranslation}
              className="neo-button flex items-center gap-1"
              style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: '#FFEF33' }}
            >
              <RefreshCw size={14} />
              {t.chapter.translate}
            </button>
          ) : (
            <button
              onClick={handleStartTranslation}
              className="neo-button flex items-center gap-1"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              <Play size={14} />
              {t.chapter.translate}
            </button>
          )}

          {/* Export */}
          {chapter.status === 'done' && (
            <button
              onClick={handleExport}
              className="neo-button flex items-center gap-1"
              style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: '#F0F0F0' }}
            >
              <Download size={14} />
              {t.chapter.export}
            </button>
          )}
        </div>
      </div>

      {/* Split View */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Left: Raw content — always-editable textarea, save reads from DOM ref (no re-render on type) */}
        <div
          className="flex flex-col"
          style={{
            width: `${splitPos}%`,
            backgroundColor: 'var(--color-surface)',
            border: '2.5px solid var(--color-border)',
            borderRight: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Header — fixed height */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', flexShrink: 0 }}
          >
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text)' }}>
              {t.chapter.rawContent}
            </span>
            <button
              onClick={handleSaveRaw}
              disabled={!isRawDirty || isSavingRaw || isTranslating}
              className="flex items-center gap-1"
              style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                padding: '3px 8px', border: '1.5px solid var(--color-border)',
                backgroundColor: '#28E272', color: '#111',
                cursor: (!isRawDirty || isSavingRaw || isTranslating) ? 'not-allowed' : 'pointer',
                opacity: (!isRawDirty || isSavingRaw || isTranslating) ? 0.35 : 1,
                transition: 'opacity 150ms',
              }}
            >
              <Save size={10} /> {isSavingRaw ? t.common.saving : t.common.save}
            </button>
          </div>

          {/* Warning note — fixed height, only when translation exists */}
          {chapter.translatedContent && (
            <div
              className="flex items-start gap-2 px-3 py-1.5"
              style={{ backgroundColor: 'rgba(255,239,51,0.1)', borderBottom: '1.5px solid #FFEF33', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.4, flexShrink: 0 }}
            >
              <AlertTriangle size={11} style={{ color: '#FFEF33', flexShrink: 0, marginTop: '1px' }} />
              <span>{t.chapter.rawEditedAfterTranslation}</span>
            </div>
          )}

          {/* Textarea — fills remaining space via flex: 1 */}
          <textarea
            key={chapter.id}
            ref={rawRef}
            defaultValue={chapter.rawContent || ''}
            onInput={handleRawInput}
            disabled={isTranslating}
            style={{
              flex: '1 1 0',
              minHeight: 0,
              padding: '16px',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--color-text)',
              backgroundColor: isTranslating ? 'var(--color-surface-2)' : 'var(--color-surface)',
              border: 'none',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
          />
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: '8px',
            backgroundColor: 'var(--color-border)',
            cursor: 'col-resize',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '4px',
              height: '32px',
              backgroundColor: '#00F7FF',
            }}
          />
        </div>

        {/* Right: Translated content */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '2.5px solid var(--color-border)',
            borderLeft: 'none',
          }}
        >
          <div className="px-3 py-2" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text)' }}>
                {t.chapter.translation}
              </span>
              <div className="flex items-center gap-2">
                {isTranslating && (
                  <span className="neo-badge" style={{ fontSize: '10px', backgroundColor: '#00F7FF', padding: '2px 6px', border: '2px solid var(--color-border)', fontWeight: 700 }}>
                    {t.chapter.iteration} {iteration}
                  </span>
                )}
                {translatedText && (
                  <button
                    onClick={handleCopyTranslation}
                    className="flex items-center gap-1"
                    style={{
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                      padding: '3px 8px', border: '1.5px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Copy size={10} /> {t.common.copy}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MarkdownRenderer content={translatedText} />
          </div>
        </div>
      </div>

      {/* Glossary Update Panel */}
      <GlossaryUpdatePanel
        updates={glossaryUpdates || chapter.glossaryUpdates}
        seriesGlossary={seriesGlossary}
        onAddEntry={handleAddGlossaryEntry}
      />

      {/* Context Info Bar */}
      {!isTranslating && <ContextInfoBar info={contextInfo} />}

      {/* Status Bar */}
      <StatusBar
        translation={{ isTranslating, status, streamingText, iteration, progress, glossaryUpdates }}
        chapterStatus={chapter.status}
      />
    </div>
  )
}