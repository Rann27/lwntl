/**
 * LWNTL Prompt and Worker Panel
 * Center panel: worker selection, system prompt, instruction prompt, sliders
 */

import { useEffect, useState } from 'react'
import { AlertCircle, Copy, ExternalLink, Info, Library, RotateCcw, Save } from 'lucide-react'
import { getProfileTemplates, describeRequestParams, listPromptPresets, duplicatePromptPreset } from '../api'
import type { RequestParams } from '../api'
import { useI18n } from '../i18n'
import { PROVIDERS } from '../types'
import type { AppConfig, PromptPreset, Series, WorkerStatus } from '../types'
import { PromptPresetLibrary } from './PromptPresetLibrary'
import { ChatGPTPlanBadge } from './ChatGPTCard'
import { approxTokens, presetLabel, resolvePrompt } from '../utils/promptPresets'
import type { ResolvedPrompt } from '../utils/promptPresets'

interface PromptModelPanelProps {
  config: AppConfig | null
  series: Series | null
  instructions: string
  onInstructionsChange: (val: string) => void
  systemPrompt: string
  onSystemPromptChange: (val: string) => void
  onSave: (config: AppConfig, instructions: string, systemPrompt: string, workerId: string, iterationLock: boolean, autoFixCjk: boolean, revisionPass: boolean, lookupEnabled: boolean, lookupChapters: number, systemPromptPreset: string) => void
  workerStatuses?: WorkerStatus[]
  loading?: boolean
}

const SOURCE_BADGE: Record<ResolvedPrompt['source'], { label: string; bg: string; fg: string }> = {
  series: { label: 'Teks series', bg: '#111', fg: '#FFEF33' },
  series_preset: { label: 'Preset series', bg: '#00F7FF', fg: '#111' },
  profile: { label: 'Template profil', bg: '#28E272', fg: '#111' },
  profile_preset: { label: 'Preset profil', bg: '#28E272', fg: '#111' },
  auto: { label: 'Otomatis', bg: '#C9A7FF', fg: '#111' },
  none: { label: 'Kosong', bg: '#FF8A8A', fg: '#111' },
}

function describe(r: ResolvedPrompt): string {
  switch (r.source) {
    case 'profile': return 'template profil'
    case 'profile_preset': return `preset profil: ${r.preset?.name}`
    case 'auto': return `otomatis: ${r.preset?.name}`
    case 'none': return 'tanpa system prompt'
    default: return ''
  }
}

const TEMPLATE_VARS = [
  { variable: '{source_language}', description: 'Bahasa sumber series (contoh: Japanese)' },
  { variable: '{target_language}', description: 'Bahasa target terjemahan (contoh: Indonesian)' },
  { variable: '{title}', description: 'Judul series' },
]

// Slider stops for max output tokens. The slider snaps to these; the number input
// next to it still accepts any value in between. "K" follows the existing 128000
// convention (×1000), so the top stop is 1,024,000.
const MAX_TOKEN_PRESETS = [
  4000, 8000, 16000, 32000, 64000, 128000,
  156000, 200000, 256000, 300000, 384000, 512000,
  640000, 720000, 856000, 912000, 1024000,
]
const MAX_TOKEN_LIMIT = MAX_TOKEN_PRESETS[MAX_TOKEN_PRESETS.length - 1]

// Slider stops for the model's total context window (input budget indicator).
const CONTEXT_PRESETS = [
  32000, 64000, 128000, 200000, 256000, 400000,
  512000, 640000, 800000, 1000000, 2000000,
]
const CONTEXT_LIMIT = CONTEXT_PRESETS[CONTEXT_PRESETS.length - 1]

/** Index of the preset closest to `value` — lets a custom value still position the slider. */
function nearestPresetIndex(presets: number[], value: number): number {
  let best = 0
  for (let i = 1; i < presets.length; i++) {
    if (Math.abs(presets[i] - value) < Math.abs(presets[best] - value)) best = i
  }
  return best
}

