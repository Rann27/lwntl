/**
 * LWNTL Batch Translation Hook
 * Manages batch translation state and events
 */

import { useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { startBatchTranslation, cancelTranslation } from '../api'
import type { BatchStatusEvent, Chapter } from '../types'

export function useBatchTranslation(seriesId: string) {
  const batch = useAppStore((s) => s.batch)
  const setBatch = useAppStore((s) => s.setBatch)
  const addToast = useAppStore((s) => s.addToast)

  // Use ref for toast to avoid dependency issues
  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  // Register batch status callback
  useEffect(() => {
    const handleBatchStatus = (data: BatchStatusEvent) => {
      setBatch(data)

      if (data.status === 'done') {
        addToastRef.current({ type: 'success', message: `Batch selesai! ${data.completed}/${data.total} bab diterjemahkan.` })
      } else if (data.status === 'cancelled') {
        addToastRef.current({ type: 'info', message: `Batch dibatalkan. ${data.completed}/${data.total} selesai.` })
      }
    }

    ;(window as any).onBatchStatus = handleBatchStatus

    return () => {
      ;(window as any).onBatchStatus = undefined
    }
  }, [setBatch])

  // Translate All: only pending chapters, no force
  const startBatch = useCallback(async (chapters: Chapter[]) => {
    const pendingChapters = chapters
      .filter((ch) => ch.status === 'pending')
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map((ch) => ch.id)

    if (pendingChapters.length === 0) {
      addToastRef.current({ type: 'info', message: 'Tidak ada bab yang perlu diterjemahkan.' })
      return
    }

    try {
      setBatch({ status: 'translating', current: 0, total: pendingChapters.length, completed: 0 })
      await startBatchTranslation(seriesId, pendingChapters, false)
      addToastRef.current({ type: 'info', message: `Batch dimulai: ${pendingChapters.length} bab.` })
    } catch (e: any) {
      addToastRef.current({ type: 'error', message: `Gagal memulai batch: ${e.message}` })
      setBatch(null)
    }
  }, [seriesId, setBatch])

  // Translate Selected: explicit IDs, force=true (translate regardless of status)
  const startSelectedBatch = useCallback(async (chapterIds: string[]) => {
    if (chapterIds.length === 0) return

    try {
      setBatch({ status: 'translating', current: 0, total: chapterIds.length, completed: 0 })
      await startBatchTranslation(seriesId, chapterIds, true)
      addToastRef.current({ type: 'info', message: `Batch dimulai: ${chapterIds.length} bab dipilih.` })
    } catch (e: any) {
      addToastRef.current({ type: 'error', message: `Gagal memulai batch: ${e.message}` })
      setBatch(null)
    }
  }, [seriesId, setBatch])

  const cancelBatch = useCallback(async () => {
    try {
      await cancelTranslation()
      setBatch(null)
    } catch (e: any) {
      addToastRef.current({ type: 'error', message: `Gagal membatalkan batch: ${e.message}` })
    }
  }, [setBatch])

  const isBatchActive = batch?.status === 'translating'

  return {
    batch,
    isBatchActive,
    startBatch,
    startSelectedBatch,
    cancelBatch,
  }
}