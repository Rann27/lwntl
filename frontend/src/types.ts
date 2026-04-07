/**
 * LWNTL TypeScript Type Definitions
 */

// Config
export interface AppConfig {
  provider: 'zhipuai' | 'qwen'
  model: string
  zhipuaiApiKey: string
  qwenApiKey: string
  temperature: number
  maxTokensPerIteration: number
  theme: string
  sourceLanguages: string[]
  targetLanguages: string[]
}

// Series
export interface Series {
  id: string
  title: string
  sourceLanguage: string
  targetLanguage: string
  systemPrompt: string
  instructions: string
  glossary: GlossaryEntry[]
  memory: MemoryEntry[]
  createdAt: string
  updatedAt: string
}

// Chapter
export type ChapterStatus = 'pending' | 'processing' | 'done' | 'error'

export interface GlossaryUpdateEntry {
  sourceTerm: string
  translatedTerm: string
  notes: string
  isNew: boolean
}

export interface GlossaryUpdates {
  extractedAt: string
  entries: GlossaryUpdateEntry[]
  error?: string
}

export interface TranslationLog {
  iterations: number
  totalTokens: number
  translatedAt: string
}

export interface Chapter {
  id: string
  seriesId: string
  chapterNumber: number
  title: string
  rawContent: string
  translatedContent: string
  summary: string
  status: ChapterStatus
  glossaryUpdates: GlossaryUpdates | null
  translationLog: TranslationLog | null
  createdAt: string
  updatedAt: string
}

// Glossary
export interface MemoryEntry {
  range: string
  content: string
  compactedAt: string
  chapterCount: number
}

export interface GlossaryEntry {
  id: string
  sourceTerm: string
  translatedTerm: string
  notes: string
  updatedAt: string
}

// Provider Registry
export const PROVIDERS: Record<string, {
  models: string[]
  displayNames: Record<string, string>
  baseUrl?: string
}> = {
  zhipuai: {
    models: ['glm-5', 'glm-4.7', 'glm-4.7-flashx', 'glm-4.7-flash'],
    displayNames: {
      'glm-5': 'GLM-5',
      'glm-4.7': 'GLM-4.7',
      'glm-4.7-flashx': 'GLM-4.7-FlashX',
      'glm-4.7-flash': 'GLM-4.7-Flash (Free)',
    },
  },
  qwen: {
    models: ['qwen-plus', 'qwen-flash', 'qwen3.6-plus', 'deepseek-v3'],
    displayNames: {
      'qwen-plus': 'Qwen3.5-Plus',
      'qwen-flash': 'Qwen3.5-Flash',
      'qwen3.6-plus': 'Qwen3.6-Plus',
      'deepseek-v3': 'DeepSeek V3.2',
    },
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
}

// Translation Events
export interface TranslationChunkEvent {
  chunk: string
  iteration: number
  fullText?: string
}

export interface TranslationStatusEvent {
  status: string
}

export interface TranslationDoneEvent {
  status: string
  translation: string
  iterations: number
  tokens: number
  glossaryUpdates?: GlossaryUpdates
}

export interface TranslationErrorEvent {
  error: string
  message: string
}

// Batch Translation Events
export interface BatchStatusEvent {
  status: 'translating' | 'done' | 'cancelled'
  current?: number
  total?: number
  completed?: number
  chapterId?: string
  chapterNumber?: number | string
  chapterTitle?: string
}

// Context Info
export interface ContextInfo {
  totalTokens: number
  availableTokens: number
  maxTokens: number
  fits: boolean
  utilization: number
  breakdown: {
    system: number
    rolling: number
    memory: number
    current: number
    reserved: number
  }
  summariesAvailable: number
  memoriesAvailable: number
}

// Delete Info
export interface SeriesDeleteInfo {
  chapterCount: number
}

export interface ChapterDeleteInfo {
  // minimal info
}

// API Response
export interface ApiError {
  error: boolean
  message: string
}

// Default languages (used when config doesn't have them yet)
export const DEFAULT_SOURCE_LANGUAGES = ['Japanese', 'Chinese', 'Korean']
export const DEFAULT_TARGET_LANGUAGES = ['Indonesian', 'English']
