/**
 * LWNTL TypeScript Type Definitions
 */

// Config
export interface AppConfig {
  provider: 'zhipuai' | 'qwen' | 'openai' | 'gemini' | 'anthropic' | 'xai' | 'moonshot' | 'openaicompat'
  model: string
  customModels: Record<string, string> // provider -> custom model name
  zhipuaiApiKey: string
  qwenApiKey: string
  openaiApiKey: string
  geminiApiKey: string
  anthropicApiKey: string
  xaiApiKey: string
  moonshotApiKey: string
  openaicompatApiKey: string
  openaicompatBaseUrl: string
  openaicompatUserAgent: string
  openaicompatClientName: string
  openaicompatExtraHeaders: Record<string, string>
  temperature: number
  maxTokensPerIteration: number
  theme: string
  uiLanguage: 'id' | 'en'
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

// Translation version (history entry)
export interface TranslationVersion {
  version: number
  translatedContent: string
  glossaryUpdates: GlossaryUpdates | null
  translatedAt: string
  charCount: number
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
  translationHistory: TranslationVersion[]
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
  label: string
  docsUrl: string
  apiKeyName: keyof AppConfig
}> = {
  zhipuai: {
    models: ['glm-5', 'glm-4.7', 'glm-4.7-flashx', 'glm-4.7-flash', 'custom'],
    displayNames: {
      'glm-5': 'GLM-5',
      'glm-4.7': 'GLM-4.7',
      'glm-4.7-flashx': 'GLM-4.7-FlashX',
      'glm-4.7-flash': 'GLM-4.7-Flash (Free)',
      'custom': '+ Custom Model',
    },
    label: 'ZhipuAI (Z.AI)',
    docsUrl: 'https://bigmodel.cn/dev/api/normal-model/glm-4',
    apiKeyName: 'zhipuaiApiKey',
  },
  qwen: {
    models: [
      'qwen3.5-plus', 'qwen3.5-flash', 'qwen3.6-plus',
      'qwen3.6-plus-2026-04-02', 'qwen3.5-122b-a10b',
      'qwen3.5-plus-2026-02-15', 'qwen3.5-flash-2026-02-23',
      'deepseek-v3.2', 'custom',
    ],
    displayNames: {
      'qwen3.5-plus': 'Qwen3.5-Plus',
      'qwen3.5-flash': 'Qwen3.5-Flash',
      'qwen3.6-plus': 'Qwen3.6-Plus',
      'qwen3.6-plus-2026-04-02': 'Qwen3.6-Plus (2026-04-02)',
      'qwen3.5-122b-a10b': 'Qwen3.5-122B-A10B',
      'qwen3.5-plus-2026-02-15': 'Qwen3.5-Plus (2026-02-15)',
      'qwen3.5-flash-2026-02-23': 'Qwen3.5-Flash (2026-02-23)',
      'deepseek-v3.2': 'DeepSeek V3.2 (via Qwen)',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    label: 'Alibaba Cloud (Qwen/DS)',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/getting-started/models',
    apiKeyName: 'qwenApiKey',
  },
  openai: {
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.4-pro', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'custom'],
    displayNames: {
      'gpt-5.4': 'GPT-5.4',
      'gpt-5.4-mini': 'GPT-5.4-mini',
      'gpt-5.4-nano': 'GPT-5.4-nano',
      'gpt-5.4-pro': 'GPT-5.4-pro',
      'gpt-4.1': 'GPT-4.1',
      'gpt-4.1-mini': 'GPT-4.1-mini',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o-mini',
      'custom': '+ Custom Model',
    },
    label: 'OpenAI',
    docsUrl: 'https://platform.openai.com/docs/models',
    apiKeyName: 'openaiApiKey',
  },
  gemini: {
    models: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'custom'],
    displayNames: {
      'gemini-3.1-pro-preview': 'Gemini 3.1 Pro (Preview)',
      'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite (Preview)',
      'gemini-3-flash-preview': 'Gemini 3 Flash (Preview)',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    label: 'Google Gemini',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    apiKeyName: 'geminiApiKey',
  },
  anthropic: {
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'custom'],
    displayNames: {
      'claude-opus-4-6': 'Claude Opus 4.6',
      'claude-sonnet-4-6': 'Claude Sonnet 4.6',
      'claude-haiku-4-5': 'Claude Haiku 4.5',
      'custom': '+ Custom Model',
    },
    label: 'Anthropic (Claude)',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    apiKeyName: 'anthropicApiKey',
  },
  xai: {
    models: ['grok-4.20-0309', 'grok-4.1-fast', 'grok-3', 'grok-3-mini', 'custom'],
    displayNames: {
      'grok-4.20-0309': 'Grok 4.20 (0309)',
      'grok-4.1-fast': 'Grok 4.1 Fast',
      'grok-3': 'Grok 3',
      'grok-3-mini': 'Grok 3 Mini',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://api.x.ai/v1',
    label: 'xAI (Grok)',
    docsUrl: 'https://docs.x.ai/docs/models',
    apiKeyName: 'xaiApiKey',
  },
  moonshot: {
    models: ['kimi-k2.5', 'moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k', 'custom'],
    displayNames: {
      'kimi-k2.5': 'Kimi K2.5',
      'moonshot-v1-128k': 'Moonshot v1 128k',
      'moonshot-v1-32k': 'Moonshot v1 32k',
      'moonshot-v1-8k': 'Moonshot v1 8k',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://api.moonshot.cn/v1',
    label: 'Moonshot AI (Kimi)',
    docsUrl: 'https://platform.moonshot.cn/docs/api/chat',
    apiKeyName: 'moonshotApiKey',
  },
  openaicompat: {
    models: [] as string[],
    displayNames: {} as Record<string, string>,
    label: 'OpenAI Compatible',
    docsUrl: '',
    apiKeyName: 'openaicompatApiKey',
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
