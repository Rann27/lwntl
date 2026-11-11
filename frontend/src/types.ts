/**
 * LWNTL TypeScript Type Definitions
 */

export interface DeepSeekApiKeyEntry {
  id: string
  label: string
  key: string
}

/** 'default' = send nothing, let the model use its own default */
export type EffortSetting = 'default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// Config
export interface AppConfig {
  provider: 'zhipuai' | 'qwen' | 'openai' | 'gemini' | 'anthropic' | 'xai' | 'moonshot' | 'deepseek' | 'mimo' | 'openrouter' | 'openaicompat'
  model: string
  workers: WorkerProfile[]
  customModels: Record<string, string> // provider -> custom model name
  zhipuaiApiKey: string
  zhipuaiThinking: boolean
  zhipuaiReasoningEffort: EffortSetting
  qwenApiKey: string
  openaiApiKey: string
  geminiApiKey: string
  geminiSafetyFilter: boolean
  anthropicApiKey: string
  xaiApiKey: string
  xaiReasoningEffort: 'low' | 'medium' | 'high' | 'xhigh'
  moonshotApiKey: string
  moonshotRegion: 'international' | 'china'
  moonshotReasoningEffort: EffortSetting
  moonshotThinking: boolean
  qwenThinking: boolean
  openaiReasoningEffort: EffortSetting
  geminiReasoningEffort: EffortSetting
  anthropicEffort: EffortSetting
  openrouterApiKey: string
  /** 'default' sends nothing; 'off' disables reasoning where the model allows it */
  openrouterReasoning: EffortSetting | 'off'
  openrouterSort: '' | 'price' | 'throughput' | 'latency'
  openrouterDenyDataCollection: boolean
  deepseekApiKey: string
  deepseekApiKeys: DeepSeekApiKeyEntry[]
  deepseekThinking: boolean
  deepseekReasoningEffort: 'low' | 'high' | 'max'
  mimoApiKey: string
  mimoThinking: boolean
  mimoReasoningEffort: 'low' | 'medium' | 'high'
  openaicompatApiKey: string
  openaicompatBaseUrl: string
  openaicompatUserAgent: string
  openaicompatClientName: string
  openaicompatExtraHeaders: Record<string, string>
  temperature: number
  maxTokensPerIteration: number
  maxContextTokens: number
  glossaryPreFilter: boolean
  theme: string
  uiLanguage: 'id' | 'en'
  sourceLanguages: string[]
  targetLanguages: string[]
}

export interface WorkerProfile {
  id: string
  label: string
  provider: AppConfig['provider']
  model: string
  maxConcurrent?: number
  deepseekApiKeyId?: string
}

export interface WorkerStatus extends WorkerProfile {
  modelDisplay: string
  active: boolean
  activeCount?: number
  maxConcurrent: number
  jobId?: string | null
  seriesId?: string | null
  chapterId?: string | null
  assignedSeriesIds: string[]
}

// Series Group (hierarchical organization, max 3 levels)
export interface SeriesGroup {
  id: string
  name: string
  parentId: string | null
  color: string
  createdAt: string
  updatedAt: string
}

