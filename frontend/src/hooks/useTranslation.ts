/**
 * LWNTL Translation Hook
 * Manages translation streaming events via window callbacks
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { getChapter } from '../api'
import type { TranslationChunkEvent, TranslationDoneEvent, TranslationErrorEvent } from '../types'

export function useTranslation(seriesId: string, chapterId: string) {
  const translation = useAppStore((s) => s.translation)
  const setTranslationState = useAppStore((s) => s.setTranslationState)
  const resetTranslation = useAppStore((s) => s.resetTranslation)
  const appendStreamingText = useAppStore((s) => s.appendStreamingText)
  const addToast = useAppStore((s) => s.addToast)

  // Use refs for toast to avoid stale closures
  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  // Stable refs for seriesId/chapterId in callbacks
  const seriesIdRef = useRef(seriesId)
  seriesIdRef.current = seriesId
  const chapterIdRef = useRef(chapterId)
  chapterIdRef.current = chapterId

  // Always reset streaming state when navigating to a different chapter.
  // No isTranslating guard — we must clear stale content unconditionally.
  useEffect(() => {
    resetTranslation()
  }, [chapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register window event callbacks
  useEffect(() => {
    const handleChunk = (data: TranslationChunkEvent) => {
      appendStreamingText(data.chunk)
      setTranslationState({
        iteration: data.iteration,
        progress: Math.min(90, data.iteration * 20),
      })
    }

    const handleStatus = (data: { status: string }) => {
      if (data.status === 'cancelled') {
        setTranslationState({ status: 'cancelled', isTranslating: false, progress: 0 })
      } else {
        setTranslationState({ status: data.status })
      }
    }

    const handleDone = async (data: TranslationDoneEvent) => {
      // Capture which chapter triggered this done event BEFORE the async call.
      // If the user navigates away mid-await, chapterIdRef will point to the new chapter
      // and we must not pollute state with a different chapter's translation.
      const triggeredForChapterId = chapterIdRef.current
      const triggeredForSeriesId = seriesIdRef.current

      try {
        const chapter = await getChapter(triggeredForSeriesId, triggeredForChapterId)

        // Guard: user navigated to a different chapter while we were awaiting
        if (chapterIdRef.current !== triggeredForChapterId) return

        setTranslationState({
          isTranslating: false,
          status: 'done',
          streamingText: chapter.translatedContent || data.translation,
          progress: 100,
          glossaryUpdates: chapter.glossaryUpdates || data.glossaryUpdates || null,
        })
        addToastRef.current({ type: 'success', message: 'Bab selesai diterjemahkan!' })
      } catch {
        if (chapterIdRef.current !== triggeredForChapterId) return

        setTranslationState({
          isTranslating: false,
          status: 'done',
          streamingText: data.translation,
          progress: 100,
          glossaryUpdates: data.glossaryUpdates || null,
        })
        addToastRef.current({ type: 'success', message: 'Bab selesai diterjemahkan!' })
      }
    }

    const handleError = (data: TranslationErrorEvent) => {
      setTranslationState({
        isTranslating: false,
        status: 'error',
      })
      addToastRef.current({ type: 'error', message: `Terjemahan gagal: ${data.message || data.error}` })
    }

    // Register on window
    ;(window as any).onTranslationChunk = handleChunk
    ;(window as any).onTranslationStatus = handleStatus
    ;(window as any).onTranslationDone = handleDone
    ;(window as any).onTranslationError = handleError

    return () => {
      ;(window as any).onTranslationChunk = undefined
      ;(window as any).onTranslationStatus = undefined
      ;(window as any).onTranslationDone = undefined
      ;(window as any).onTranslationError = undefined
    }
  }, [setTranslationState, appendStreamingText])

  const startTranslating = useCallback(() => {
    resetTranslation()
    setTranslationState({ isTranslating: true, status: 'processing', progress: 5 })
    addToastRef.current({ type: 'info', message: 'Terjemahan dimulai...' })
  }, [resetTranslation, setTranslationState])

  return {
    ...translation,
    startTranslating,
    resetTranslation,
  }
}