/**
 * LWNTL App Store - Zustand State Management
 */

import { create } from 'zustand'
import type { AppConfig, ChapterStatus, GlossaryUpdates, BatchStatusEvent, ContextInfo, ProfilesState } from '../types'

// ===== Toast =====
export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  timestamp: number
}

// ===== Translation State =====
export interface TranslationState {
  isTranslating: boolean
  status: string // 'idle' | 'processing' | 'extracting' | 'done' | 'error'
  streamingText: string
  iteration: number
  progress: number // 0-100
  glossaryUpdates: GlossaryUpdates | null
}

interface AppState {
  // Toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void
  removeToast: (id: string) => void

  // Config
  config: AppConfig | null
  setConfig: (config: AppConfig) => void

  // Translation
  translation: TranslationState
  translationsByChapter: Record<string, TranslationState>
  setTranslationState: (partial: Partial<TranslationState>) => void
  resetTranslation: () => void
  appendStreamingText: (chunk: string) => void
  setChapterTranslationState: (key: string, partial: Partial<TranslationState>) => void
  resetChapterTranslation: (key: string) => void
  appendChapterStreamingText: (key: string, chunk: string) => void
  clearChapterStreamingText: (key: string) => void

  // Batch translation (per-series)
  batches: Record<string, BatchStatusEvent>
  setBatchForSeries: (seriesId: string, event: BatchStatusEvent | null) => void

  // Context info
  contextInfo: ContextInfo | null
  setContextInfo: (info: ContextInfo | null) => void

  // Chapter status cache (seriesId -> chapterId -> status)
  chapterStatusCache: Record<string, Record<string, ChapterStatus>>
  setChapterStatus: (seriesId: string, chapterId: string, status: ChapterStatus) => void

  // Profiles
  profiles: ProfilesState
  setProfiles: (p: ProfilesState) => void

  // API ready
  apiReady: boolean
  setApiReady: (ready: boolean) => void
}

const initialTranslationState: TranslationState = {
  isTranslating: false,
  status: 'idle',
  streamingText: '',
  iteration: 0,
  progress: 0,
  glossaryUpdates: null,
}

export const useAppStore = create<AppState>((set) => ({
  // Toasts
  toasts: [],

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      timestamp: Date.now(),
    }
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, 3000)
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  // Config
  config: null,
  setConfig: (config) => set({ config }),

  // Translation
  translation: { ...initialTranslationState },
  translationsByChapter: {},

  setTranslationState: (partial) =>
    set((state) => ({
      translation: { ...state.translation, ...partial },
    })),

  resetTranslation: () =>
    set({
      translation: { ...initialTranslationState },
    }),

  appendStreamingText: (chunk) =>
    set((state) => ({
      translation: {
        ...state.translation,
        streamingText: state.translation.streamingText + chunk,
      },
    })),

  setChapterTranslationState: (key, partial) =>
    set((state) => {
      const current = state.translationsByChapter[key] || initialTranslationState
      return {
        translationsByChapter: {
          ...state.translationsByChapter,
          [key]: { ...current, ...partial },
        },
      }
    }),

  resetChapterTranslation: (key) =>
    set((state) => ({
      translationsByChapter: {
        ...state.translationsByChapter,
        [key]: { ...initialTranslationState },
      },
    })),

  appendChapterStreamingText: (key, chunk) =>
    set((state) => {
      const current = state.translationsByChapter[key] || initialTranslationState
      return {
        translationsByChapter: {
          ...state.translationsByChapter,
          [key]: {
            ...current,
            streamingText: current.streamingText + chunk,
          },
        },
      }
    }),

  clearChapterStreamingText: (key) =>
    set((state) => {
      const current = state.translationsByChapter[key]
      if (!current) return state
      return {
        translationsByChapter: {
          ...state.translationsByChapter,
          [key]: { ...current, streamingText: '' },
        },
      }
    }),

  // Batch translation (per-series)
  batches: {},
  setBatchForSeries: (seriesId, event) =>
    set((state) => {
      if (event === null) {
        const next = { ...state.batches }
        delete next[seriesId]
        return { batches: next }
      }
      return { batches: { ...state.batches, [seriesId]: event } }
    }),

  // Context info
  contextInfo: null,
  setContextInfo: (info) => set({ contextInfo: info }),

  // Chapter status cache
  chapterStatusCache: {},

  setChapterStatus: (seriesId, chapterId, status) =>
    set((state) => ({
      chapterStatusCache: {
        ...state.chapterStatusCache,
        [seriesId]: {
          ...(state.chapterStatusCache[seriesId] || {}),
          [chapterId]: status,
        },
      },
    })),

  // Profiles
  profiles: { active: '', profiles: [] },
  setProfiles: (p) => set({ profiles: p }),

  // API ready
  apiReady: false,
  setApiReady: (ready) => set({ apiReady: ready }),
}))
