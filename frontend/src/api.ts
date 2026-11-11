/**
 * LWNTL API Utility
 * Wraps window.pywebview.api calls with type safety
 */

import type {
  AppConfig,
  Series,
  SeriesGroup,
  Chapter,
  GlossaryEntry,
  WorkerStatus,
  SeriesDeleteInfo,
  ProfilesState,
  ApiError,
  AgentReviewMode,
  QaReport,
  QaFixPreview,
  GlossaryAudit,
  QaChapterDetail,
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

// ===== Groups =====
export async function getGroups(): Promise<SeriesGroup[]> {
  const api = getApi()
  const result = await api.get_groups()
  if (isApiError(result)) throw new Error(result.message)
  return result as SeriesGroup[]
}

export async function createGroup(name: string, parentId?: string | null, color?: string): Promise<SeriesGroup> {
  const api = getApi()
  const result = await api.create_group(name, parentId || null, color || '')
  if (isApiError(result)) throw new Error(result.message)
  return result as SeriesGroup
}

export async function updateGroup(id: string, name?: string, color?: string): Promise<SeriesGroup> {
  const api = getApi()
  const result = await api.update_group(id, name ?? null, color ?? null)
  if (isApiError(result)) throw new Error(result.message)
  return result as SeriesGroup
}

export async function deleteGroup(id: string): Promise<boolean> {
  const api = getApi()
  const result = await api.delete_group(id)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function moveSeriestoGroup(seriesId: string, groupId: string | null): Promise<Series> {
  const api = getApi()
  const result = await api.move_series_to_group(seriesId, groupId || null)
  if (isApiError(result)) throw new Error(result.message)
  return result as Series
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
  systemPrompt?: string,
  workerId?: string,
  iterationLock?: boolean,
  autoFixCjk?: boolean,
  imageFolder?: string,
  revisionPass?: boolean,
  lookupEnabled?: boolean,
  lookupChapters?: number,
): Promise<Series> {
  const api = getApi()
  const result = await api.update_series(seriesId, title, language, targetLanguage || null, systemPrompt || null, workerId ?? null, iterationLock ?? null, autoFixCjk ?? null, imageFolder ?? null, revisionPass ?? null, lookupEnabled ?? null, lookupChapters ?? null)
  if (isApiError(result)) throw new Error(result.message)
  return result as Series
}

// ===== Series images (placeholder → real image) =====

export interface ImageFolderInfo {
  exists: boolean
  count: number
  samples: string[]
}

export interface SeriesImageStatus {
  folder: string
  folderCount: number
  poolCount: number
}

export interface ImageSyncResult {
  matched: number
  missing: number
  chaptersUpdated: number
  missingNames: string[]
  poolCount: number
  folderCount: number
}

/** Native folder picker. Returns '' when cancelled. */
export async function pickImageFolder(initial = ''): Promise<string> {
  const api = getApi()
  const result = await api.pick_image_folder(initial)
  if (isApiError(result)) throw new Error(result.message)
  return (result as { path?: string }).path || ''
}

export async function describeImageFolder(folder: string): Promise<ImageFolderInfo> {
  const api = getApi()
  const result = await api.describe_image_folder(folder)
  if (isApiError(result)) throw new Error(result.message)
  return result as ImageFolderInfo
}

export async function getSeriesImageStatus(seriesId: string): Promise<SeriesImageStatus> {
  const api = getApi()
  const result = await api.get_series_image_status(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as SeriesImageStatus
}

/** Upload dropped images into the series' managed pool. */
export async function uploadSeriesImages(
  seriesId: string,
  images: Array<{ filename: string; data: string }>
): Promise<number> {
  const api = getApi()
  const result = await api.upload_series_images(seriesId, images)
  if (isApiError(result)) throw new Error(result.message)
  return (result as { saved: number }).saved
}

/** Match placeholder lines across the series against the image sources. */
export async function syncSeriesImages(seriesId: string): Promise<ImageSyncResult> {
  const api = getApi()
  const result = await api.sync_series_images(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as ImageSyncResult
}

export async function clearSeriesImagePool(seriesId: string): Promise<void> {
  const api = getApi()
  const result = await api.clear_series_image_pool(seriesId)
  if (isApiError(result)) throw new Error(result.message)
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

export interface ImportedImage {
  filename: string
  mime: string
  data: string // base64 (no data-URI prefix)
}

export async function createChapter(
  seriesId: string,
  number: string,
  title: string,
  rawContent: string,
  images?: ImportedImage[]
): Promise<Chapter> {
  const api = getApi()
  const result = await api.create_chapter(seriesId, number, title, rawContent, images ?? null)
  if (isApiError(result)) throw new Error(result.message)
  return result as Chapter
}

/** Fetch a chapter's stored illustrations as { filename: data-URI }. */
export async function getChapterAssets(
  seriesId: string,
  chapterId: string
): Promise<Record<string, string>> {
  const api = getApi()
  const result = await api.get_chapter_assets(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return (result || {}) as Record<string, string>
}

export async function updateChapter(
  seriesId: string,
  chapterId: string,
  number: string,
  title: string,
  rawContent: string
): Promise<Chapter> {
  const api = getApi()
  const result = await api.update_chapter(seriesId, chapterId, number, title, rawContent)
  if (isApiError(result)) throw new Error(result.message)
  return result as Chapter
}

export async function updateChapterSummary(
  seriesId: string,
  chapterId: string,
  summary: string
): Promise<Chapter> {
  const api = getApi()
  const result = await api.update_chapter_summary(seriesId, chapterId, summary)
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
  chapterId: string,
  archivePrevious = false,
): Promise<{ status: string; jobId: string; workerId: string }> {
  const api = getApi()
  const result = await api.start_translation(seriesId, chapterId, archivePrevious)
  if (isApiError(result)) throw new Error(result.message)
  return result
}

export async function restoreTranslationVersion(
  seriesId: string,
  chapterId: string,
  versionIndex: number,
): Promise<void> {
  const api = getApi()
  const result = await api.restore_translation_version(seriesId, chapterId, versionIndex)
  if (isApiError(result)) throw new Error(result.message)
}

export async function cancelTranslation(seriesId?: string, workerId?: string): Promise<boolean> {
  const api = getApi()
  const result = await api.cancel_translation(seriesId || null, workerId || null)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function startBatchTranslation(
  seriesId: string,
  chapterIds: string[],
  force = false,
  archivePrevious = false,
): Promise<{ status: string; total: number }> {
  const api = getApi()
  const result = await api.start_batch_translation(seriesId, JSON.stringify(chapterIds), force, archivePrevious)
  if (isApiError(result)) throw new Error(result.message)
  return result as { status: string; total: number }
}

/**
 * Autonomous agent run over the whole series: translate every unfinished
 * chapter, review + repair each with a tool-using agent, then a volume pass.
 * Progress arrives through onBatchStatus (agent: true, phase).
 */
export async function startAgentRun(
  seriesId: string,
  opts: { brief?: string; review?: AgentReviewMode; volumePass?: boolean; rereview?: boolean; safeFixes?: boolean } = {},
): Promise<{ status: string }> {
  const api = getApi()
  const result = await api.start_agent_run(
    seriesId,
    opts.brief ?? '',
    opts.review ?? 'full',
    opts.volumePass ?? true,
    opts.rereview ?? false,
    opts.safeFixes ?? true,
  )
  if (isApiError(result)) throw new Error(result.message)
  return result as { status: string }
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

export async function exportSeriesMerged(seriesId: string): Promise<{ message: string; path: string; usedTemplate: boolean; cancelled?: boolean }> {
  const api = getApi()
  const result = await api.export_series_merged(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result
}

export async function exportGlossaryFile(seriesId: string, fmt: 'json' | 'csv', data: string): Promise<any> {
  const api = getApi()
  const result = await api.export_glossary_file(seriesId, fmt, data)
  return result
}

// ===== CJK Fix =====
export async function fixCjkText(text: string, workerId?: string | null): Promise<{ fixed: string }> {
  const api = getApi()
  const result = await api.fix_cjk_text(text, workerId || null)
  if (isApiError(result)) throw new Error(result.message)
  return result as { fixed: string }
}

// ===== Ping =====
export async function ping(): Promise<{ status: string; message: string }> {
  const api = getApi()
  return await api.ping()
}

export async function getWorkerStatuses(): Promise<WorkerStatus[]> {
  const api = getApi()
  const result = await api.get_worker_statuses()
  if (isApiError(result)) throw new Error(result.message)
  return result as WorkerStatus[]
}

export async function getSeriesLogs(seriesId: string): Promise<{ seriesId: string; lines: string[] }> {
  const api = getApi()
  const result = await api.get_series_logs(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as { seriesId: string; lines: string[] }
}

export async function getWorkerLogs(workerId = 'all'): Promise<{ workerId: string; lines: string[] }> {
  const api = getApi()
  const result = await api.get_worker_logs(workerId)
  if (isApiError(result)) throw new Error(result.message)
  return result as { workerId: string; lines: string[] }
}

export interface ProposedTerm {
  sourceTerm: string
  translatedTerm: string
  notes: string
}

export interface TerminologyPrepassResult {
  entries: ProposedTerm[]
  batches: number
  skipped: number
  scannedChapters: number
}

/** Scan every chapter's raw source and propose glossary entries (nothing is saved yet). */
export async function runTerminologyPrepass(
  seriesId: string,
  workerId?: string | null
): Promise<TerminologyPrepassResult> {
  const api = getApi()
  const result = await api.run_terminology_prepass(seriesId, workerId || null)
  if (isApiError(result)) throw new Error(result.message)
  return result as TerminologyPrepassResult
}

export interface ParsedDocument {
  title: string
  content: string
  charCount: number
  images?: ImportedImage[]
}

export async function parseDocument(filename: string, dataBase64: string, mode: string = 'standard', topMargin: number = 0, bottomMargin: number = 0): Promise<ParsedDocument> {
  const api = getApi()
  const result = await api.parse_document(filename, dataBase64, mode, topMargin, bottomMargin)
  if (isApiError(result)) throw new Error(result.message)
  return result as ParsedDocument
}

export async function renderPdfPages(dataBase64: string, pageIndices: number[] = [0, 1, 2]): Promise<{ images: string[] }> {
  const api = getApi()
  const result = await api.render_pdf_pages(dataBase64, pageIndices)
  if (isApiError(result)) throw new Error(result.message)
  return result as { images: string[] }
}

export async function detectPdfMargins(dataBase64: string): Promise<{ topMargin: number; bottomMargin: number; pageHeight: number; pageCount: number }> {
  const api = getApi()
  const result = await api.detect_pdf_margins(dataBase64)
  if (isApiError(result)) throw new Error(result.message)
  return result as { topMargin: number; bottomMargin: number; pageHeight: number; pageCount: number }
}

// ===== Profiles =====
export async function getProfiles(): Promise<ProfilesState> {
  const api = getApi()
  const result = await api.get_profiles()
  if (isApiError(result)) throw new Error(result.message)
  return result as ProfilesState
}

export async function createProfile(name: string): Promise<{ name: string }> {
  const api = getApi()
  const result = await api.create_profile(name)
  if (isApiError(result)) throw new Error(result.message)
  return result as { name: string }
}

export async function deleteProfile(name: string): Promise<boolean> {
  const api = getApi()
  const result = await api.delete_profile(name)
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

export async function renameProfile(oldName: string, newName: string): Promise<{ name: string }> {
  const api = getApi()
  const result = await api.rename_profile(oldName, newName)
  if (isApiError(result)) throw new Error(result.message)
  return result as { name: string }
}

export async function switchProfile(name: string): Promise<ProfilesState> {
  const api = getApi()
  const result = await api.switch_profile(name)
  if (isApiError(result)) throw new Error(result.message)
  return result as ProfilesState
}

// ===== Profile Templates =====
export interface ProfileTemplates {
  systemPromptTemplate: string
  instructionsTemplate: string
  revisionPromptTemplate: string
  autofixPromptTemplate: string
  prepassPromptTemplate: string
}

export type TaskPromptKind = 'revision' | 'autofix' | 'prepass'
/** Built-in guidance per task and language: { revision: { en, id }, ... } */
export type TaskPromptDefaults = Record<TaskPromptKind, { en: string; id: string }>

export async function getProfileTemplates(): Promise<ProfileTemplates> {
  const api = getApi()
  const result = await api.get_profile_templates()
  if (isApiError(result)) throw new Error(result.message)
  return result as ProfileTemplates
}

export async function getDefaultTaskPrompts(): Promise<TaskPromptDefaults> {
  const api = getApi()
  const result = await api.get_default_task_prompts()
  if (isApiError(result)) throw new Error(result.message)
  return result as TaskPromptDefaults
}

export async function saveProfileTemplates(
  systemPromptTemplate: string,
  instructionsTemplate: string,
  tasks?: { revision?: string; autofix?: string; prepass?: string },
): Promise<boolean> {
  const api = getApi()
  const result = await api.save_profile_templates(
    systemPromptTemplate,
    instructionsTemplate,
    tasks?.revision ?? null,
    tasks?.autofix ?? null,
    tasks?.prepass ?? null,
  )
  if (isApiError(result)) throw new Error(result.message)
  return result as boolean
}

// ===== Model parameters =====

export interface OpenRouterModel {
  id: string
  name: string
  created: number
  context: number | null
  maxOutput: number | null
  priceIn: number | null
  priceOut: number | null
  priceCacheRead: number | null
  tools: boolean
  temperature: boolean
  reasoning: boolean
  reasoningMandatory: boolean
  efforts: string[]
  defaultEffort: string
  budgetReasoning: boolean
  expires: string | null
}

let openRouterCache: Promise<{ models: OpenRouterModel[]; fetchedAt: number }> | null = null

/** OpenRouter catalog (cached per session; `force` refetches from the network). */
export function getOpenRouterModels(force = false): Promise<{ models: OpenRouterModel[]; fetchedAt: number }> {
  if (!openRouterCache || force) {
    openRouterCache = (async () => {
      const api = getApi()
      const result = await api.get_openrouter_models(force)
      if (isApiError(result)) { openRouterCache = null; throw new Error(result.message) }
      return result as { models: OpenRouterModel[]; fetchedAt: number }
    })()
  }
  return openRouterCache
}

export interface RequestParams {
  temperature: boolean
  maxTokensKey: string
  extra: Record<string, unknown>
  notes: string[]
}

/** What LWNTL will actually send for this provider + model (uses the saved config). */
export async function describeRequestParams(provider: string, model: string): Promise<RequestParams> {
  const api = getApi()
  const result = await api.describe_request_params(provider, model)
  if (isApiError(result)) throw new Error(result.message)
  return result as RequestParams
}

// ===== QA (deterministic, no AI) =====

export async function qaScanSeries(seriesId: string, includeLow = true): Promise<QaReport> {
  const api = getApi()
  const result = await api.qa_scan_series(seriesId, includeLow)
  if (isApiError(result)) throw new Error(result.message)
  return result as QaReport
}

export async function qaPreviewFixes(seriesId: string, categories: string[]): Promise<QaFixPreview> {
  const api = getApi()
  const result = await api.qa_preview_fixes(seriesId, JSON.stringify(categories))
  if (isApiError(result)) throw new Error(result.message)
  return result as QaFixPreview
}

export interface RenamePreview {
  chapters: { chapterId: string; chapterNumber: string; text: number; summary: number }[]
  memory: number
  glossary: { sourceTerm: string; translatedTerm: string }[]
  samples: { chapter: string; before: string; after: string }[]
  total: number
}

export async function qaPreviewRename(seriesId: string, oldText: string, newText: string): Promise<RenamePreview> {
  const api = getApi()
  const result = await api.qa_preview_rename(seriesId, oldText, newText)
  if (isApiError(result)) throw new Error(result.message)
  return result as RenamePreview
}

export async function qaApplyRename(seriesId: string, oldText: string, newText: string): Promise<{ chapters: number; replaced: number; glossary: number }> {
  const api = getApi()
  const result = await api.qa_apply_rename(seriesId, oldText, newText)
  if (isApiError(result)) throw new Error(result.message)
  return result as { chapters: number; replaced: number; glossary: number }
}

export async function glossaryAudit(seriesId: string): Promise<GlossaryAudit> {
  const api = getApi()
  const result = await api.glossary_audit(seriesId)
  if (isApiError(result)) throw new Error(result.message)
  return result as GlossaryAudit
}

export async function qaChapterDetail(seriesId: string, chapterId: string): Promise<QaChapterDetail> {
  const api = getApi()
  const result = await api.qa_chapter_detail(seriesId, chapterId)
  if (isApiError(result)) throw new Error(result.message)
  return result as QaChapterDetail
}

/** Replace one paragraph (empty text deletes it). Returns the refreshed chapter detail. */
export async function qaUpdateParagraph(
  seriesId: string, chapterId: string, index: number, expected: string, newText: string, archive: boolean,
): Promise<QaChapterDetail> {
  const api = getApi()
  const result = await api.qa_update_paragraph(seriesId, chapterId, index, expected, newText, archive)
  if (isApiError(result)) throw new Error(result.message)
  return result as QaChapterDetail
}

export async function qaSuggestFix(seriesId: string, chapterId: string, index: number): Promise<{ suggestion: string; delete: boolean }> {
  const api = getApi()
  const result = await api.qa_suggest_fix(seriesId, chapterId, index)
  if (isApiError(result)) throw new Error(result.message)
  return result as { suggestion: string; delete: boolean }
}

export async function glossaryResolve(seriesId: string, action: Record<string, unknown>): Promise<Record<string, unknown>> {
  const api = getApi()
  const result = await api.glossary_resolve(seriesId, JSON.stringify(action))
  if (isApiError(result)) throw new Error(result.message)
  return result as Record<string, unknown>
}

export async function glossaryDeleteEntries(seriesId: string, entryIds: string[]): Promise<{ deleted: number; backup: string }> {
  const api = getApi()
  const result = await api.glossary_delete_entries(seriesId, JSON.stringify(entryIds))
  if (isApiError(result)) throw new Error(result.message)
  return result as { deleted: number; backup: string }
}

export async function qaApplyFixes(seriesId: string, categories: string[]): Promise<{ chapters: number; categories: Record<string, number> }> {
  const api = getApi()
  const result = await api.qa_apply_fixes(seriesId, JSON.stringify(categories), null)
  if (isApiError(result)) throw new Error(result.message)
  return result as { chapters: number; categories: Record<string, number> }
}
