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

  const startBatch = useCallback(async (chapters: Chapter[]) => {
    // Filter only pending chapters (never translated)
    const pendingChapters = chapters
      .filter((ch) => ch.status === 'pending')
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map((ch) => ch.id)

    if (pendingChapters.length === 0) {
      addToastRef.current({ type: 'info', message: 'Tidak ada bab yang perlu diterjemahkan (semua sudah selesai).' })
      return
    }

    try {
      setBatch({
        status: 'translating',
        current: 0,
        total: pendingChapters.length,
        completed: 0,
      })
      await startBatchTranslation(seriesId, pendingChapters)
      addToastRef.current({ type: 'info', message: `Batch dimulai: ${pendingChapters.length} bab akan diterjemahkan.` })
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
    cancelBatch,
  }
}