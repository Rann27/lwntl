/**
 * LWNTL Home Page
 * Series collection grid with CRUD operations
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Topbar } from '../components/Topbar'
import { SeriesCard } from '../components/SeriesCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { CreateSeriesModal } from '../components/CreateSeriesModal'
import { EditSeriesModal } from '../components/EditSeriesModal'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import { useToast } from '../hooks/useToast'
import { getAllSeries, createSeries, updateSeries, deleteSeries, getSeriesDeleteInfo, getChapters } from '../api'
import { useAppStore } from '../store/appStore'
import type { Series, Chapter } from '../types'

export function HomePage() {
  const toast = useToast()
  const { apiReady, config } = useAppStore()
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [chaptersMap, setChaptersMap] = useState<Record<string, Chapter[]>>({})
  const [loading, setLoading] = useState(true)

  // Modal states
  const [createOpen, setCreateOpen] = useState(false)
  const [editSeries, setEditSeries] = useState<Series | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null)
  const [deleteDetails, setDeleteDetails] = useState<string[]>([])
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // Load data
  const loadData = useCallback(async () => {
    try {
      const series = await getAllSeries()
      setSeriesList(series)

      // Load chapters for each series
      const chMap: Record<string, Chapter[]> = {}
      await Promise.all(
        series.map(async (s) => {
          try {
            chMap[s.id] = await getChapters(s.id)
          } catch {
            chMap[s.id] = []
          }
        })
      )
      setChaptersMap(chMap)
    } catch (err: any) {
      toast.error('Gagal memuat data series')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (apiReady) loadData()
  }, [apiReady, loadData])

  // Create series
  const handleCreate = async (title: string, language: string, targetLanguage: string) => {
    setCreateLoading(true)
    try {
      const newSeries = await createSeries(title, language, targetLanguage)
      setSeriesList((prev) => [...prev, newSeries])
      setChaptersMap((prev) => ({ ...prev, [newSeries.id]: [] }))
      setCreateOpen(false)
      toast.success(`Series "${title}" berhasil dibuat!`)
    } catch (err: any) {
      toast.error('Gagal membuat series')
    } finally {
      setCreateLoading(false)
    }
  }

  // Edit series
  const handleEdit = async (seriesId: string, title: string, language: string, targetLanguage?: string, systemPrompt?: string) => {
    setEditLoading(true)
    try {
      const updated = await updateSeries(seriesId, title, language, targetLanguage, systemPrompt)
      setSeriesList((prev) => prev.map((s) => (s.id === seriesId ? updated : s)))
      setEditSeries(null)
      toast.success('Series berhasil diperbarui!')
    } catch {
      toast.error('Gagal memperbarui series')
    } finally {
      setEditLoading(false)
    }
  }

  // Delete series
  const handleDeleteClick = async (series: Series) => {
    setDeleteTarget(series)
    try {
      const info = await getSeriesDeleteInfo(series.id)
      setDeleteDetails([`${info.chapterCount} bab beserta terjemahannya`])
    } catch {
      setDeleteDetails(['Semua bab beserta terjemahannya'])
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteSeries(deleteTarget.id)
      setSeriesList((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Series berhasil dihapus')
    } catch {
      toast.error('Gagal menghapus series')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="app-layout">
      <Topbar />

      <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg, #F8F3EA)' }}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '24px',
              color: 'var(--color-text)',
              letterSpacing: '1px',
            }}
          >
            KOLEKSI SERIES
          </h1>
          <button
            onClick={() => setCreateOpen(true)}
            className="neo-button flex items-center gap-2"
          >
            <Plus size={18} />
            TAMBAH SERIES
          </button>
        </div>

        {/* Series grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px',
          }}
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : seriesList.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20"
              style={{ gridColumn: '1 / -1' }}
            >
              <div
                className="flex items-center justify-center mb-4"
                style={{
                  width: '80px',
                  height: '80px',
                  border: '3px solid var(--color-border)',
                  boxShadow: 'var(--neo-shadow-lg)',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <Plus size={32} style={{ color: 'var(--color-text-subtle)' }} />
              </div>
              <h2
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '18px',
                  color: 'var(--color-text)',
                  marginBottom: '8px',
                }}
              >
                BELUM ADA SERIES
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                Mulai dengan menambahkan series pertama kamu
              </p>
              <button onClick={() => setCreateOpen(true)} className="neo-button flex items-center gap-2">
                <Plus size={16} />
                TAMBAH SERIES
              </button>
            </div>
          ) : (
            seriesList.map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                chapters={chaptersMap[series.id] || []}
                onEdit={setEditSeries}
                onDelete={handleDeleteClick}
              />
            ))
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateSeriesModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        config={config}
        loading={createLoading}
      />

      <EditSeriesModal
        open={!!editSeries}
        onClose={() => setEditSeries(null)}
        onSubmit={handleEdit}
        series={editSeries}
        config={config}
        loading={editLoading}
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Series"
        entityType="series"
        entityName={deleteTarget?.title || ''}
        details={deleteDetails}
        loading={deleteLoading}
      />
    </div>
  )
}