// Series
export interface Series {
  id: string
  title: string
  sourceLanguage: string
  targetLanguage: string
  groupId: string | null
  workerId: string
  iterationLock: boolean
  autoFixCjk: boolean
  imageFolder: string
  revisionPass: boolean
  lookupEnabled: boolean
  lookupChapters: number
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

export interface ChapterImage {
  filename: string
  mime: string
  file: string
}

export interface Chapter {
  id: string
  seriesId: string
  chapterNumber: string
  title: string
  rawContent: string
  translatedContent: string
  summary: string
  status: ChapterStatus
  glossaryUpdates: GlossaryUpdates | null
  translationLog: TranslationLog | null
  translationHistory: TranslationVersion[]
  images?: ChapterImage[]
  agentReview?: AgentReview | null
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
// Generated from core/llm_client.py PROVIDERS — keep the two in sync.
export const PROVIDERS: Record<string, {
  models: string[]
  displayNames: Record<string, string>
  baseUrl?: string
  label: string
  docsUrl: string
  apiKeyName: keyof AppConfig
}> = {
  zhipuai: {
    models: ['glm-5.3', 'glm-5.3-flashx', 'glm-5.3-flash', 'glm-5.2', 'glm-5.1', 'glm-4.7-flash', 'custom'],
    displayNames: {
      'glm-5.3': 'GLM-5.3',
      'glm-5.3-flashx': 'GLM-5.3-FlashX',
      'glm-5.3-flash': 'GLM-5.3-Flash',
      'glm-5.2': 'GLM-5.2',
      'glm-5.1': 'GLM-5.1',
      'glm-4.7-flash': 'GLM-4.7-Flash (Free)',
      custom: '+ Custom Model',
    },
    label: 'ZhipuAI (Z.AI)',
    docsUrl: 'https://docs.z.ai/guides/overview/pricing',
    apiKeyName: 'zhipuaiApiKey',
  },
  qwen: {
    models: ['qwen3.8-max', 'qwen3.8-flash', 'qwen3.7-plus', 'qwen3.7-flash', 'custom'],
    displayNames: {
      'qwen3.8-max': 'Qwen3.8-Max',
      'qwen3.8-flash': 'Qwen3.8-Flash',
      'qwen3.7-plus': 'Qwen3.7-Plus',
      'qwen3.7-flash': 'Qwen3.7-Flash',
      custom: '+ Custom Model',
    },
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    label: 'Alibaba Cloud (Qwen)',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/models',
    apiKeyName: 'qwenApiKey',
  },
  openai: {
    models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna', 'custom'],
    displayNames: {
      'gpt-6.1-sol': 'GPT-6.1 Sol',
      'gpt-6-astra': 'GPT-6 Astra',
      'gpt-6-luna': 'GPT-6 Luna',
      custom: '+ Custom Model',
    },
    label: 'OpenAI',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    apiKeyName: 'openaiApiKey',
  },
  gemini: {
    models: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'custom'],
    displayNames: {
      'gemini-3.8-flash': 'Gemini 3.8 Flash',
      'gemini-3.6-flash': 'Gemini 3.6 Flash',
      'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
      'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
      'gemini-3.1-pro-preview': 'Gemini 3.1 Pro (Preview)',
      custom: '+ Custom Model',
    },
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    label: 'Google Gemini',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    apiKeyName: 'geminiApiKey',
  },
  anthropic: {
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'custom'],
    displayNames: {
      'claude-opus-5-5': 'Claude Opus 5.5',
      'claude-sonnet-5-5': 'Claude Sonnet 5.5',
      'claude-haiku-5-5': 'Claude Haiku 5.5',
      'claude-fable-5-1': 'Claude Fable 5.1',
      custom: '+ Custom Model',
    },
    label: 'Anthropic (Claude)',
    docsUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    apiKeyName: 'anthropicApiKey',
  },
  xai: {
    models: ['grok-4.7', 'grok-4.6', 'grok-4.5', 'grok-4.3', 'grok-4.20-0309-reasoning', 'grok-4.20-0309-non-reasoning', 'custom'],
    displayNames: {
      'grok-4.7': 'Grok 4.7',
      'grok-4.6': 'Grok 4.6',
      'grok-4.5': 'Grok 4.5',
      'grok-4.3': 'Grok 4.3',
      'grok-4.20-0309-reasoning': 'Grok 4.20 (reasoning)',
      'grok-4.20-0309-non-reasoning': 'Grok 4.20 (non-reasoning)',
      custom: '+ Custom Model',
    },
    baseUrl: 'https://api.x.ai/v1',
    label: 'xAI (Grok)',
    docsUrl: 'https://docs.x.ai/docs/models',
    apiKeyName: 'xaiApiKey',
  },
  moonshot: {
    models: ['kimi-k3', 'kimi-k2.6', 'kimi-k2.7-code', 'custom'],
    displayNames: {
      'kimi-k3': 'Kimi K3',
      'kimi-k2.6': 'Kimi K2.6',
      'kimi-k2.7-code': 'Kimi K2.7 Code',
      custom: '+ Custom Model',
    },
    baseUrl: 'https://api.moonshot.ai/v1',
    label: 'Moonshot AI (Kimi)',
    docsUrl: 'https://platform.kimi.ai/docs/api/models-overview',
    apiKeyName: 'moonshotApiKey',
  },
  deepseek: {
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    displayNames: {
      'deepseek-flash': 'DeepSeek V4.1 Flash',
      'deepseek-v4-pro': 'DeepSeek V4 Pro',
      'deepseek-v4-flash': 'DeepSeek V4 Flash (legacy → V4.1)',
      'deepseek-v4-flash-vision-exp': 'DeepSeek V4 Flash Vision (legacy → V4.1)',
    },
    baseUrl: 'https://api.deepseek.com',
    label: 'DeepSeek',
    docsUrl: 'https://api-docs.deepseek.com/',
    apiKeyName: 'deepseekApiKey',
  },
  mimo: {
    models: ['mimo-v2.6-pro', 'mimo-v2.6-flash', 'mimo-v2.5-pro', 'mimo-v2.5'],
    displayNames: {
      'mimo-v2.6-pro': 'MiMo V2.6 Pro',
      'mimo-v2.6-flash': 'MiMo V2.6 Flash',
      'mimo-v2.5-pro': 'MiMo V2.5 Pro',
      'mimo-v2.5': 'MiMo V2.5',
    },
    baseUrl: 'https://api.xiaomimimo.com/v1',
    label: 'Xiaomi MiMo',
    docsUrl: 'https://platform.xiaomimimo.com/docs/en-US/welcome',
    apiKeyName: 'mimoApiKey',
  },
  openrouter: {
    models: [],
    displayNames: {},
    baseUrl: 'https://openrouter.ai/api/v1',
    label: 'OpenRouter',
    docsUrl: 'https://openrouter.ai/models',
    apiKeyName: 'openrouterApiKey',
  },
  openaicompat: {
    models: [],
    displayNames: {},
    label: 'OpenAI Compatible',
    docsUrl: '',
    apiKeyName: 'openaicompatApiKey',
  },
}

