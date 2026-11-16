import { Button } from '@/components/ui/button'
/**
 * LWNTL Series Settings Page
 * 3-panel layout: Chapter list | Prompt/Model | Glossary
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Topbar } from '../components/Topbar'
import { ChapterList } from '../components/ChapterList'
import { PromptModelPanel } from '../components/PromptModelPanel'
import { GlossaryTable } from '../components/GlossaryTable'
import { CreateChapterModal } from '../components/CreateChapterModal'
import { EditChapterModal } from '../components/EditChapterModal'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import BatchTranslationPanel from '../components/BatchTranslationPanel'
import MemoryPanel from '../components/MemoryPanel'
import { AllTermsModal, countInconsistencies } from '../components/AllTermsModal'
import { RollingMemoryModal } from '../components/RollingMemoryModal'
import { useToast } from '../hooks/useToast'
import { useBatchTranslation } from '../hooks/useBatchTranslation'
import { Play, Brain, CheckSquare, Trash2, X, RefreshCw, ScrollText, FileDown, BookOpen, BookText, ScanSearch, Bot, ShieldCheck, Image as ImageIcon, ChevronDown, FileType2 } from 'lucide-react'
import { TerminologyPrepassModal } from '../components/TerminologyPrepassModal'
import { AgentRunModal } from '../components/AgentRunModal'
import { QaReportModal } from '../components/QaReportModal'
import { ImageFolderModal } from '../components/ImageFolderModal'
import { DocTemplateModal } from '../components/DocTemplateModal'
import type { ProposedTerm } from '../api'
import {
  getAllSeries,
  getChapters,
  getGlossary,
  createChapter,
  updateChapter,
  deleteChapter,
  getChapterDeleteInfo,
  addGlossaryEntry,
  addGlossaryAlias,
  removeGlossaryAlias,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  saveConfig,
  saveInstructions,
  updateSeries,
  getWorkerStatuses,
  getSeriesLogs,
  exportChapter,
  exportSeriesMerged,
} from '../api'
import type { ImportedImage } from '../api'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import type { Series, Chapter, GlossaryEntry, AppConfig, WorkerStatus } from '../types'
import { chapterNumFloat } from '../types'
import { detectCJK } from '../utils/cjkDetector'
import type { CJKIncident } from '../utils/cjkDetector'
import CJKBubble from '../components/CJKBubble'
import { stripGlossaryTable } from '../utils/stripGlossaryTable'

export function SeriesSettingsPage() {
  const { id: seriesId } = useParams<{ id: string }>()
  const toast = useToast()
  const { t } = useI18n()
  const { config, setConfig, apiReady } = useAppStore()
  const { isBatchActive, startBatch, startSelectedBatch, startAgent, cancelBatch } = useBatchTranslation(seriesId!)
  const [showMemory, setShowMemory] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showAllTerms, setShowAllTerms] = useState(false)
  const [showPrepass, setShowPrepass] = useState(false)
  const [showAgentRun, setShowAgentRun] = useState(false)
  const [showQa, setShowQa] = useState(false)
  const [showImageFolder, setShowImageFolder] = useState(false)
  const [showRollingMemory, setShowRollingMemory] = useState(false)
  const [seriesLogLines, setSeriesLogLines] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const [showDocTemplate, setShowDocTemplate] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(() => {
    try { return localStorage.getItem(TOOLS_OPEN_KEY) !== '0' } catch { return true }
  })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)

  const [series, setSeries] = useState<Series | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])
  const inconsistencyCount = useMemo(() => countInconsistencies(chapters, glossary), [chapters, glossary])
  const [instructions, setInstructions] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [workerStatuses, setWorkerStatuses] = useState<WorkerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [cjkIncidents, setCjkIncidents] = useState<CJKIncident[]>([])

  // Modal states
  const [createChapterOpen, setCreateChapterOpen] = useState(false)
  const [editChapter, setEditChapter] = useState<Chapter | null>(null)
  const [deleteChapterTarget, setDeleteChapterTarget] = useState<Chapter | null>(null)
  const [deleteChapterDetails, setDeleteChapterDetails] = useState<string[]>([])
  const [deleteChapterLoading, setDeleteChapterLoading] = useState(false)
  const [createChapterLoading, setCreateChapterLoading] = useState(false)
  const [editChapterLoading, setEditChapterLoading] = useState(false)
  const [deleteGlossaryTarget, setDeleteGlossaryTarget] = useState<GlossaryEntry | null>(null)
  const [deleteGlossaryLoading, setDeleteGlossaryLoading] = useState(false)
  const [, setAddGlossaryLoading] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    if (!seriesId) return
    try {
      const [allSeries, chaps, gloss, workers] = await Promise.all([
        getAllSeries(),
        getChapters(seriesId),
        getGlossary(seriesId),
        getWorkerStatuses(),
      ])
      const s = allSeries.find((s) => s.id === seriesId) || null
      setSeries(s)
      setChapters(chaps)
      setGlossary(gloss)
      setInstructions(s?.instructions || '')
      setSystemPrompt(s?.systemPrompt || '')
      setWorkerStatuses(workers)
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setLoading(false)
    }
  }, [seriesId])

  useEffect(() => {
    if (apiReady) loadData()
  }, [apiReady, loadData])

  // Event-driven chapter list sync: no polling needed.
  // lwntl:translation-done / error fire per-chapter (single and batch).
  // lwntl:batch-status fires when the whole batch finishes or is cancelled.
  useEffect(() => {
    if (!seriesId || !apiReady) return
    const refresh = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.seriesId === seriesId) {
        getChapters(seriesId).then(setChapters).catch(() => {})
      }
    }
    const onBatchSettled = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.seriesId !== seriesId) return
      const settled = detail.status === 'done' || detail.status === 'cancelled'
      // Agent runs edit chapters and the glossary between phase events, so
      // refresh on every phase change, not only when the run settles.
      if (settled || detail.agent) {
        getChapters(seriesId).then(setChapters).catch(() => {})
      }
      if (detail.agent && settled) {
        getGlossary(seriesId).then(setGlossary).catch(() => {})
      }
    }
    window.addEventListener('lwntl:translation-done', refresh)
    window.addEventListener('lwntl:translation-error', refresh)
    window.addEventListener('lwntl:batch-status', onBatchSettled)
    return () => {
      window.removeEventListener('lwntl:translation-done', refresh)
      window.removeEventListener('lwntl:translation-error', refresh)
      window.removeEventListener('lwntl:batch-status', onBatchSettled)
    }
  }, [seriesId, apiReady])

  // Poll series logs when panel is open
  useEffect(() => {
    if (!showLogs || !seriesId || !apiReady) return
    const poll = async () => {
      try {
        const result = await getSeriesLogs(seriesId)
        setSeriesLogLines(result.lines)
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [showLogs, seriesId, apiReady])

  // Auto-scroll log panel to bottom when new lines arrive
  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [seriesLogLines, showLogs])

  // Aggregate CJK incidents across all done chapters whenever chapter list changes
  // Strip glossary table first so source-term CJK in the appended table is excluded
  useEffect(() => {
    const all: CJKIncident[] = []
    for (const ch of chapters) {
      if (ch.status === 'done' && ch.translatedContent) {
        const label = `Bab ${ch.chapterNumber}${ch.title ? `: ${ch.title}` : ''}`
        all.push(...detectCJK(stripGlossaryTable(ch.translatedContent), label))
      }
    }
    setCjkIncidents(all)
  }, [chapters])

  // Save config + instructions + systemPrompt
  const handleSaveSettings = async (newConfig: AppConfig, newInstructions: string, newSystemPrompt: string, workerId: string, iterationLock: boolean, autoFixCjk: boolean, revisionPass: boolean, lookupEnabled: boolean, lookupChapters: number, systemPromptPreset: string) => {
    if (!seriesId || !series) return
    setSaveLoading(true)
    try {
      await saveConfig(newConfig)
      setConfig(newConfig)

      await saveInstructions(seriesId, newInstructions)
      setInstructions(newInstructions)

      await updateSeries(seriesId, series.title, series.sourceLanguage, series.targetLanguage, newSystemPrompt, workerId, iterationLock, autoFixCjk, undefined, revisionPass, lookupEnabled, lookupChapters, systemPromptPreset)
      setSystemPrompt(newSystemPrompt)
      setSeries((prev) => prev ? { ...prev, systemPrompt: newSystemPrompt, systemPromptPreset, instructions: newInstructions, workerId, iterationLock, autoFixCjk, revisionPass, lookupEnabled, lookupChapters } : prev)
      setWorkerStatuses(await getWorkerStatuses())

      toast.success(t.seriesSettings.saveSuccess)
    } catch {
      toast.error(t.seriesSettings.saveFailed)
    } finally {
      setSaveLoading(false)
    }
  }

  // Chapter CRUD
  const nextChapterNumber: string = (() => {
    const nums = chapters.map(c => chapterNumFloat(c.chapterNumber)).filter(n => !isNaN(n) && n < 9000)
    return nums.length > 0 ? String(Math.max(...nums) + 1) : '1'
  })()

  const handleCreateChapter = async (number: string, title: string, rawContent: string) => {
    if (!seriesId) return
    setCreateChapterLoading(true)
    try {
      const newChap = await createChapter(seriesId, number, title, rawContent)
      setChapters((prev) => [...prev, newChap])
      setCreateChapterOpen(false)
      toast.success(`✓`)
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setCreateChapterLoading(false)
    }
  }

  const handleBulkCreateChapter = async (bulk: { number: string; title: string; rawContent: string; images?: ImportedImage[] }[]) => {
    if (!seriesId) return
    try {
      for (const ch of bulk) {
        await createChapter(seriesId, ch.number, ch.title, ch.rawContent, ch.images)
      }
      const chaps = await getChapters(seriesId)
      setChapters(chaps)
      setCreateChapterOpen(false)
      toast.success(`✓ ${bulk.length}`)
    } catch {
      toast.error(t.settings.saveFailed)
      throw new Error('bulk create failed')
    }
  }

  const handleEditChapter = async (chapterId: string, number: string, title: string, rawContent: string) => {
    if (!seriesId) return
    setEditChapterLoading(true)
    try {
      const updated = await updateChapter(seriesId, chapterId, number, title, rawContent)
      setChapters((prev) => prev.map((c) => (c.id === chapterId ? updated : c)))
      setEditChapter(null)
      toast.success('✓')
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setEditChapterLoading(false)
    }
  }

  const handleExportChapter = async (chapter: Chapter) => {
    try {
      await exportChapter(seriesId!, chapter.id)
      toast.success('Chapter exported')
    } catch (e: any) {
      toast.error(e.message || 'Export failed')
    }
  }

  const [batchExporting, setBatchExporting] = useState(false)
  const handleBatchExport = async () => {
    setBatchExporting(true)
    try {
      const result = await exportSeriesMerged(seriesId!)
      if (!result.cancelled) {
        toast.success(result.usedTemplate ? result.message : `${result.message} (${t.batch.batchExportNoTemplate})`)
      }
    } catch (e: any) {
      toast.error(e.message || 'Export failed')
    } finally {
      setBatchExporting(false)
    }
  }

  const handleDeleteChapterClick = async (chapter: Chapter) => {
    setDeleteChapterTarget(chapter)
    try {
      await getChapterDeleteInfo(seriesId!, chapter.id)
      setDeleteChapterDetails(['Konten bab dan terjemahannya'])
    } catch {
      setDeleteChapterDetails(['Konten bab dan terjemahannya'])
    }
  }

  const handleDeleteChapterConfirm = async () => {
    if (!seriesId || !deleteChapterTarget) return
    setDeleteChapterLoading(true)
    try {
      await deleteChapter(seriesId, deleteChapterTarget.id)
      setChapters((prev) => prev.filter((c) => c.id !== deleteChapterTarget.id))
      setDeleteChapterTarget(null)
      toast.success('✓')
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setDeleteChapterLoading(false)
    }
  }

  // Glossary CRUD
  const handleAddGlossary = async (sourceTerm: string, translatedTerm: string, notes: string) => {
    if (!seriesId) return
    setAddGlossaryLoading(true)
    try {
      const entry = await addGlossaryEntry(seriesId, sourceTerm, translatedTerm, notes)
      setGlossary((prev) => [...prev, entry])
      toast.success('✓')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.saveFailed)
      throw new Error('add failed')
    } finally {
      setAddGlossaryLoading(false)
    }
  }

  const handleAddAlias = async (entry: GlossaryEntry, alias: string) => {
    if (!seriesId) return
    try {
      const updated = await addGlossaryAlias(seriesId, entry.id, alias)
      setGlossary((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.saveFailed)
    }
  }

  const handleRemoveAlias = async (entry: GlossaryEntry, alias: string) => {
    if (!seriesId) return
    try {
      const updated = await removeGlossaryAlias(seriesId, entry.id, alias)
      setGlossary((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.saveFailed)
    }
  }

  const handleEditGlossary = async (
    entry: GlossaryEntry,
    sourceTerm: string,
    translatedTerm: string,
    notes: string
  ) => {
    if (!seriesId) return
    try {
      const updated = await updateGlossaryEntry(seriesId, entry.id, sourceTerm, translatedTerm, notes)
      setGlossary((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
      toast.success('✓')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.saveFailed)
    }
  }

  const handleApplyPrepass = async (terms: ProposedTerm[]) => {
    if (!seriesId) return
    let added = 0
    let skipped = 0
    for (const t of terms) {
      try {
        const entry = await addGlossaryEntry(seriesId, t.sourceTerm, t.translatedTerm, t.notes)
        setGlossary((prev) => [...prev, entry])
        added++
      } catch {
        skipped++ // duplicate or rejected source term
      }
    }
    if (added > 0) toast.success(`✓ ${added}${skipped > 0 ? ` (${skipped} dilewati)` : ''}`)
    else toast.error(skipped > 0 ? `${skipped} term dilewati (duplikat/ditolak)` : 'Tidak ada term ditambahkan')
  }

  const handleImportGlossary = async (
    entries: Array<{ sourceTerm: string; translatedTerm: string; notes: string; aliases?: string[] }>
  ) => {
    if (!seriesId) return
    let added = 0
    let skipped = 0
    for (const e of entries) {
      try {
        const entry = await addGlossaryEntry(seriesId, e.sourceTerm, e.translatedTerm, e.notes, e.aliases)
        setGlossary((prev) => [...prev, entry])
        added++
      } catch {
        skipped++
      }
    }
    if (added > 0) toast.success(`✓ ${added}${skipped > 0 ? ` (${skipped} skipped)` : ''}`)
    else if (skipped > 0) toast.error(`All ${skipped} entries already exist`)
  }

  const handleDeleteGlossaryConfirm = async () => {
    if (!seriesId || !deleteGlossaryTarget) return
    setDeleteGlossaryLoading(true)
    try {
      await deleteGlossaryEntry(seriesId, deleteGlossaryTarget.id)
      setGlossary((prev) => prev.filter((e) => e.id !== deleteGlossaryTarget.id))
      setDeleteGlossaryTarget(null)
      toast.success('✓')
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setDeleteGlossaryLoading(false)
    }
  }

  // Select mode handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleEnterSelectMode = () => {
    setSelectMode(true)
    setSelectedIds(new Set())
  }

  const handleExitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleTranslateSelected = () => {
    if (selectedIds.size === 0) {
      toast.info(t.batch.noSelection)
      return
    }
    const sorted = chapters
      .filter(c => selectedIds.has(c.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(c => c.id)
    startSelectedBatch(sorted)
    handleExitSelectMode()
  }

  const handleDeleteSelectedConfirm = async () => {
    if (!seriesId || selectedIds.size === 0) return
    setDeletingSelected(true)
    try {
      for (const id of selectedIds) {
        await deleteChapter(seriesId, id)
      }
      setChapters(prev => prev.filter(c => !selectedIds.has(c.id)))
      toast.success(`✓ ${selectedIds.size} bab dihapus`)
      setDeleteSelectedOpen(false)
      handleExitSelectMode()
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setDeletingSelected(false)
    }
  }

  const pendingCount = chapters.filter(c => c.status === 'pending').length
  const errorCount = chapters.filter(c => c.status === 'error').length
  const doneCount = chapters.filter(c => c.status === 'done').length
  const toggleTools = () => setToolsOpen(open => {
    try { localStorage.setItem(TOOLS_OPEN_KEY, open ? '0' : '1') } catch { /* storage unavailable */ }
    return !open
  })

  if (loading) {
    return (
      <div className="app-layout">
        <Topbar showBack title={t.common.loading} />
        <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
          <p style={{ color: 'var(--color-text-subtle)' }}>{t.common.loading}</p>
        </main>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="app-layout">
        <Topbar showBack title={t.chapter.notFound} />
        <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
          <p style={{ color: 'var(--color-text-subtle)' }}>{t.chapter.notFound}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Topbar showBack title={series.title} subtitle={t.topbar.settings} />

      <main
        className="workspace-layout flex-1 overflow-hidden p-4 gap-4"
        style={{ backgroundColor: 'var(--color-bg)', display: 'flex' }}
      >
        {/* Left: batch actions, chapter list (takes the free height), series tools */}
        <div className="chapter-sidebar flex flex-col gap-2 overflow-y-auto" style={{ minHeight: 0 }}>

          {!selectMode ? (
            /* Normal mode: Translate All, Retry Failed (if any), Run agent + Select */
            <div className="flex flex-col gap-1.5">
              <Button variant="default"
                onClick={() => startBatch(chapters)}
                disabled={isBatchActive || pendingCount === 0}
                className="w-full gap-2 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={15} />
                {t.batch.title}
                <span className="text-xs font-normal opacity-80">({pendingCount} {t.home.chapters})</span>
              </Button>
              {errorCount > 0 && (
                <Button variant="outline" size="sm"
                  onClick={() => {
                    const ids = chapters.filter(c => c.status === 'error').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(c => c.id)
                    startSelectedBatch(ids)
                  }}
                  disabled={isBatchActive}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  <RefreshCw size={13} />
                  {t.batch.retryFailed}
                  <span className="font-normal">({errorCount})</span>
                </Button>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <Button aria-label={t.agent.buttonTitle} variant="outline" size="sm"
                  onClick={() => setShowAgentRun(true)}
                  disabled={isBatchActive || doneCount === 0}
                  title={t.agent.buttonTitle}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Bot size={13} />
                  {t.agent.button}
                </Button>
                <Button variant="outline" size="sm"
                  onClick={handleEnterSelectMode}
                  disabled={isBatchActive || chapters.length === 0}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <CheckSquare size={13} />
                  {t.batch.selectChapter}
                </Button>
              </div>
            </div>
          ) : (
            /* Select mode: Translate Selected + Delete Selected + Cancel */
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="default" size="sm"
                  onClick={handleTranslateSelected}
                  disabled={isBatchActive || selectedIds.size === 0}
                  className="gap-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  <Play size={12} />
                  {t.batch.translateSelected}
                  {selectedIds.size > 0 && <span className="font-normal">({selectedIds.size})</span>}
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => { if (selectedIds.size > 0) setDeleteSelectedOpen(true) }}
                  disabled={selectedIds.size === 0}
                  className="gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--fg-red,#C62828)' }}
                >
                  <Trash2 size={12} />
                  {t.batch.deleteSelected}
                  {selectedIds.size > 0 && <span className="font-normal">({selectedIds.size})</span>}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="flex-1" style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
                  {selectedIds.size > 0
                    ? t.batch.selectedCount.replace('{count}', String(selectedIds.size))
                    : 'Klik bab untuk memilih'}
                </p>
                <Button variant="ghost" size="xs" onClick={handleExitSelectMode} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <X size={12} /> {t.batch.cancelSelect}
                </Button>
              </div>
            </div>
          )}

          <ChapterList
            seriesId={seriesId!}
            chapters={chapters}
            onAddChapter={() => setCreateChapterOpen(true)}
            onEditChapter={setEditChapter}
            onDeleteChapter={handleDeleteChapterClick}
            onExportChapter={handleExportChapter}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />

          {/* Series tools: one compact list instead of a stack of large buttons */}
          <div className="shrink-0 overflow-hidden" style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <button type="button" onClick={toggleTools} aria-expanded={toolsOpen}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-(--color-surface-2)"
              style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: toolsOpen ? '1px solid var(--color-separator)' : 'none' }}
            >
              <span className="flex-1">{t.seriesSettings.tools}</span>
              {!toolsOpen && inconsistencyCount > 0 && <span className="size-1.5 rounded-full" style={{ backgroundColor: 'var(--fg-red,#C62828)' }} />}
              <ChevronDown size={14} style={{ transform: toolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>
            {toolsOpen && (
              <div className="grid grid-cols-2 gap-0.5 p-1">
                <ToolRow icon={<ShieldCheck size={14} />} color="var(--fg-cyan,#00838F)" label="QA scan"
                  title="Periksa seluruh terjemahan tanpa AI: sisa huruf Jepang, omisi, varian nama, ejaan, dan lainnya"
                  onClick={() => setShowQa(true)} disabled={doneCount === 0} />
                <ToolRow icon={<ScanSearch size={14} />} color="var(--fg-green,#2E7D32)" label="Pre-pass terms"
                  title="Pindai raw semua chapter untuk mengunci istilah sebelum menerjemahkan"
                  onClick={() => setShowPrepass(true)} />
                <ToolRow icon={<ImageIcon size={14} />} color="var(--fg-blue,#1565C0)" label="Image source"
                  title="Tetapkan folder gambar untuk mengisi Image Placeholder"
                  onClick={() => setShowImageFolder(true)} />
                <ToolRow icon={<BookOpen size={14} />} color="var(--fg-purple,#6A1B9A)" label="All terms"
                  count={chapters.reduce((n, c) => n + (c.glossaryUpdates?.entries?.length ?? 0), 0)}
                  alert={inconsistencyCount > 0 ? `!${inconsistencyCount}` : undefined}
                  alertTitle={`${inconsistencyCount} ${inconsistencyCount === 1 ? 'inconsistency' : 'inconsistencies'} detected`}
                  onClick={() => setShowAllTerms(true)} />
                <ToolRow icon={<Brain size={14} />} color="var(--fg-orange,#B45309)" label={t.memory.title}
                  count={series.memory?.length || 0} expanded={showMemory}
                  onClick={() => setShowMemory(!showMemory)} />
                <ToolRow icon={<ScrollText size={14} />} color="var(--color-text-muted)" label="Logs"
                  count={seriesLogLines.length || undefined} expanded={showLogs}
                  onClick={() => setShowLogs(!showLogs)} />
                {showMemory && (
                  <div className="col-span-2 mx-1 mb-1 max-h-40 overflow-y-auto" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--color-separator)' }}>
                    <MemoryPanel memories={series.memory || []} />
                  </div>
                )}
                {showLogs && (
                  <div className="col-span-2 mx-1 mb-1 max-h-40 overflow-y-auto" style={{ borderRadius: 'var(--radius)', backgroundColor: 'var(--muted)', padding: '8px' }}>
                    {seriesLogLines.length === 0 ? (
                      <p style={{ fontSize: '10px', color: 'var(--fg-muted,#666)', fontFamily: 'monospace', margin: 0 }}>
                        No logs yet.
                      </p>
                    ) : (
                      seriesLogLines.map((line, i) => (
                        <p key={i} style={{ fontSize: '10px', color: 'var(--fg-subtle,#aaa)', fontFamily: 'monospace', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {line}
                        </p>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>
                )}
                <ToolRow icon={<BookText size={14} />} color="var(--fg-cyan,#00838F)" label="Rolling memory" wide
                  count={`${chapters.filter(c => c.summary).length}/${chapters.length}`}
                  onClick={() => setShowRollingMemory(true)} />
                <ToolRow icon={<FileDown size={14} />} color="var(--color-text-muted)"
                  label={batchExporting ? '...' : t.batch.batchExport} title={t.batch.batchExportTitle}
                  count={doneCount} onClick={handleBatchExport} disabled={batchExporting || doneCount === 0} />
                <ToolRow icon={<FileType2 size={14} />} color="var(--fg-blue,#1565C0)" label="Template DOCX"
                  title="Pilih template Word untuk ekspor series ini"
                  onClick={() => setShowDocTemplate(true)} />
              </div>
            )}
          </div>
        </div>

        {/* Center: Prompt/Model Panel */}
        <div className="flex-1" style={{ minWidth: 0 }}>
          <PromptModelPanel
            config={config}
            series={series}
            instructions={instructions}
            onInstructionsChange={setInstructions}
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            onSave={handleSaveSettings}
            workerStatuses={workerStatuses}
            loading={saveLoading}
          />
        </div>

        {/* Right: Glossary Table */}
        <div className="glossary-column">
          <GlossaryTable
            entries={glossary}
            seriesId={seriesId!}
            onAdd={handleAddGlossary}
            onEdit={handleEditGlossary}
            onDelete={setDeleteGlossaryTarget}
            onImport={handleImportGlossary}
            onAddAlias={handleAddAlias}
            onRemoveAlias={handleRemoveAlias}
          />
        </div>
      </main>

      {/* Modals */}
      <CreateChapterModal
        open={createChapterOpen}
        onClose={() => setCreateChapterOpen(false)}
        onSubmit={handleCreateChapter}
        onBulkSubmit={handleBulkCreateChapter}
        nextChapterNumber={nextChapterNumber}
        loading={createChapterLoading}
      />

      <EditChapterModal
        open={!!editChapter}
        onClose={() => setEditChapter(null)}
        onSubmit={handleEditChapter}
        chapter={editChapter}
        loading={editChapterLoading}
      />

      <DeleteConfirmModal
        open={!!deleteChapterTarget}
        onClose={() => setDeleteChapterTarget(null)}
        onConfirm={handleDeleteChapterConfirm}
        title={t.common.delete}
        entityType="chapter"
        entityName={deleteChapterTarget ? `Bab ${deleteChapterTarget.chapterNumber}${deleteChapterTarget.title ? `: ${deleteChapterTarget.title}` : ''}` : ''}
        details={deleteChapterDetails}
        loading={deleteChapterLoading}
      />

      <DeleteConfirmModal
        open={!!deleteGlossaryTarget}
        onClose={() => setDeleteGlossaryTarget(null)}
        onConfirm={handleDeleteGlossaryConfirm}
        title={t.common.delete}
        entityType="glossary"
        entityName={deleteGlossaryTarget?.sourceTerm || ''}
        details={['Entri glossary ini']}
        loading={deleteGlossaryLoading}
      />

      {/* Delete Selected Confirm */}
      <DeleteConfirmModal
        open={deleteSelectedOpen}
        onClose={() => setDeleteSelectedOpen(false)}
        onConfirm={handleDeleteSelectedConfirm}
        title={t.batch.confirmDeleteSelected}
        entityType="chapter"
        entityName={t.batch.confirmDeleteSelectedMsg.replace('{count}', String(selectedIds.size))}
        details={[]}
        loading={deletingSelected}
      />

      {/* Image Source Modal */}
      <DocTemplateModal
        open={showDocTemplate}
        onClose={() => setShowDocTemplate(false)}
        series={series}
        onSeriesUpdated={(s) => setSeries(s)}
      />

      <ImageFolderModal
        open={showImageFolder}
        onClose={() => setShowImageFolder(false)}
        series={series}
        onSeriesUpdated={(s) => setSeries(s)}
        onSynced={async () => {
          if (seriesId) setChapters(await getChapters(seriesId))
        }}
      />

      {/* Terminology Pre-Pass Modal */}
      <TerminologyPrepassModal
        open={showPrepass}
        onClose={() => setShowPrepass(false)}
        seriesId={seriesId!}
        workerId={series?.workerId}
        chapterCount={chapters.length}
        onApply={handleApplyPrepass}
      />

      {/* Agent Run Modal */}
      <AgentRunModal
        open={showAgentRun}
        onClose={() => setShowAgentRun(false)}
        seriesId={seriesId!}
        onRestored={() => { if (seriesId) getChapters(seriesId).then(setChapters).catch(() => {}) }}
        chapters={chapters}
        onStart={(opts) => startAgent(chapters.filter(c => c.status === 'done').length, opts)}
      />

      {/* QA Report Modal */}
      <QaReportModal
        open={showQa}
        onClose={() => setShowQa(false)}
        seriesId={seriesId!}
        disabled={isBatchActive}
        onApplied={() => {
          if (!seriesId) return
          getChapters(seriesId).then(setChapters).catch(() => {})
          getGlossary(seriesId).then(setGlossary).catch(() => {})
        }}
      />

      {/* Rolling Memory Modal */}
      <RollingMemoryModal
        open={showRollingMemory}
        onClose={() => setShowRollingMemory(false)}
        seriesId={seriesId!}
        chapters={chapters}
        onChapterUpdated={(updated) => setChapters(prev => prev.map(c => c.id === updated.id ? updated : c))}
      />

      {/* All Extracted Terms Modal */}
      <AllTermsModal
        open={showAllTerms}
        onClose={() => setShowAllTerms(false)}
        chapters={chapters}
        seriesGlossary={glossary}
      />

      {/* Batch Translation Overlay */}
      <BatchTranslationPanel seriesId={seriesId!} chapters={chapters} onCancel={cancelBatch} />

      {/* CJK Detector bubble */}
      <CJKBubble incidents={cjkIncidents} workerId={series?.workerId} />
    </div>
  )
}

const TOOLS_OPEN_KEY = 'lwntl.seriesToolsOpen'

/** One row of the series tools list: icon, label, optional count and alert pill. */
function ToolRow({ icon, color, label, title, count, alert, alertTitle, expanded, wide, onClick, disabled }: {
  icon: ReactNode
  color: string
  label: string
  title?: string
  count?: number | string
  alert?: string
  alertTitle?: string
  expanded?: boolean
  wide?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled} title={title ?? (count !== undefined ? `${label} (${count})` : label)} aria-label={title}
      aria-expanded={expanded}
      className={`h-8 w-full min-w-0 justify-start gap-1.5 px-1.5 text-xs font-medium disabled:opacity-40 ${wide ? 'col-span-2' : ''}`}
      style={{ color: 'var(--color-text)', backgroundColor: expanded ? 'var(--color-surface-2)' : undefined }}
    >
      <span className="flex shrink-0" style={{ color }}>{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {alert && (
        <span title={alertTitle} className="rounded-full px-1.5" style={{ fontSize: '10px', fontWeight: 650, lineHeight: '16px', backgroundColor: 'var(--bg-red,#FFE0E0)', color: 'var(--fg-red,#C62828)' }}>
          {alert}
        </span>
      )}
      {count !== undefined && <span className="shrink-0 tabular-nums" style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-text-muted)' }}>{count}</span>}
    </Button>
  )
}