function formatTokens(value: number): string {
  // Plain "1024K" — no locale grouping, which would render as an ambiguous "1.024K".
  return value >= 1000 && value % 1000 === 0
    ? `${value / 1000}K`
    : value.toLocaleString()
}

export function PromptModelPanel({
  config,
  series,
  instructions,
  onInstructionsChange,
  systemPrompt,
  onSystemPromptChange,
  onSave,
  workerStatuses = [],
  loading,
}: PromptModelPanelProps) {
  const [workerId, setWorkerId] = useState(series?.workerId || config?.workers?.[0]?.id || '')
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.3)
  const [maxTokens, setMaxTokens] = useState(config?.maxTokensPerIteration ?? 16000)
  const [maxContext, setMaxContext] = useState(config?.maxContextTokens ?? 128000)
  const [glossaryPreFilter, setGlossaryPreFilter] = useState(config?.glossaryPreFilter ?? true)
  const [iterationLock, setIterationLock] = useState(series?.iterationLock ?? true)
  const [autoFixCjk, setAutoFixCjk] = useState(series?.autoFixCjk ?? false)
  const [revisionPass, setRevisionPass] = useState(series?.revisionPass ?? false)
  const [lookupEnabled, setLookupEnabled] = useState(series?.lookupEnabled ?? false)
  const [lookupChapters, setLookupChapters] = useState(series?.lookupChapters ?? 1)
  const [dirty, setDirty] = useState(false)
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [defaultInstructions, setDefaultInstructions] = useState('')
  const [profilePreset, setProfilePreset] = useState('')
  const [loadingDefault, setLoadingDefault] = useState(false)
  const [presets, setPresets] = useState<PromptPreset[]>([])
  const [preset, setPreset] = useState(series?.systemPromptPreset ?? '')
  // "Own text" is a choice of its own: it stays selected while the text is
  // still empty, so picking it and then typing does not flip back to a preset.
  const [customMode, setCustomMode] = useState(!!systemPrompt.trim())
  const [libraryOpen, setLibraryOpen] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    setPreset(series?.systemPromptPreset ?? '')
    setCustomMode(!!(series?.systemPrompt ?? '').trim())
  }, [series?.id])

  useEffect(() => {
    listPromptPresets(true).then(setPresets).catch(() => setPresets([]))
  }, [])

  useEffect(() => {
    if (!config) return
    setWorkerId(series?.workerId || config.workers?.[0]?.id || '')
    setTemperature(config.temperature)
    setMaxTokens(config.maxTokensPerIteration)
    setMaxContext(config.maxContextTokens ?? 128000)
    setGlossaryPreFilter(config.glossaryPreFilter ?? true)
    setIterationLock(series?.iterationLock ?? true)
    setAutoFixCjk(series?.autoFixCjk ?? false)
    setRevisionPass(series?.revisionPass ?? false)
    setLookupEnabled(series?.lookupEnabled ?? false)
    setLookupChapters(series?.lookupChapters ?? 1)
  }, [config, series?.workerId])

  useEffect(() => {
    setLoadingDefault(true)
    getProfileTemplates()
      .then((tpl) => {
        setDefaultPrompt(tpl.systemPromptTemplate)
        setDefaultInstructions(tpl.instructionsTemplate)
        setProfilePreset(tpl.systemPromptPreset ?? '')
      })
      .catch(() => { setDefaultPrompt(''); setDefaultInstructions(''); setProfilePreset('') })
      .finally(() => setLoadingDefault(false))
  }, [])

  const promptInputs = {
    profileText: defaultPrompt, profilePreset,
    seriesInstructions: instructions, profileInstructions: defaultInstructions,
    sourceLanguage: series?.sourceLanguage ?? '', targetLanguage: series?.targetLanguage ?? '', presets,
  }
  const resolved = resolvePrompt({ ...promptInputs, seriesText: customMode ? systemPrompt : '', seriesPreset: customMode ? '' : preset })
  const inherited = resolvePrompt({ ...promptInputs, seriesText: '', seriesPreset: '' })
  const promptChoice = customMode ? '__custom' : preset
  const builtinPresets = presets.filter(p => p.builtin)
  const userPresets = presets.filter(p => !p.builtin)

  const choosePrompt = (value: string) => {
    if (value === '__custom') {
      // Start from what is in effect now, so "own text" means editing it.
      if (!systemPrompt.trim()) onSystemPromptChange(resolved.text)
      setCustomMode(true)
    } else {
      setCustomMode(false)
      setPreset(value)
      onSystemPromptChange('')
    }
    setDirty(true)
  }

  const duplicateAndUse = async () => {
    if (!resolved.preset) return
    const copy = await duplicatePromptPreset(resolved.preset.id)
    setPresets(await listPromptPresets(true))
    setCustomMode(false)
    setPreset(copy.id)
    onSystemPromptChange('')
    setDirty(true)
    setLibraryOpen(true)
  }

  // Instructions are optional — an all-in-one system prompt needs no second
  // section. A placeholder-only value ("-", ".") counts as empty, matching how
  // the backend treats it, so the field reflects what is actually sent.
  const hasMeaning = (t: string) => /[0-9A-Za-z぀-ヿ一-鿿가-힯]/.test(t)
  const effectiveDefaultInstructions = hasMeaning(defaultInstructions) ? defaultInstructions : ''
  const isCustomInstructions = hasMeaning(instructions)
  // The profile template only applies when this series has nothing of its own.
  const templateInUse = !isCustomInstructions && effectiveDefaultInstructions.length > 0
  const instructionsActive = isCustomInstructions || templateInUse
  const workers = config?.workers || []
  const selectedWorker = workers.find((w) => w.id === workerId)
  const statusByWorker = new Map(workerStatuses.map((w) => [w.id, w]))
  const selectedStatus = selectedWorker ? statusByWorker.get(selectedWorker.id) : null
  const tempMax = selectedWorker?.provider === 'deepseek' ? 2.0 : 1.0
  // What the worker's model really accepts — some refuse temperature outright
  // (GPT-6, Claude 5.x, Kimi), DeepSeek ignores it while thinking.
  const [reqParams, setReqParams] = useState<RequestParams | null>(null)
  useEffect(() => {
    if (!selectedWorker) { setReqParams(null); return }
    describeRequestParams(selectedWorker.provider, selectedWorker.model).then(setReqParams).catch(() => setReqParams(null))
  }, [selectedWorker?.provider, selectedWorker?.model, config])
  const deepseekThinkingOn = selectedWorker?.provider === 'deepseek' && !!config?.deepseekThinking
  const temperatureIgnored = deepseekThinkingOn || reqParams?.temperature === false

  // Clamp temperature when switching away from DeepSeek
  useEffect(() => {
    if (temperature > tempMax) {
      setTemperature(tempMax)
      setDirty(true)
    }
  }, [workerId])

  const handleSave = () => {
    if (!config) return
    onSave(
      {
        ...config,
        temperature,
        maxTokensPerIteration: maxTokens,
        maxContextTokens: maxContext,
        glossaryPreFilter,
      },
      instructions,
      systemPrompt,
      workerId,
      iterationLock,
      autoFixCjk,
      revisionPass,
      lookupEnabled,
      lookupChapters,
      customMode ? '' : preset,
    )
    setDirty(false)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: '4px 4px 0px var(--color-border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid var(--color-border)' }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text)' }}>
          {t.seriesSettings.promptModel}
        </span>
        {dirty && (
          <div className="flex items-center gap-1" style={{ color: '#FFEF33' }}>
            <AlertCircle size={12} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{t.seriesSettings.notSaved}</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-5" style={{ minHeight: 0, overflowY: 'auto' }}>
        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
            {t.seriesSettings.worker}
          </label>
          <select
            value={workerId}
            onChange={(e) => { setWorkerId(e.target.value); setDirty(true) }}
            className="neo-input"
            style={{ cursor: 'pointer', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            {workers.map((worker) => {
              const status = statusByWorker.get(worker.id)
              const activeCount = status?.activeCount ?? 0
              const maxConcurrent = status?.maxConcurrent ?? 1
              const busyLabel = activeCount > 0 ? ` - busy (${activeCount}/${maxConcurrent})` : ''
              const providerLabel = PROVIDERS[worker.provider]?.label || worker.provider
              const modelLabel = PROVIDERS[worker.provider]?.displayNames?.[worker.model] || worker.model
              return (
                <option key={worker.id} value={worker.id}>
                  {worker.label} - {modelLabel} ({providerLabel}){busyLabel}
                </option>
              )
            })}
          </select>
          {selectedWorker && !config?.[PROVIDERS[selectedWorker.provider]?.apiKeyName as keyof AppConfig] && (
            <p style={{ fontSize: '11px', color: '#FF3C3C', marginTop: '4px', fontWeight: 600 }}>
              API key worker ini belum diisi - {t.topbar.settings}
            </p>
          )}
          {selectedStatus?.active && (
            <p style={{ fontSize: '11px', color: '#FFEF33', marginTop: '4px', fontWeight: 600 }}>
              Worker sedang aktif ({selectedStatus.activeCount ?? 1}/{selectedStatus.maxConcurrent ?? 1} slot). Slot tersisa untuk series ini jika ada.
            </p>
          )}
        </div>

        {selectedWorker && (
          <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {PROVIDERS[selectedWorker.provider]?.label || selectedWorker.provider}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
              {PROVIDERS[selectedWorker.provider]?.displayNames?.[selectedWorker.model] || selectedWorker.model}
            </span>
            {PROVIDERS[selectedWorker.provider]?.docsUrl && (
              <a href={PROVIDERS[selectedWorker.provider]?.docsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-muted)' }}>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}
        {selectedWorker?.provider === 'chatgpt' && <ChatGPTPlanBadge />}

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              {t.seriesSettings.systemPrompt}
            </label>
            <span style={{ fontSize: '10px', fontWeight: 700, color: SOURCE_BADGE[resolved.source].fg, background: SOURCE_BADGE[resolved.source].bg, padding: '2px 6px', textTransform: 'uppercase' }}>
              {SOURCE_BADGE[resolved.source].label}
            </span>
          </div>
          <div className="flex gap-2 mb-2">
            <select
              value={promptChoice}
              onChange={(e) => choosePrompt(e.target.value)}
              className="neo-input"
              style={{ flex: 1, cursor: 'pointer', fontSize: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
            >
              <option value="">Ikuti profil — {describe(inherited)}</option>
              <option value="__custom">Teks khusus series ini</option>
              <optgroup label="Preset bawaan (hanya baca)">
                {builtinPresets.map(p => <option key={p.id} value={p.id}>{presetLabel(p)}</option>)}
              </optgroup>
              {userPresets.length > 0 && (
                <optgroup label="Preset milikku">
                  {userPresets.map(p => <option key={p.id} value={p.id}>{presetLabel(p)}</option>)}
                </optgroup>
              )}
            </select>
            <button type="button" onClick={() => setLibraryOpen(true)} className="neo-button flex items-center gap-1"
              style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#00F7FF', color: '#111' }} title="Lihat, duplikat, dan edit preset">
              <Library size={12} /> PRESET
            </button>
          </div>
          <textarea
            value={customMode ? systemPrompt : resolved.text}
            readOnly={!customMode}
            onChange={(e) => { onSystemPromptChange(e.target.value); setDirty(true) }}
            placeholder={loadingDefault ? t.common.loading : 'System prompt...'}
            className="neo-textarea"
            style={{ minHeight: '200px', fontSize: '12px', fontFamily: "'Inter', monospace", backgroundColor: customMode ? 'var(--color-surface)' : 'var(--color-surface-2)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          />
          <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            <span>≈{approxTokens(customMode ? systemPrompt : resolved.text).toLocaleString()} token</span>
            {!customMode && resolved.text && (
              <>
                <span>· hanya baca —</span>
                <button type="button" onClick={() => choosePrompt('__custom')}
                  style={{ fontSize: '10px', fontWeight: 700, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '1px 6px', cursor: 'pointer', textTransform: 'uppercase' }}>
                  Salin jadi teks series
                </button>
                {resolved.preset && (
                  <button type="button" onClick={duplicateAndUse} className="flex items-center gap-1"
                    style={{ fontSize: '10px', fontWeight: 700, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '1px 6px', cursor: 'pointer', textTransform: 'uppercase' }}>
                    <Copy size={10} /> Duplikat preset & pakai
                  </button>
                )}
              </>
            )}
          </div>
          <PromptPresetLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} onChanged={setPresets}
            initialId={resolved.preset?.id ?? preset} />
          <div className="mt-2 p-2.5" style={{ backgroundColor: 'var(--color-surface-2)', border: '2px solid var(--color-separator)', fontSize: '11px' }}>
            <div className="flex items-center gap-1 mb-1.5" style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
              <Info size={11} /> {t.seriesSettings.templateVars}
            </div>
            <div className="space-y-0.5">
              {TEMPLATE_VARS.map((tv) => (
                <div key={tv.variable} className="flex items-start gap-2">
                  <code style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: '#00F7FF', backgroundColor: '#111', padding: '1px 5px', fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {tv.variable}
                  </code>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{tv.description}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '6px', color: 'var(--color-text-subtle)', fontSize: '10px', lineHeight: 1.4 }}>
              {t.seriesSettings.templateVarsDesc}
            </p>
          </div>
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              {t.seriesSettings.instructionPrompt}
              {!instructionsActive && (
                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', backgroundColor: 'var(--color-surface-2)', border: '1.5px solid var(--color-separator)', color: 'var(--color-text-subtle)', letterSpacing: '0.3px' }}>
                  TIDAK DIPAKAI
                </span>
              )}
            </label>
            {(isCustomInstructions || templateInUse) && (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '10px', fontWeight: 700, color: isCustomInstructions ? '#FFEF33' : '#fff', background: isCustomInstructions ? '#111' : '#28E272', padding: '2px 6px', textTransform: 'uppercase' }}>
                  {isCustomInstructions ? t.seriesSettings.custom : t.seriesSettings.default}
                </span>
                {isCustomInstructions && (
                  <button
                    type="button"
                    onClick={() => { onInstructionsChange(''); setDirty(true) }}
                    className="flex items-center gap-1"
                    style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', border: 'none', background: 'transparent', cursor: 'pointer', textTransform: 'uppercase' }}
                    title="Reset ke default template"
                  >
                    <RotateCcw size={10} /> Reset
                  </button>
                )}
              </div>
            )}
          </div>
          <textarea
            value={instructions}
            onChange={(e) => { onInstructionsChange(e.target.value); setDirty(true) }}
            placeholder={loadingDefault
              ? t.common.loading
              : effectiveDefaultInstructions
                ? 'Kosong → memakai template profil di bawah. Isi untuk menimpanya.'
                : 'Kosong → instructions tidak dikirim ke model.'}
            className="neo-textarea"
            style={{ minHeight: '80px', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          />
          {templateInUse ? (
            <div className="mt-2 px-2.5 py-2" style={{ border: '1.5px solid var(--color-separator)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Template profil sedang dipakai
                </span>
                <button
                  type="button"
                  onClick={() => { onInstructionsChange(effectiveDefaultInstructions); setDirty(true) }}
                  style={{ fontSize: '10px', fontWeight: 700, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0 }}
                >
                  Salin ke sini
                </button>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', margin: 0, lineHeight: 1.5 }}>
                Untuk mematikan instructions di SEMUA series pada profil ini, kosongkan
                Instructions Template lewat menu Profile Templates.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
              {isCustomInstructions
                ? t.seriesSettings.instructionDesc
                : 'Tidak dipakai — system prompt jalan sendiri. Kosongkan saja jika sudah all-in-one.'}
            </p>
          )}
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.maxTokens}</label>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', backgroundColor: 'var(--color-surface-2)', border: '1.5px solid var(--color-separator)', color: 'var(--color-text-muted)', letterSpacing: '0.3px' }}>
                output
              </span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
              {formatTokens(maxTokens)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={MAX_TOKEN_PRESETS.length - 1}
              step={1}
              value={nearestPresetIndex(MAX_TOKEN_PRESETS, maxTokens)}
              onChange={(e) => { setMaxTokens(MAX_TOKEN_PRESETS[parseInt(e.target.value)]); setDirty(true) }}
              className="flex-1"
              style={{ accentColor: '#00F7FF' }}
            />
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                setMaxTokens(isNaN(v) ? 16000 : Math.min(Math.max(v, 1000), MAX_TOKEN_LIMIT))
                setDirty(true)
              }}
              className="neo-input"
              style={{ width: '104px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              min={1000}
              max={MAX_TOKEN_LIMIT}
            />
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
            Batas panjang output per iterasi. Slider menempel ke preset; isi angka manual untuk nilai bebas.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
                Context Window
              </label>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', backgroundColor: 'var(--color-surface-2)', border: '1.5px solid var(--color-separator)', color: 'var(--color-text-muted)', letterSpacing: '0.3px' }}>
                input
              </span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
              {formatTokens(maxContext)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={CONTEXT_PRESETS.length - 1}
              step={1}
              value={nearestPresetIndex(CONTEXT_PRESETS, maxContext)}
              onChange={(e) => { setMaxContext(CONTEXT_PRESETS[parseInt(e.target.value)]); setDirty(true) }}
              className="flex-1"
              style={{ accentColor: '#00F7FF' }}
            />
            <input
              type="number"
              value={maxContext}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                setMaxContext(isNaN(v) ? 128000 : Math.min(Math.max(v, 4000), CONTEXT_LIMIT))
                setDirty(true)
              }}
              className="neo-input"
              style={{ width: '104px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              min={4000}
              max={CONTEXT_LIMIT}
            />
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
            Total context window model. Indikator di chapter memakai sisa setelah dikurangi Max Tokens:{' '}
            <strong style={{ color: 'var(--color-text-muted)' }}>
              {formatTokens(Math.max(maxContext - Math.min(maxTokens, Math.floor(maxContext / 2)), 0))} untuk input
            </strong>.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.temperature}</label>
              {tempMax === 2.0 && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', backgroundColor: '#00F7FF', color: '#111', letterSpacing: '0.3px' }}>
                  max 2.0 · DeepSeek
                </span>
              )}
              {temperatureIgnored && (
                <span
                  title={deepseekThinkingOn ? 'DeepSeek thinking mode aktif — temperature tidak berpengaruh' : (reqParams?.notes.join(' · ') || 'Model ini tidak menerima temperature')}
                  style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', backgroundColor: '#FFEF33', color: '#111', letterSpacing: '0.3px' }}
                >
                  {deepseekThinkingOn ? 'diabaikan · thinking ON' : 'tidak dikirim · model'}
                </span>
              )}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{temperature.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={tempMax} step={0.1} value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value) || 0.3); setDirty(true) }} className="neo-input" style={{ width: '70px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} min={0} max={tempMax} step={0.1} />
          </div>
        </div>

        <div style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text)' }}>
                Look Up
              </span>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5 }}>
                {lookupEnabled
                  ? 'Bawa teks terjemahan + istilah bab sebelumnya sebagai acuan gaya. Rolling memory otomatis melewati bab yang sudah dibawa.'
                  : 'Bawa bab sebelumnya utuh agar suara narasi dan istilah konsisten di batas bab.'}
              </p>
            </div>
            <button
              onClick={() => { setLookupEnabled(v => !v); setDirty(true) }}
              style={{ flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: lookupEnabled ? '#FFCF77' : 'var(--color-surface)', color: lookupEnabled ? '#111' : 'var(--color-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
            >
              {lookupEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {lookupEnabled && (
            <div className="px-3 pb-3" style={{ borderTop: '1.5px solid var(--color-separator)', paddingTop: '10px' }}>
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)' }}>
                  Jumlah bab
                </label>
                <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                  {lookupChapters}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={5} step={1} value={lookupChapters}
                  onChange={(e) => { setLookupChapters(parseInt(e.target.value)); setDirty(true) }}
                  className="flex-1" style={{ accentColor: '#FFCF77' }}
                />
                <input
                  type="number" min={1} max={10} value={lookupChapters}
                  onChange={(e) => { const v = parseInt(e.target.value); setLookupChapters(isNaN(v) ? 1 : Math.min(Math.max(v, 1), 10)); setDirty(true) }}
                  className="neo-input"
                  style={{ width: '58px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                />
              </div>
              <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '5px', lineHeight: 1.5 }}>
                Bab panjang (LN): 1 sudah cukup. Bab pendek (WN): 3 ke atas. Ada pagar 60K karakter — bab paling baru diprioritaskan.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2.5" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text)' }}>
              Revision Pass
            </span>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5 }}>
              {revisionPass
                ? 'Model membaca ulang draft-nya sendiri dan memperbaiki prosa — repetisi struktur, atribusi mubazir, ritme. +1 call per chapter.'
                : 'Pass kedua untuk kualitas prosa. Draft tetap dipakai kalau hasil revisi gagal cek struktur.'}
            </p>
          </div>
          <button
            onClick={() => { setRevisionPass(v => !v); setDirty(true) }}
            style={{ flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: revisionPass ? '#C8FF8A' : 'var(--color-surface)', color: revisionPass ? '#111' : 'var(--color-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
          >
            {revisionPass ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-2.5" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text)' }}>
              AutoFix CJK
            </span>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {autoFixCjk
                ? 'Post-processing aktif — CJK noise diperbaiki per baris setelah tiap chapter (simbol seperti 「」 dikecualikan)'
                : 'Perbaiki sisa karakter CJK otomatis setelah translation, berbasis baris + konteks'}
            </p>
          </div>
          <button
            onClick={() => { setAutoFixCjk(v => !v); setDirty(true) }}
            style={{ flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: autoFixCjk ? '#FF7A00' : 'var(--color-surface)', color: autoFixCjk ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
          >
            {autoFixCjk ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-2.5" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text)' }}>
              {t.seriesSettings.glossaryPreFilter}
            </span>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {t.seriesSettings.glossaryPreFilterDesc}
            </p>
          </div>
          <button
            onClick={() => { setGlossaryPreFilter(v => !v); setDirty(true) }}
            style={{ flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: glossaryPreFilter ? '#28E272' : 'var(--color-surface)', color: glossaryPreFilter ? '#111' : 'var(--color-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
          >
            {glossaryPreFilter ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-2.5" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text)' }}>
              Iteration Lock
            </span>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {iterationLock
                ? 'Max 1 iterasi — aman untuk chapter yang muat dalam 1 output'
                : 'Multi-iterasi aktif — translator akan lanjutkan jika konten belum selesai'}
            </p>
          </div>
          <button
            onClick={() => { setIterationLock(v => !v); setDirty(true) }}
            style={{ flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: iterationLock ? '#00F7FF' : 'var(--color-surface)', color: iterationLock ? '#111' : 'var(--color-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
          >
            {iterationLock ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={{ borderTop: '2.5px solid var(--color-border)', padding: '12px 16px' }}>
        <button onClick={handleSave} disabled={loading} className="neo-button flex items-center justify-center gap-2 w-full" style={{ opacity: loading ? 0.5 : 1 }}>
          <Save size={16} />
          {loading ? t.common.saving : t.seriesSettings.saveSettings}
        </button>
      </div>
    </div>
  )
}
