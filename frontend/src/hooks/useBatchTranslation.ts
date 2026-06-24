/**
 * LWNTL Batch Translation Hook
 * Manages batch translation state and events — scoped per seriesId
 */

import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { startBatchTranslation, cancelTranslation } from '../api'
import type { BatchStatusEvent, Chapter } from '../types'

export function useBatchTranslation(seriesId: string) {
  const batches = useAppStore((s) => s.batches)
  const setBatchForSeries = useAppStore((s) => s.setBatchForSeries)
  const addToast = useAppStore((s) => s.addToast)

  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  const batch = batches[seriesId] ?? null

  // Listen for batch events — only show toasts for this series.
  // Store updates are handled by App.tsx onBatchStatus.
  useEffect(() => {
    const onBatchStatus = (event: Event) => {
      const data = (event as CustomEvent<BatchStatusEvent>).detail
      if (data.seriesId && data.seriesId !== seriesId) return

      if (data.status === 'done') {
        addToastRef.current({
          type: 'success',
          message: `Batch selesai! ${data.completed}/${data.total} bab diterjemahkan.`,
        })
      } else if (data.status === 'cancelled') {
        addToastRef.current({
          type: 'info',
          message: `Batch dibatalkan. ${data.completed}/${data.total} selesai.`,
        })
      }
    }

    window.addEventListener('lwntl:batch-status', onBatchStatus)
    return () => window.removeEventListener('lwntl:batch-status', onBatchStatus)
  }, [seriesId])

  // Translate All: only pending chapters, no force
  const startBatch = useCallback(async (chapters: Chapter[]) => {
    const pendingChapters = chapters
      .filter((ch) => ch.status === 'pending')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((ch) => ch.id)

    if (pendingChapters.length === 0) {
      addToastRef.current({ type: 'info', message: 'Tidak ada bab yang perlu diterjemahkan.' })
      return
    }

    try {
      setBatchForSeries(seriesId, { seriesId, status: 'translating', current: 0, total: pendingChapters.length, completed: 0 })
      await startBatchTranslation(seriesId, pendingChapters, false)
      addToastRef.current({ type: 'info', message: `Batch dimulai: ${pendingChapters.length} bab.` })
    } catch (e: any) {
      addToastRef.current({ type: 'error', message: `Gagal memulai batch: ${e.message}` })
      setBatchForSeries(seriesId, null)
    }
  }, [seriesId, setBatchForSeries])

  // Translate Selected: explicit IDs, force=true, archive previous
  const startSelectedBatch = useCallback(async (chapterIds: string[]) => {
    if (chapterIds.length === 0) return

    try {
      setBatchForSeries(seriesId, { seriesId, status: 'translating', current: 0, total: chapterIds.length, completed: 0 })
      await startBatchTranslation(seriesId, chapterIds, true, true)
      addToastRef.current({ type: 'info', message: `Batch dimulai: ${chapterIds.length} bab dipilih.` })
    } catch (e: any) {
      addToastRef.current({ type: 'error', message: `Gagal memulai batch: ${e.message}` })
      setBatchForSeries(seriesId, null)
    }
  }, [seriesId, setBatchForSeries])

  const cancelBatch = useCallback(async () => {
    try {
      await cancelTranslation(seriesId)
      setBatchForSeries(seriesId, null)
    } catch (e: any) {
      addToastRef.current({ type: 'error', message: `Gagal membatalkan batch: ${e.message}` })
    }
  }, [seriesId, setBatchForSeries])

  const isBatchActive = batch?.status === 'translating'

  return {
    batch,
    isBatchActive,
    startBatch,
    startSelectedBatch,
    cancelBatch,
  }
}