// Translation Events
export interface TranslationChunkEvent {
  chunk: string
  iteration: number
  jobId?: string
  workerId?: string
  workerLabel?: string
  seriesId?: string
  chapterId?: string
}

export interface TranslationStatusEvent {
  status: string
  jobId?: string
  workerId?: string
  seriesId?: string
  chapterId?: string
}

export interface TranslationDoneEvent {
  status: string
  translation: string
  iterations: number
  tokens: number
  glossaryUpdates?: GlossaryUpdates
  jobId?: string
  workerId?: string
  seriesId?: string
  chapterId?: string
}

export interface TranslationErrorEvent {
  error: string
  message: string
  jobId?: string
  workerId?: string
  seriesId?: string
  chapterId?: string
}

// Batch Translation Events
export interface BatchStatusEvent {
  status: 'translating' | 'done' | 'cancelled'
  jobId?: string
  workerId?: string
  workerLabel?: string
  seriesId?: string
  current?: number
  total?: number
  completed?: number
  chapterId?: string
  chapterNumber?: string
  chapterTitle?: string
  /** Set on events from an agent run (translate → review → volume pass). */
  agent?: boolean
  phase?: 'translate' | 'review' | 'volume'
  edits?: number
  failed?: string[]
  error?: string
}

export type AgentReviewMode = 'full' | 'findings'

export interface AgentFindingStats {
  paragraphs: number
  high: number
  medium: number
  low: number
}

// ===== QA report (core/qa_scan.py) =====
export type QaSeverity = 'high' | 'medium' | 'low'

export interface QaFinding {
  type: string
  severity: QaSeverity
  para: number | null
  detail: string
  text: string
  fix?: string
  /** The paragraph with its safe fix applied (chapter review only). */
  fixPreview?: string
}

export interface QaChapterDetail {
  chapterId: string
  chapterNumber: string
  title: string
  paragraphs: string[]
  source: string[]
  /** [start, end] source line range per paragraph */
  sourceMap: [number, number][]
  findings: QaFinding[]
  stats: AgentFindingStats
}

