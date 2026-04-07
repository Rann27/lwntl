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
import { Play, Brain } from 'lucide-react'
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
import type { Series, Chapter, GlossaryEntry, AppConfig } from '../types'

export function SeriesSettingsPage() {
  const { id: seriesId } = useParams<{ id: string }>()
  const toast = useToast()
  const { config, setConfig, apiReady } = useAppStore()
  const { isBatchActive, startBatch, cancelBatch } = useBatchTranslation(seriesId!)
  const [showMemory, setShowMemory] = useState(false)

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
      toast.error('Gagal memuat data series')
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

      toast.success('Pengaturan berhasil disimpan!')
    } catch {
      toast.error('Gagal menyimpan pengaturan')
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
      toast.success(`Bab ${number} berhasil dibuat!`)
    } catch {
      toast.error('Gagal membuat bab')
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
      toast.success(`${bulk.length} bab berhasil ditambahkan!`)
    } catch {
      toast.error('Gagal menambahkan bab')
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
      toast.success('Bab berhasil diperbarui!')
    } catch {
      toast.error('Gagal memperbarui bab')
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
      toast.success('Bab berhasil dihapus')
    } catch {
      toast.error('Gagal menghapus bab')
    } finally {
      setDeleteChapterLoading(false)
    }
  }

  // Glossary CRUD
  const handleAddGlossary = async () => {
    if (!seriesId) return
    setAddGlossaryLoading(true)
    try {
      const entry = await addGlossaryEntry(seriesId, '', '', '')
      setGlossary((prev) => [...prev, entry])
      toast.success('Entri glossary ditambahkan')
    } catch {
      toast.error('Gagal menambahkan entri')
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
      toast.success('Entri glossary diperbarui')
    } catch {
      toast.error('Gagal memperbarui entri')
    }
  }

  const handleDeleteGlossaryConfirm = async () => {
    if (!seriesId || !deleteGlossaryTarget) return
    setDeleteGlossaryLoading(true)
    try {
      await deleteGlossaryEntry(seriesId, deleteGlossaryTarget.id)
      setGlossary((prev) => prev.filter((e) => e.id !== deleteGlossaryTarget.id))
      setDeleteGlossaryTarget(null)
      toast.success('Entri glossary dihapus')
    } catch {
      toast.error('Gagal menghapus entri')
    } finally {
      setDeleteGlossaryLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="app-layout">
        <Topbar showBack title="Memuat..." />
        <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F8F3EA' }}>
          <p style={{ color: '#999' }}>Memuat data...</p>
        </main>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="app-layout">
        <Topbar showBack title="Tidak Ditemukan" />
        <main className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F8F3EA' }}>
          <p style={{ color: '#999' }}>Series tidak ditemukan</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Topbar showBack title={series.title} subtitle="Pengaturan" />

      <main
        className="flex-1 overflow-hidden p-4 gap-4"
        style={{ backgroundColor: '#F8F3EA', display: 'flex' }}
      >
        {/* Left: Chapter List */}
        <div className="flex flex-col gap-2" style={{ minWidth: '240px', maxWidth: '280px' }}>
          {/* Batch translate button */}
          <button
            onClick={() => startBatch(chapters)}
            disabled={isBatchActive || chapters.filter(c => c.status === 'pending').length === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 font-bold text-sm border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#28E272] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_#111] transition-all"
          >
            <Play size={16} />
            BATCH TERJEMAHKAN
            <span className="text-xs font-normal">
              ({chapters.filter(c => c.status === 'pending').length} bab)
            </span>
          </button>

          <ChapterList
            seriesId={seriesId!}
            chapters={chapters}
            onAddChapter={() => setCreateChapterOpen(true)}
            onEditChapter={setEditChapter}
            onDeleteChapter={handleDeleteChapterClick}
          />

          {/* Memory toggle */}
          <button
            onClick={() => setShowMemory(!showMemory)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold border-2.5 border-[#111] shadow-[4px_4px_0px_#111] bg-[#FFEF33] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#111] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
          >
            <Brain size={14} />
            MEMORY ({series.memory?.length || 0})
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
        title="Hapus Bab"
        entityType="chapter"
        entityName={deleteChapterTarget ? `Bab ${deleteChapterTarget.chapterNumber}${deleteChapterTarget.title ? ` — ${deleteChapterTarget.title}` : ''}` : ''}
        details={deleteChapterDetails}
        loading={deleteChapterLoading}
      />

      <DeleteConfirmModal
        open={!!deleteGlossaryTarget}
        onClose={() => setDeleteGlossaryTarget(null)}
        onConfirm={handleDeleteGlossaryConfirm}
        title="Hapus Entri"
        entityType="glossary"
        entityName={deleteGlossaryTarget?.sourceTerm || ''}
        details={['Entri glossary ini']}
        loading={deleteGlossaryLoading}
      />

      {/* Batch Translation Overlay */}
      <BatchTranslationPanel chapters={chapters} onCancel={cancelBatch} />
    </div>
  )
}