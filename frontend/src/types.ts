/**
 * LWNTL TypeScript Type Definitions
 */

// Config
export interface AppConfig {
  provider: 'zhipuai' | 'qwen' | 'openai' | 'gemini' | 'anthropic' | 'xai' | 'moonshot'
  model: string
  customModels: Record<string, string> // provider -> custom model name
  zhipuaiApiKey: string
  qwenApiKey: string
  openaiApiKey: string
  geminiApiKey: string
  anthropicApiKey: string
  xaiApiKey: string
  moonshotApiKey: string
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
    models: ['qwen-plus', 'qwen-flash', 'qwen3.6-plus', 'deepseek-v3', 'custom'],
    displayNames: {
      'qwen-plus': 'Qwen3.5-Plus',
      'qwen-flash': 'Qwen3.5-Flash',
      'qwen3.6-plus': 'Qwen3.6-Plus',
      'deepseek-v3': 'DeepSeek V3.2',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    label: 'Alibaba Cloud (Qwen/DS)',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/getting-started/models',
    apiKeyName: 'qwenApiKey',
  },
  openai: {
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'custom'],
    displayNames: {
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
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'custom'],
    displayNames: {
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
    models: ['grok-3', 'grok-3-mini', 'grok-2', 'custom'],
    displayNames: {
      'grok-3': 'Grok 3',
      'grok-3-mini': 'Grok 3 Mini',
      'grok-2': 'Grok 2',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://api.x.ai/v1',
    label: 'xAI (Grok)',
    docsUrl: 'https://docs.x.ai/docs/models',
    apiKeyName: 'xaiApiKey',
  },
  moonshot: {
    models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k', 'custom'],
    displayNames: {
      'moonshot-v1-128k': 'Moonshot v1 128k (Kimi)',
      'moonshot-v1-32k': 'Moonshot v1 32k (Kimi)',
      'moonshot-v1-8k': 'Moonshot v1 8k (Kimi)',
      'custom': '+ Custom Model',
    },
    baseUrl: 'https://api.moonshot.cn/v1',
    label: 'Moonshot AI (Kimi)',
    docsUrl: 'https://platform.moonshot.cn/docs/api/chat',
    apiKeyName: 'moonshotApiKey',
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