export interface QaChapterReport {
  chapterId: string
  position: number
  chapterNumber: string
  title: string
  stats: AgentFindingStats & {
    lengthRatio: number
    openerRatio: number
    quoteStyle: string
    sourceChars: number
    translatedChars: number
  }
  findings: QaFinding[]
}

export interface QaNameForm {
  form: string
  count: number
  chapters: string[]
  glossary: boolean
  macron: boolean
}

export interface QaReport {
  seriesId: string
  targetLanguage: string
  chapterCount: number
  totals: { high: number; medium: number; low: number }
  chapters: QaChapterReport[]
  volume: {
    nameVariants: { forms: QaNameForm[] }[]
    spelling?: { standard: string; nonStandard: string; nonStandardCount: number; standardCount: number }[]
    quoteStyle: { majority: string; deviating: string[] }
    openers: { average: number; outliers: { chapter: string; ratio: number }[] }
    length: { median: number; outliers: { chapter: string; ratio: number; relative: number; kind: string }[] }
    pronouns?: { chapter: string; kau?: number; kamu?: number; Anda?: number }[]
    diction: { chapter: string; per1000: number; top: [string, number][] }[]
    frequency: { words: [string, number][]; bigrams: [string, number][]; trigrams: [string, number][] }
    glossary: { sourceTerm: string; translatedTerm: string; issue: string; suggestOld?: string; suggestNew?: string }[]
  }
}

export interface GlossaryCandidate {
  form: string
  count: number
  origin: 'glossary' | 'variant' | 'name' | 'normalized'
  note: string
}

export interface GlossaryResolution {
  kind: 'homoglyph' | 'name_part' | 'variants' | 'conflict' | 'unused'
  candidates: GlossaryCandidate[]
  preselect: string | null
  confident: boolean
  reason: string
}

export interface GlossaryAuditEntry {
  id: string
  sourceTerm: string
  translatedTerm: string
  notes: string
  srcChapters: number
  srcCount: number
  usedCount: number
  character: boolean
  flags: string[]
  variants: { form: string; count: number; chapters: string[] }[]
  conflictWith: string
  conflictEntry: { id: string; sourceTerm: string; translatedTerm: string; notes?: string } | null
  suggestion: 'check' | 'remove' | 'keep'
  resolution?: GlossaryResolution
}

export interface GlossaryAudit {
  entries: GlossaryAuditEntry[]
  summary: { check: number; remove: number; keep: number }
  total: number
  chapters: number
}

export interface QaFixPreview {
  categories: Record<string, number>
  chapters: { chapterId: string; chapterNumber: string; changes: Record<string, number> }[]
  samples: Record<string, { chapter: string; category: string; para: number; before: string; after: string }[]>
  available: string[]
}

export interface AgentReview {
  reviewedAt: string
  model?: string
  steps?: number
  summary?: string
  skipped?: boolean
  reason?: string
  mode?: string
  findingsBefore?: AgentFindingStats
  findingsAfter?: AgentFindingStats
  edits?: { chapter: string; op: string; para: number; reason: string; before?: string; after?: string }[]
  glossaryAdded?: string[]
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

// Profiles
export interface ProfilesState {
  active: string
  profiles: string[]
}

// API Response
export interface ApiError {
  error: boolean
  message: string
}

// Default languages (used when config doesn't have them yet)
export const DEFAULT_SOURCE_LANGUAGES = ['Japanese', 'Chinese', 'Korean']
export const DEFAULT_TARGET_LANGUAGES = ['Indonesian', 'English']

// Chapter number sort helpers
export function chapterNumFloat(num: string | number | undefined): number {
  const n = parseFloat(String(num ?? ''))
  if (!isNaN(n)) return n
  const s = String(num ?? '').toLowerCase().trim()
  if (s === 'prolog' || s === 'prologue' || s === 'pendahuluan' || s === 'foreword') return -1
  if (s === 'epilog' || s === 'epilogue' || s === 'penutup' || s === 'afterword') return 9999
  return 0
}

export function compareChapterNumbers(a: string | number | undefined, b: string | number | undefined): number {
  return chapterNumFloat(a) - chapterNumFloat(b)
}
