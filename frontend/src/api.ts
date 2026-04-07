/**
 * LWNTL API Utility
 * Wraps window.pywebview.api calls with type safety
 */

import type {
  AppConfig,
  Series,
  Chapter,
  GlossaryEntry,
  SeriesDeleteInfo,
  ApiError,
} from './types'

// Type guard for API errors
function isApiError(result: unknown): result is ApiError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    (result as ApiError).error === true
  )
}

// Get the pywebview API
function getApi(): any {
  return (window as any).pywebview?.api
}

// Check if pywebview is ready
export function isApiReady(): boolean {
  return !!(window as any).pywebview?.api
}

// Wait for pywebview API to be ready
export function waitForApi(): Promise<void> {
  return new Promise((resolve) => {
    if (isApiReady()) {
      resolve()
      return
    }
    const check = () => {
      if (isApiReady()) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

// ===== Config =====
export async function getConfig(): Promise<AppConfig> {
  const api = getApi()
  const result = await api.get_config()
  if (isApiError(result)) throw new Error(result.message)
  return result as AppConfig
}

export async function saveConfig(config: AppConfig): Promise<boolean> {
  const api = getApi()
  const result = await api.save_config(config)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function testConfig(): Promise<{ success: boolean; message: string }> {
  const api = getApi()
  const result = await api.test_config()
  return result
}

// ===== Series =====
export async function getAllSeries(): Promise<Series[]> {
  const api = getApi()
  const result = await api.get_all_series()
  if (isApiError(result)) throw new Error(result.message)
  return result as Series[]
}

export async function createSeries(title: string, language: string, targetLanguage?: string): Promise<Series> {
  const api = getApi()
  const result = await api.create_series(title, language, targetLanguage || 'Indonesian')
  if (isApiError(result)) throw new Error(result.message)
  return result as Series
}

export async function updateSeries(
  seriesId: string,
  title: string,
  language: string,
  targetLanguage?: string,
  systemPrompt?: string
): Promise<Series> {
  const api = getApi()
  const result = await api.update_series(seriesId, title, language, targetLanguage || null, systemPrompt || null)
  if (isApiError(result)) throw new Error(result.message)
  return result as Series
}

export async function getDefaultSystemPrompt(targetLanguage: string): Promise<string> {
  const api = getApi()
  const result = await api.get_default_system_prompt(targetLanguage)
  if (isApiError(result)) throw new Error(result.message)
  return result.prompt as string
}

export async function getSeriesDeleteInfo(
  seriesId: string
): Promise<SeriesDeleteInfo> {
  const api = getApi()
  const result = await api.get_series_delete_info(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as SeriesDeleteInfo
}

export async function deleteSeries(seriesId: string): Promise<boolean> {
  const api = getApi()
  const result = await api.delete_series(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

// ===== Chapters =====
export async function getChapters(seriesId: string): Promise<Chapter[]> {
  const api = getApi()
  const result = await api.get_chapters(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as Chapter[]
}

export async function createChapter(
  seriesId: string,
  number: number,
  title: string,
  rawContent: string
): Promise<Chapter> {
  const api = getApi()
  const result = await api.create_chapter(seriesId, number, title, rawContent)
  if (isApiError(result)) throw new Error(result.message)
  return result as Chapter
}

export async function updateChapter(
  seriesId: string,
  chapterId: string,
  number: number,
  title: string,
  rawContent: string
): Promise<Chapter> {
  const api = getApi()
  const result = await api.update_chapter(seriesId, chapterId, number, title, rawContent)
  if (isApiError(result)) throw new Error(result.message)
  return result as Chapter
}

export async function getChapter(
  seriesId: string,
  chapterId: string
): Promise<Chapter> {
  const api = getApi()
  const result = await api.get_chapter(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result as Chapter
}

export async function getChapterDeleteInfo(
  seriesId: string,
  chapterId: string
): Promise<any> {
  const api = getApi()
  const result = await api.get_chapter_delete_info(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result
}

export async function deleteChapter(
  seriesId: string,
  chapterId: string
): Promise<boolean> {
  const api = getApi()
  const result = await api.delete_chapter(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

// ===== Glossary =====
export async function getGlossary(seriesId: string): Promise<GlossaryEntry[]> {
  const api = getApi()
  const result = await api.get_glossary(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as GlossaryEntry[]
}

export async function addGlossaryEntry(
  seriesId: string,
  sourceTerm: string,
  translatedTerm: string,
  notes: string
): Promise<GlossaryEntry> {
  const api = getApi()
  const result = await api.add_glossary_entry(seriesId, sourceTerm, translatedTerm, notes)
  if (isApiError(result)) throw new Error(result.message)
  return result as GlossaryEntry
}

export async function updateGlossaryEntry(
  seriesId: string,
  entryId: string,
  sourceTerm: string,
  translatedTerm: string,
  notes: string
): Promise<GlossaryEntry> {
  const api = getApi()
  const result = await api.update_glossary_entry(seriesId, entryId, sourceTerm, translatedTerm, notes)
  if (isApiError(result)) throw new Error(result.message)
  return result as GlossaryEntry
}

export async function deleteGlossaryEntry(
  seriesId: string,
  entryId: string
): Promise<boolean> {
  const api = getApi()
  const result = await api.delete_glossary_entry(seriesId, entryId)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function confirmGlossaryUpdates(
  seriesId: string,
  chapterId: string,
  entryIds: string[]
): Promise<boolean> {
  const api = getApi()
  const result = await api.confirm_glossary_updates(seriesId, chapterId, entryIds)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function confirmAllGlossaryUpdates(
  seriesId: string,
  chapterId: string
): Promise<boolean> {
  const api = getApi()
  const result = await api.confirm_all_glossary_updates(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

// ===== Instructions =====
export async function saveInstructions(
  seriesId: string,
  instructions: string
): Promise<boolean> {
  const api = getApi()
  const result = await api.save_instructions(seriesId, instructions)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

// ===== Translation =====
export async function startTranslation(
  seriesId: string,
  chapterId: string
): Promise<void> {
  const api = getApi()
  const result = await api.start_translation(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
}

export async function cancelTranslation(): Promise<boolean> {
  const api = getApi()
  const result = await api.cancel_translation()
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function startBatchTranslation(
  seriesId: string,
  chapterIds: string[]
): Promise<{ status: string; total: number }> {
  const api = getApi()
  const result = await api.start_batch_translation(seriesId, JSON.stringify(chapterIds))
  if (isApiError(result)) throw new Error(result.message)
  return result as { status: string; total: number }
}

export async function getContextInfo(
  seriesId: string,
  chapterId: string
): Promise<{
  totalTokens: number
  availableTokens: number
  maxTokens: number
  fits: boolean
  utilization: number
  breakdown: { system: number; rolling: number; memory: number; current: number; reserved: number }
  summariesAvailable: number
  memoriesAvailable: number
}> {
  const api = getApi()
  const result = await api.get_context_info(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result
}

export async function invalidateContextCache(seriesId: string): Promise<boolean> {
  const api = getApi()
  const result = await api.invalidate_context_cache(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function estimateTokens(text: string): Promise<{ tokens: number }> {
  const api = getApi()
  return await api.estimate_tokens(text)
}

// ===== Export =====
export async function exportChapter(
  seriesId: string,
  chapterId: string
): Promise<any> {
  const api = getApi()
  const result = await api.export_chapter(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result
}

export async function exportSeries(seriesId: string): Promise<any> {
  const api = getApi()
  const result = await api.export_series(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result
}

export async function exportGlossaryFile(seriesId: string, fmt: 'json' | 'csv', data: string): Promise<any> {
  const api = getApi()
  const result = await api.export_glossary_file(seriesId, fmt, data)
  return result
}

// ===== Ping =====
export async function ping(): Promise<{ status: string; message: string }> {
  const api = getApi()
  return await api.ping()
}