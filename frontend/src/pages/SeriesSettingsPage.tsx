/**
 * LWNTL Series Settings Page
 * 3-panel layout: Chapter list | Prompt/Model | Glossary
 */

import { useState, useEffect, useCallback } from 'react'
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
import { useToast } from '../hooks/useToast'
import { useBatchTranslation } from '../hooks/useBatchTranslation'
import { Play, Brain, CheckSquare, Trash2, X, RefreshCw } from 'lucide-react'
import {
  getAllSeries,
  getChapters,
  getGlossary,
  createChapter,
  updateChapter,
  deleteChapter,
  getChapterDeleteInfo,
  addGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  saveConfig,
  saveInstructions,
  updateSeries,
} from '../api'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import type { Series, Chapter, GlossaryEntry, AppConfig } from '../types'

export function SeriesSettingsPage() {
  const { id: seriesId } = useParams<{ id: string }>()
  const toast = useToast()
  const { t } = useI18n()
  const { config, setConfig, apiReady } = useAppStore()
  const { isBatchActive, startBatch, startSelectedBatch, cancelBatch } = useBatchTranslation(seriesId!)
  const [showMemory, setShowMemory] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)

  const [series, setSeries] = useState<Series | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])
  const [instructions, setInstructions] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)

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
      const [allSeries, chaps, gloss] = await Promise.all([
        getAllSeries(),
        getChapters(seriesId),
        getGlossary(seriesId),
      ])
      const s = allSeries.find((s) => s.id === seriesId) || null
      setSeries(s)
      setChapters(chaps)
      setGlossary(gloss)
      setInstructions(s?.instructions || '')
      setSystemPrompt(s?.systemPrompt || '')
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setLoading(false)
    }
  }, [seriesId])

  useEffect(() => {
    if (apiReady) loadData()
  }, [apiReady, loadData])

  // Save config + instructions + systemPrompt
  const handleSaveSettings = async (newConfig: AppConfig, newInstructions: string, newSystemPrompt: string) => {
    if (!seriesId || !series) return
    setSaveLoading(true)
    try {
      await saveConfig(newConfig)
      setConfig(newConfig)

      await saveInstructions(seriesId, newInstructions)
      setInstructions(newInstructions)

      await updateSeries(seriesId, series.title, series.sourceLanguage, series.targetLanguage, newSystemPrompt)
      setSystemPrompt(newSystemPrompt)
      setSeries((prev) => prev ? { ...prev, systemPrompt: newSystemPrompt, instructions: newInstructions } : prev)

      toast.success(t.seriesSettings.saveSuccess)
    } catch {
      toast.error(t.seriesSettings.saveFailed)
    } finally {
      setSaveLoading(false)
    }
  }

  // Chapter CRUD
  const nextChapterNumber =
    chapters.length > 0 ? Math.max(...chapters.map((c) => c.chapterNumber)) + 1 : 1

  const handleCreateChapter = async (number: number, title: string, rawContent: string) => {
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

  const handleBulkCreateChapter = async (bulk: { number: number; title: string; rawContent: string }[]) => {
    if (!seriesId) return
    try {
      for (const ch of bulk) {
        await createChapter(seriesId, ch.number, ch.title, ch.rawContent)
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

  const handleEditChapter = async (chapterId: string, number: number, title: string, rawContent: string) => {
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
    } catch {
      toast.error(t.settings.saveFailed)
      throw new Error('add failed')
    } finally {
      setAddGlossaryLoading(false)
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
    } catch {
      toast.error(t.settings.saveFailed)
    }
  }

  const handleImportGlossary = async (
    entries: Array<{ sourceTerm: string; translatedTerm: string; notes: string }>
  ) => {
    if (!seriesId) return
    let added = 0
    try {
      for (const e of entries) {
        const entry = await addGlossaryEntry(seriesId, e.sourceTerm, e.translatedTerm, e.notes)
        setGlossary((prev) => [...prev, entry])
        added++
      }
      toast.success(`✓ ${added}`)
    } catch {
      toast.error(t.settings.saveFailed)
    }
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
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
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
        className="flex-1 overflow-hidden p-4 gap-4"
        style={{ backgroundColor: 'var(--color-bg)', display: 'flex' }}
      >
        {/* Left: Chapter List */}
        <div className="flex flex-col gap-2" style={{ minWidth: '240px', maxWidth: '280px' }}>

          {!selectMode ? (
            /* Normal mode: Translate All + Retry Failed (if any) + Select */
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => startBatch(chapters)}
                disabled={isBatchActive || chapters.filter(c => c.status === 'pending').length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 font-bold text-sm border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#28E272] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#111] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_#111] transition-all"
              >
                <Play size={16} />
                {t.batch.title}
                <span className="text-xs font-normal">
                  ({chapters.filter(c => c.status === 'pending').length} {t.home.chapters})
                </span>
              </button>
              {chapters.filter(c => c.status === 'error').length > 0 && (
                <button
                  onClick={() => {
                    const ids = chapters.filter(c => c.status === 'error').sort((a, b) => a.chapterNumber - b.chapterNumber).map(c => c.id)
                    startSelectedBatch(ids)
                  }}
                  disabled={isBatchActive}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 font-bold text-xs border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#FF3C3C] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#111] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ color: '#fff' }}
                >
                  <RefreshCw size={13} />
                  {t.batch.retryFailed}
                  <span className="font-normal">({chapters.filter(c => c.status === 'error').length})</span>
                </button>
              )}
              <button
                onClick={handleEnterSelectMode}
                disabled={isBatchActive || chapters.length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 font-bold text-xs border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-(--color-surface) hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#111] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ color: 'var(--color-text)' }}
              >
                <CheckSquare size={13} />
                {t.batch.selectChapter}
              </button>
            </div>
          ) : (
            /* Select mode: Translate Selected + Delete Selected + Cancel */
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <button
                  onClick={handleTranslateSelected}
                  disabled={isBatchActive || selectedIds.size === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 font-bold text-xs border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#28E272] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#111] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ color: '#111' }}
                >
                  <Play size={12} />
                  {t.batch.translateSelected}
                  {selectedIds.size > 0 && <span className="font-normal">({selectedIds.size})</span>}
                </button>
                <button
                  onClick={() => { if (selectedIds.size > 0) setDeleteSelectedOpen(true) }}
                  disabled={selectedIds.size === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 font-bold text-xs border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#FF3C3C] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#111] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ color: '#fff' }}
                >
                  <Trash2 size={12} />
                  {t.batch.deleteSelected}
                  {selectedIds.size > 0 && <span className="font-normal">({selectedIds.size})</span>}
                </button>
              </div>
              <button
                onClick={handleExitSelectMode}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 font-bold text-xs border-2 border-(--color-border) bg-transparent hover:bg-(--color-surface-2) transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={12} /> {t.batch.cancelSelect}
              </button>
              {/* Selection count indicator */}
              <p style={{ fontSize: '11px', textAlign: 'center', color: 'var(--color-text-muted)', margin: 0 }}>
                {selectedIds.size > 0
                  ? t.batch.selectedCount.replace('{count}', String(selectedIds.size))
                  : 'Klik bab untuk memilih'}
              </p>
            </div>
          )}

          <ChapterList
            seriesId={seriesId!}
            chapters={chapters}
            onAddChapter={() => setCreateChapterOpen(true)}
            onEditChapter={setEditChapter}
            onDeleteChapter={handleDeleteChapterClick}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />

          {/* Memory toggle */}
          <button
            onClick={() => setShowMemory(!showMemory)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#FFEF33] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#111] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
          >
            <Brain size={14} />
            {t.memory.title} ({series.memory?.length || 0})
          </button>

          {showMemory && (
            <div className="border-2.5 border-[#111] bg-white max-h-48 overflow-y-auto">
              <MemoryPanel memories={series.memory || []} />
            </div>
          )}
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
            loading={saveLoading}
          />
        </div>

        {/* Right: Glossary Table */}
        <div style={{ minWidth: '300px', maxWidth: '380px' }}>
          <GlossaryTable
            entries={glossary}
            seriesId={seriesId!}
            onAdd={handleAddGlossary}
            onEdit={handleEditGlossary}
            onDelete={setDeleteGlossaryTarget}
            onImport={handleImportGlossary}
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
        entityName={deleteChapterTarget ? `Bab ${deleteChapterTarget.chapterNumber}${deleteChapterTarget.title ? ` — ${deleteChapterTarget.title}` : ''}` : ''}
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

      {/* Batch Translation Overlay */}
      <BatchTranslationPanel chapters={chapters} onCancel={cancelBatch} />
    </div>
  )
}