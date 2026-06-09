/**
 * LWNTL Translation Hook
 * Reads live translation state from an app-level per-chapter registry.
 */

import { useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '../store/appStore'

export function useTranslation(seriesId: string, chapterId: string) {
  const key = useMemo(() => `${seriesId}:${chapterId}`, [seriesId, chapterId])
  const translation = useAppStore((s) => s.translationsByChapter[key] || s.translation)
  const setChapterTranslationState = useAppStore((s) => s.setChapterTranslationState)
  const resetChapterTranslation = useAppStore((s) => s.resetChapterTranslation)
  const addToast = useAppStore((s) => s.addToast)

  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  const startTranslating = useCallback(() => {
    resetChapterTranslation(key)
    setChapterTranslationState(key, { isTranslating: true, status: 'processing', progress: 5 })
    addToastRef.current({ type: 'info', message: 'Terjemahan dimulai...' })
  }, [key, resetChapterTranslation, setChapterTranslationState])

  const resetTranslation = useCallback(() => {
    resetChapterTranslation(key)
  }, [key, resetChapterTranslation])

  return {
    ...translation,
    startTranslating,
    resetTranslation,
  }
}
